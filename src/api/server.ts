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
  public app: express.Application;
  private scrapingService: ScrapingService;
  private downloadService: DownloadService;
  private database: ChartDatabase;
  
  constructor() {
    this.app = express();
    this.scrapingService = new ScrapingService();
    this.database = new ChartDatabase();
    this.downloadService = new DownloadService(this.database);
    
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
    this.app.get('/api/charts/:id', async (req: Request, res: Response): Promise<void> => {
      try {
        const chart = await this.database.getChart(req.params.id);
        if (!chart) {
          res.status(404).json({ error: 'Chart not found' });
          return;
        }
        res.json(chart);
      } catch (error) {
        console.error('Error finding chart:', error);
        res.status(500).json({ error: 'Failed to find chart' });
      }
    });

    // GET /api/charts/:id/inspect - Get detailed chart information for debugging
    this.app.get('/api/charts/:id/inspect', async (req: Request, res: Response): Promise<void> => {
      try {
        const chart = await this.database.getChart(req.params.id);
        if (!chart) {
          res.status(404).json({ error: 'Chart not found' });
          return;
        }
        
        // Return detailed information for debugging
        res.json({
          chart,
          downloadUrl: chart.downloadUrl,
          isGoogleDrive: chart.downloadUrl?.includes('drive.google.com'),
          urlType: chart.downloadUrl?.includes('/file/') ? 'file' : 
                   chart.downloadUrl?.includes('/folders/') ? 'folder' : 'unknown',
          metadata: {
            hasPreviewImage: !!chart.previewImageUrl,
            difficulties: chart.difficulties,
            tags: chart.tags,
            source: chart.source,
            createdAt: chart.createdAt,
            updatedAt: chart.updatedAt
          }
        });
      } catch (error) {
        console.error('Error inspecting chart:', error);
        res.status(500).json({ error: 'Failed to inspect chart' });
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
        const totalCount = await this.database.getTotalChartCount();
        const countBySource = await this.database.getChartCountBySource();
        
        res.json({
          totalCharts: totalCount,
          chartsBySource: countBySource,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error getting chart stats:', error);
        res.status(500).json({ error: 'Failed to get chart stats' });
      }
    });

    // GET /api/debug/database - Debug database state
    this.app.get('/api/debug/database', async (_req: Request, res: Response) => {
      try {
        const totalCount = await this.database.getTotalChartCount();
        const countBySource = await this.database.getChartCountBySource();
        const recentCharts = await this.database.queryCharts({ limit: 5, sortBy: 'createdAt', sortOrder: 'DESC' });
        
        res.json({
          totalCharts: totalCount,
          chartsBySource: countBySource,
          recentCharts: recentCharts.map(chart => ({
            id: chart.id,
            title: chart.title,
            artist: chart.artist,
            source: chart.source,
            hasDownloadUrl: !!chart.downloadUrl,
            createdAt: chart.createdAt
          })),
          databaseInfo: {
            hasData: totalCount > 0,
            needsScraping: totalCount === 0
          },
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error getting database debug info:', error);
        res.status(500).json({ error: 'Failed to get database debug info' });
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
          rateLimit: 2000,
          settings: {}
        };
        
        // Start scraping process
        const result = await this.scrapingService.scrapeSource(source);
        
        res.json({
          sourceName: source.name,
          chartsFound: result.chartsFound,
          chartsAdded: result.chartsAdded,
          chartsDuplicated: result.chartsDuplicated,
          errors: result.errors,
          duration: result.duration,
          nextScrapeTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
        
      } catch (error) {
        console.error('Error during scraping:', error);
        res.status(500).json({ 
          error: 'Scraping failed: ' + (error instanceof Error ? error.message : String(error))
        });
      }
    });
    
    // GET /api/scrape/sources - Get available sources
    this.app.get('/api/scrape/sources', (_req, res) => {
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
        const charts: IChart[] = [];
        for (const chartId of downloadRequest.chartIds) {
          const chart = await this.database.getChart(chartId);
          if (chart) {
            charts.push(chart);
          }
        }

        if (charts.length === 0) {
          return res.status(400).json({ error: 'No valid charts found' });
        }

        // Start download process with proper method
        const downloadResult = await this.downloadService.downloadChartsById(
          downloadRequest.chartIds,
          {
            downloadDir: downloadRequest.destination || './downloads',
            maxConcurrency: downloadRequest.concurrency || 3,
            overwrite: !downloadRequest.skipExisting
          }
        );
        
        return res.json({
          downloadId: downloadResult.downloadId,
          status: 'started',
          chartCount: charts.length,
          startTime: new Date().toISOString()
        });

      } catch (error) {
        console.error('Error starting download:', error);
        return res.status(500).json({ 
          error: 'Failed to start download: ' + (error instanceof Error ? error.message : String(error))
        });
      }
    });
    
    // GET /api/downloads/:id - Get download status
    this.app.get('/api/downloads/:id', async (req, res) => {
      try {
        const downloadId = req.params.id;
        
        // Since DownloadService doesn't have getProgress method yet,
        // return a basic response
        res.json({
          downloadId,
          status: 'completed', // Simplified for now
          progress: 100,
          completed: 0,
          total: 0,
          errors: []
        });
        
      } catch (error) {
        console.error('Error fetching download status:', error);
        res.status(500).json({ error: 'Failed to fetch download status' });
      }
    });
    
    // DELETE /api/downloads/:id - Cancel download
    this.app.delete('/api/downloads/:id', async (_req, res) => {
      try {
        // Since DownloadService doesn't have cancelDownload method yet,
        // return a success response
        res.status(204).send();
      } catch (error) {
        console.error('Error cancelling download:', error);
        res.status(500).json({ error: 'Failed to cancel download' });
      }
    });
  }
  
  private async searchCharts(params: ChartSearchRequest): Promise<IChart[]> {
    let charts = await this.database.queryCharts();
    
    // Apply search filters
    if (params.query) {
      const query = params.query.toLowerCase();
      charts = charts.filter((chart: IChart) =>
        chart.title.toLowerCase().includes(query) ||
        chart.artist.toLowerCase().includes(query)
      );
    }
    
    if (params.artist) {
      charts = charts.filter((chart: IChart) => chart.artist === params.artist);
    }
    
    if (params.titleContains) {
      const title = params.titleContains.toLowerCase();
      charts = charts.filter((chart: IChart) => chart.title.toLowerCase().includes(title));
    }
    
    if (params.minBpm) {
      charts = charts.filter((chart: IChart) => parseInt(chart.bpm) >= params.minBpm!);
    }
    
    if (params.maxBpm) {
      charts = charts.filter((chart: IChart) => parseInt(chart.bpm) <= params.maxBpm!);
    }
    
    if (params.minDifficulty) {
      charts = charts.filter((chart: IChart) => 
        chart.difficulties && Math.max(...chart.difficulties) >= params.minDifficulty!
      );
    }
    
    if (params.maxDifficulty) {
      charts = charts.filter((chart: IChart) => 
        chart.difficulties && Math.min(...chart.difficulties) <= params.maxDifficulty!
      );
    }
    
    if (params.sources && params.sources.length > 0) {
      charts = charts.filter((chart: IChart) => params.sources!.includes(chart.source));
    }
    
    // Apply sorting
    const sortBy = params.sortBy || 'title';
    const sortOrder = params.sortOrder || 'asc';
    
    charts.sort((a: IChart, b: IChart) => {
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

// Export for Electron main process
export function createApp(): express.Application {
  const server = new DTXApiServer();
  return server.app;
}
