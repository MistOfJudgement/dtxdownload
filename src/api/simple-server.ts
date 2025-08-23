/**
 * Simple API server to connect GUI with backend
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { ChartDatabase } from '../core/database/database';
import { ScrapingService } from '../scraping/scraping-service';
import { ApprovedDtxStrategy } from '../scraping/strategies/approved-dtx';
import { DownloadService } from '../core/download/download-service';
import { Source } from '../scraping/interfaces';
import { 
  DownloadRequest, 
  DownloadResponse, 
  ChartsListResponse
} from '@shared/models';

// Simple API server that can be extended
export class DTXApiServer {
  private app: express.Application;
  private database: ChartDatabase;
  private scrapingService: ScrapingService;
  private downloadService: DownloadService;
  private progressStreams: Map<string, Response> = new Map();
  
  constructor(dbPath?: string) {
    this.app = express();
    
    // Initialize backend services
    this.database = new ChartDatabase(dbPath);
    this.scrapingService = new ScrapingService(dbPath);
    this.downloadService = new DownloadService(this.database);
    
    // Set up progress callback for real-time updates
    this.downloadService.setProgressCallback((downloadId, state, progress) => {
      this.broadcastProgress(downloadId, state, progress);
    });
    
    // Register scraping strategies
    this.scrapingService.registerStrategy(new ApprovedDtxStrategy());
    
    // Register sources
    const approvedDtxSource: Source = {
      name: 'approved-dtx',
      enabled: true,
      baseUrl: 'https://approvedtx.blogspot.com/',
      strategy: 'approved-dtx',
      rateLimit: 1000,
      maxPages: 10,
      settings: {}
    };
    this.scrapingService.registerSource(approvedDtxSource);
    
    this.setupMiddleware();
    this.setupRoutes();
  }
  
  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Serve GUI files from both root and /gui path with proper MIME types
    const guiPath = path.join(__dirname, '../../gui');
    
    // Set proper MIME types for static files
    this.app.use((req, res, next) => {
      if (req.path.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (req.path.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      } else if (req.path.endsWith('.html')) {
        res.setHeader('Content-Type', 'text/html');
      }
      next();
    });
    
    this.app.use(express.static(guiPath));
    this.app.use('/gui', express.static(guiPath));
  }
  
  private setupRoutes(): void {
    // Health check
    this.app.get('/api/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
    
    // Chart endpoints
    this.app.get('/api/charts', async (req: Request, res: Response) => {
      try {
        const { 
          source, 
          artist, 
          title, 
          minBpm, 
          maxBpm, 
          limit = 50, 
          offset = 0 
        } = req.query;
        
        const queryOptions: any = {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        };
        
        if (source) queryOptions.source = source as string;
        if (artist) queryOptions.artist = artist as string;
        if (title) queryOptions.title = title as string;
        if (minBpm) queryOptions.minBpm = parseInt(minBpm as string);
        if (maxBpm) queryOptions.maxBpm = parseInt(maxBpm as string);
        
        const charts = await this.database.queryCharts(queryOptions);
        
        const totalCount = await this.database.getTotalChartCount();
        
        console.log(`Found ${charts.length} charts, total count: ${totalCount}`);
        
        const response: ChartsListResponse = {
          charts: charts.map(chart => ({
            id: chart.id,
            title: chart.title,
            artist: chart.artist,
            bpm: chart.bpm,
            difficulties: chart.difficulties,
            originalPageUrl: chart.originalPageUrl,
            source: chart.source,
            tags: chart.tags,
            ...(chart.downloadUrl && { downloadUrl: chart.downloadUrl }),
            ...(chart.previewImageUrl && { imageUrl: chart.previewImageUrl }),
            ...(chart.createdAt && { createdAt: chart.createdAt.toISOString() })
          })),
          totalCount,
          hasMore: charts.length === parseInt(limit as string)
        };
        
        res.json(response);
      } catch (error) {
        console.error('Error fetching charts:', error);
        res.status(500).json({ 
          error: 'Failed to fetch charts', 
          message: error instanceof Error ? error.message : String(error) 
        });
      }
    });
    
    this.app.get('/api/charts/:id', async (req: Request, res: Response) => {
      try {
        const chart = await this.database.getChart(req.params.id);
        if (!chart) {
          res.status(404).json({ error: 'Chart not found' });
          return;
        }
        
        res.json({
          id: chart.id,
          title: chart.title,
          artist: chart.artist,
          bpm: chart.bpm,
          difficulties: chart.difficulties,
          downloadUrl: chart.downloadUrl,
          imageUrl: chart.previewImageUrl,
          source: chart.source,
          createdAt: chart.createdAt?.toISOString(),
          tags: chart.tags
        });
      } catch (error) {
        console.error('Error fetching chart:', error);
        res.status(500).json({ 
          error: 'Failed to fetch chart', 
          message: error instanceof Error ? error.message : String(error) 
        });
      }
    });
    
    // Scraping endpoints
    this.app.post('/api/scrape', async (req: Request, res: Response) => {
      try {
        const { sourceName = 'approved-dtx', maxPages = 1, requestDelay = 1000 } = req.body;
        
        const sources = this.scrapingService.getAllSupportedSources();
        const source = sources.find(s => s.name === sourceName);
        
        if (!source) {
          res.status(404).json({ error: 'Source not found' });
          return;
        }
        
        const result = await this.scrapingService.scrapeSource(source, {
          maxPages: parseInt(maxPages),
          requestDelay: parseInt(requestDelay)
        });
        
        res.json({
          sourceName: result.sourceName,
          chartsFound: result.chartsFound,
          chartsAdded: result.chartsAdded,
          chartsDuplicated: result.chartsDuplicated,
          errors: result.errors,
          duration: result.duration
        });
      } catch (error) {
        console.error('Error during scraping:', error);
        res.status(500).json({ 
          error: 'Scraping failed', 
          message: error instanceof Error ? error.message : String(error) 
        });
      }
    });
    
    this.app.get('/api/sources', (_req: Request, res: Response) => {
      const sources = this.scrapingService.getAllSupportedSources();
      res.json({
        sources: sources.map(source => ({
          name: source.name,
          baseUrl: source.baseUrl,
          enabled: source.enabled,
          strategy: source.strategy,
          rateLimit: source.rateLimit,
          maxPages: source.maxPages
        }))
      });
    });
    
    // Download progress endpoint (Server-Sent Events)
    this.app.get('/api/downloads/progress/:downloadId', (req: Request, res: Response) => {
      const downloadId = req.params.downloadId;
      
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      
      // Store the response stream for progress updates
      this.progressStreams.set(downloadId, res);
      
      // Send initial connection message
      res.write(`data: ${JSON.stringify({ type: 'connected', downloadId })}\n\n`);
      
      // Clean up when client disconnects
      req.on('close', () => {
        this.progressStreams.delete(downloadId);
      });
    });

    // Download endpoints
    this.app.post('/api/downloads', async (req: Request, res: Response) => {
      try {
        const downloadOptions: DownloadRequest = req.body;
        
        if (!downloadOptions.chartIds || !Array.isArray(downloadOptions.chartIds) || downloadOptions.chartIds.length === 0) {
          res.status(400).json({ error: 'chartIds array is required' });
          return;
        }
        
        const operation = await this.downloadService.downloadChartsById(downloadOptions.chartIds, downloadOptions);
        const successful = operation.results.filter(r => r.success).length;
        const failed = operation.results.filter(r => !r.success).length;
        
        const response: DownloadResponse = {
          downloadId: operation.downloadId,
          message: `Download completed: ${successful} successful, ${failed} failed`,
          successful,
          failed,
          total: operation.results.length,
          results: operation.results.map(result => ({
            chartId: result.chart.id,
            title: result.chart.title,
            artist: result.chart.artist,
            success: result.success,
            ...(result.error && { error: result.error }),
            ...(result.filePath && { filePath: result.filePath }),
            ...(result.fileSize && { fileSize: result.fileSize }),
            ...(result.downloadTime && { downloadTime: result.downloadTime })
          }))
        };

        res.json(response);
      } catch (error) {
        console.error('Error during download:', error);
        res.status(500).json({ 
          error: 'Download failed', 
          message: error instanceof Error ? error.message : String(error) 
        });
      }
    });
    
    // Statistics endpoint
    this.app.get('/api/stats', async (_req: Request, res: Response) => {
      try {
        const totalCharts = await this.database.getTotalChartCount();
        const chartsBySource = await this.database.getChartCountBySource();
        
        res.json({
          totalCharts,
          chartsBySource,
          sources: this.scrapingService.getAllSupportedSources().length,
          enabledSources: this.scrapingService.getEnabledSources().length
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
          error: 'Failed to fetch statistics', 
          message: error instanceof Error ? error.message : String(error) 
        });
      }
    });
    
    // Serve GUI on root
    this.app.get('/', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, '../gui/index.html'));
    });
  }

  private broadcastProgress(downloadId: string, state: any, progress: any): void {
    const stream = this.progressStreams.get(downloadId);
    if (stream) {
      const data = JSON.stringify({
        downloadId,
        state,
        progress,
        timestamp: new Date().toISOString()
      });
      
      stream.write(`data: ${data}\n\n`);
    }
  }
  
  public async start(port: number = 3001): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(port, () => {
        console.log(`🚀 DTX API Server running on http://localhost:${port}`);
        console.log(`🎮 GUI available at http://localhost:${port}/gui`);
        console.log(`🔌 Backend services integrated and ready`);
        console.log(`📊 Database: ${this.database ? 'Connected' : 'Not connected'}`);
        console.log(`🕷️  Scraping: ${this.scrapingService.getRegisteredStrategies().length} strategies registered`);
        resolve();
      });
    });
  }
  
  public close(): void {
    if (this.scrapingService) {
      this.scrapingService.close();
    }
    if (this.database) {
      this.database.close();
    }
  }
}

// Start server if called directly
if (require.main === module) {
  const dbPath = process.env.DB_PATH || './charts.db';
  const server = new DTXApiServer(dbPath);
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down server...');
    server.close();
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    console.log('🛑 Shutting down server...');
    server.close();
    process.exit(0);
  });
  
  server.start().catch(console.error);
}
