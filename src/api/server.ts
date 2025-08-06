/**
 * Express API Server for DTX Download Manager
 * Bridges the web GUI with the existing backend services
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { ScrapingService, ApprovedDtxStrategy, Source } from '../scraping';
import { DownloadService } from '../core/download/download-service';
import { IChart } from '../core/models';
import { ChartDatabase } from '../core/database/database';

// Types for API requests/responses
interface ChartSearchRequest {
  query?: string;
  artist?: string;
  titleContains?: string;
  minDifficulty?: number;
  maxDifficulty?: number;
  minBpm?: number;
  maxBpm?: number;
  sources?: string[];
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface DownloadRequest {
  chartIds: string[];
  destination?: string;
  concurrency?: number;
  skipExisting?: boolean;
}

interface ScrapeRequest {
  source: string;
  maxPages?: number;
  incremental?: boolean;
}

export class DTXApiServer {
  private app: express.Application;
  private scrapingService: ScrapingService;
  private downloadService: DownloadService;
  private database: ChartDatabase;
  
  constructor() {
    this.app = express();
    this.scrapingService = new ScrapingService();
    this.downloadService = new DownloadService('./downloads');
    this.database = new ChartDatabase();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.initializeServices();
  }
  
  private setupMiddleware(): void {
    // Enable CORS for frontend
    this.app.use(cors({
      origin: ['http://localhost:8000', 'http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));
    
    // Parse JSON bodies
    this.app.use(express.json({ limit: '50mb' }));
    
    // Serve static files from gui directory
    this.app.use('/gui', express.static(path.join(__dirname, '../../gui')));
    
    // Request logging
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }
  
  private async initializeServices(): Promise<void> {
    // ChartDatabase is initialized in constructor
    
    // Register scraping strategies
    this.scrapingService.registerStrategy(new ApprovedDtxStrategy());
    
    console.log('Services initialized successfully');
  }
  
  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    // Chart management routes
    this.setupChartRoutes();
    
    // Scraping routes
    this.setupScrapingRoutes();
    
    // Download routes
    this.setupDownloadRoutes();
    
    // Serve GUI on root
    this.app.get('/', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '../../gui/index.html'));
    });
    
    // 404 handler
    this.app.use((_req: Request, res: Response) => {
      res.status(404).json({ error: 'Not found' });
    });
    
    // Error handler
    this.app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
      console.error('API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
  }
  
  private setupChartRoutes(): void {
    // GET /api/charts - Search and list charts
    this.app.get('/api/charts', async (req: Request, res: Response) => {
      try {
        const searchParams: ChartSearchRequest = req.query as any;
        const charts = await this.searchCharts(searchParams);
        
        res.json({
          charts,
          totalCount: charts.length,
          hasMore: false,
          searchTime: Date.now()
        });
      } catch (error) {
        console.error('Error searching charts:', error);
        res.status(500).json({ error: 'Failed to search charts' });
      }
    });
    
    // GET /api/charts/:id - Get specific chart
    this.app.get('/api/charts/:id', async (req: Request, res: Response) => {
      try {
        const chartId = req.params.id;
        const chart = await this.database.getChart(chartId);
        
        if (!chart) {
          return res.status(404).json({ error: 'Chart not found' });
        }
        
        res.json(chart);
      } catch (error) {
        console.error('Error fetching chart:', error);
        res.status(500).json({ error: 'Failed to fetch chart' });
      }
    });
    
    // POST /api/charts - Add new chart manually
    this.app.post('/api/charts', async (req: Request, res: Response) => {
      try {
        const chartData = req.body;
        await this.database.saveChart(chartData);
        res.status(201).json(chartData);
      } catch (error) {
        console.error('Error creating chart:', error);
        res.status(500).json({ error: 'Failed to create chart' });
      }
    });
    
    // DELETE /api/charts/:id - Delete chart
    this.app.delete('/api/charts/:id', async (req: Request, res: Response) => {
      try {
        const chartId = req.params.id;
        const deleted = await this.database.deleteChart(chartId);
        if (deleted) {
          res.status(204).send();
        } else {
          res.status(404).json({ error: 'Chart not found' });
        }
      } catch (error) {
        console.error('Error deleting chart:', error);
        res.status(500).json({ error: 'Failed to delete chart' });
      }
    });
    
    // GET /api/charts/stats - Get database statistics
    this.app.get('/api/charts/stats', async (_req: Request, res: Response) => {
      try {
        const totalCharts = await this.database.getTotalChartCount();
        const chartsBySource = await this.database.getChartCountBySource();
        const charts = await this.database.queryCharts();
        const artists = new Set(charts.map(c => c.artist));
        
        res.json({
          totalCharts,
          totalArtists: artists.size,
          totalSources: Object.keys(chartsBySource).length,
          chartsBySource,
          lastUpdated: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
      }
    });
  }
  
  private setupScrapingRoutes(): void {
    // POST /api/scrape - Start scraping
    this.app.post('/api/scrape', async (req, res) => {
      try {
        const scrapeRequest: ScrapeRequest = req.body;
        
        const source: Source = {
          name: scrapeRequest.source,
          baseUrl: this.getSourceBaseUrl(scrapeRequest.source),
          strategy: scrapeRequest.source,
          enabled: true,
          maxPages: scrapeRequest.maxPages || 1,
          rateLimit: 2000
        };
        
        // Start scraping process
        const result = await this.scrapingService.scrapeSource(source);
        
        // Save charts to database
        if (result.charts && result.charts.length > 0) {
          for (const chart of result.charts) {
            try {
              await this.database.save(chart);
            } catch (error) {
              console.warn(`Failed to save chart: ${chart.title}`, error);
            }
          }
        }
        
        res.json({
          sourceName: source.name,
          chartsFound: result.charts?.length || 0,
          chartsAdded: result.charts?.length || 0,
          chartsDuplicated: 0,
          errors: result.errors || [],
          duration: Date.now() - result.startTime,
          nextScrapeTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
        
      } catch (error) {
        console.error('Error during scraping:', error);
        res.status(500).json({ error: 'Scraping failed: ' + error.message });
      }
    });
    
    // GET /api/scrape/sources - Get available sources
    this.app.get('/api/scrape/sources', (req, res) => {
      res.json([
        {
          name: 'approved-dtx',
          displayName: 'ApprovedDTX',
          baseUrl: 'http://approvedtx.blogspot.com/',
          enabled: true,
          strategy: 'approved-dtx'
        }
      ]);
    });
  }
  
  private setupDownloadRoutes(): void {
    // POST /api/downloads - Start new download
    this.app.post('/api/downloads', async (req, res) => {
      try {
        const downloadRequest: DownloadRequest = req.body;
        
        // Get charts by IDs
        const charts: Chart[] = [];
        for (const chartId of downloadRequest.chartIds) {
          const chart = await this.database.findById(chartId as ChartId);
          if (chart) {
            charts.push(chart);
          }
        }
        
        if (charts.length === 0) {
          return res.status(400).json({ error: 'No valid charts found' });
        }
        
        // Start download process
        const downloadResult = await this.downloadService.downloadCharts(
          charts,
          downloadRequest.destination || './downloads',
          {
            concurrency: downloadRequest.concurrency || 3,
            skipExisting: downloadRequest.skipExisting || false
          }
        );
        
        res.json({
          downloadId: downloadResult.id,
          status: 'started',
          chartCount: charts.length,
          startTime: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Error starting download:', error);
        res.status(500).json({ error: 'Failed to start download: ' + error.message });
      }
    });
    
    // GET /api/downloads/:id - Get download status
    this.app.get('/api/downloads/:id', async (req, res) => {
      try {
        const downloadId = req.params.id;
        const progress = await this.downloadService.getProgress(downloadId);
        
        res.json({
          downloadId,
          status: progress?.status || 'unknown',
          progress: progress?.percentage || 0,
          completed: progress?.completed || 0,
          total: progress?.total || 0,
          errors: progress?.errors || []
        });
        
      } catch (error) {
        console.error('Error fetching download status:', error);
        res.status(500).json({ error: 'Failed to fetch download status' });
      }
    });
    
    // DELETE /api/downloads/:id - Cancel download
    this.app.delete('/api/downloads/:id', async (req, res) => {
      try {
        const downloadId = req.params.id;
        await this.downloadService.cancelDownload(downloadId);
        res.status(204).send();
      } catch (error) {
        console.error('Error cancelling download:', error);
        res.status(500).json({ error: 'Failed to cancel download' });
      }
    });
  }
  
  private async searchCharts(params: ChartSearchRequest): Promise<Chart[]> {
    let charts = await this.database.findAll();
    
    // Apply search filters
    if (params.query) {
      const query = params.query.toLowerCase();
      charts = charts.filter(chart =>
        chart.title.toLowerCase().includes(query) ||
        chart.artist.toLowerCase().includes(query)
      );
    }
    
    if (params.artist) {
      charts = charts.filter(chart => chart.artist === params.artist);
    }
    
    if (params.titleContains) {
      const title = params.titleContains.toLowerCase();
      charts = charts.filter(chart => chart.title.toLowerCase().includes(title));
    }
    
    if (params.minBpm) {
      charts = charts.filter(chart => parseInt(chart.bpm) >= params.minBpm!);
    }
    
    if (params.maxBpm) {
      charts = charts.filter(chart => parseInt(chart.bpm) <= params.maxBpm!);
    }
    
    if (params.minDifficulty) {
      charts = charts.filter(chart => 
        chart.difficulties && Math.max(...chart.difficulties) >= params.minDifficulty!
      );
    }
    
    if (params.maxDifficulty) {
      charts = charts.filter(chart => 
        chart.difficulties && Math.min(...chart.difficulties) <= params.maxDifficulty!
      );
    }
    
    if (params.sources && params.sources.length > 0) {
      charts = charts.filter(chart => params.sources!.includes(chart.source));
    }
    
    // Apply sorting
    const sortBy = params.sortBy || 'title';
    const sortOrder = params.sortOrder || 'asc';
    
    charts.sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortBy) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'artist':
          aVal = a.artist.toLowerCase();
          bVal = b.artist.toLowerCase();
          break;
        case 'bpm':
          aVal = parseInt(a.bpm);
          bVal = parseInt(b.bpm);
          break;
        case 'difficulty':
          aVal = a.difficulties ? Math.max(...a.difficulties) : 0;
          bVal = b.difficulties ? Math.max(...b.difficulties) : 0;
          break;
        case 'createdAt':
          aVal = new Date(a.createdAt || 0);
          bVal = new Date(b.createdAt || 0);
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    // Apply pagination
    const offset = params.offset || 0;
    const limit = params.limit || 100;
    
    return charts.slice(offset, offset + limit);
  }
  
  private getSourceBaseUrl(sourceName: string): string {
    switch (sourceName) {
      case 'approved-dtx':
        return 'http://approvedtx.blogspot.com/';
      default:
        return '';
    }
  }
  
  public async start(port: number = 3001): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        console.log(`DTX API Server running on http://localhost:${port}`);
        console.log(`GUI available at http://localhost:${port}/gui`);
        resolve();
      });
    });
  }
}

// Start server if called directly
if (require.main === module) {
  const server = new DTXApiServer();
  server.start().catch(console.error);
}
