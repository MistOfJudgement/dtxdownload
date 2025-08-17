/**
 * Tests for API models to ensure proper typing and validation
 */

import {
  DownloadRequest,
  DownloadResponse,
  ChartsListResponse,
  ScrapeRequest,
  ScrapeResult,
  SourcesResponse,
  StatsResponse,
  ProgressUpdate,
  ApiResponse
} from '../../src/api/models';

describe('API Models', () => {
  describe('DownloadRequest', () => {
    it('should accept minimal download request', () => {
      const request: DownloadRequest = {
        chartIds: ['chart1', 'chart2']
      };
      
      expect(request.chartIds).toEqual(['chart1', 'chart2']);
      expect(request.downloadDir).toBeUndefined();
      expect(request.maxConcurrency).toBeUndefined();
    });

    it('should accept full download request', () => {
      const request: DownloadRequest = {
        chartIds: ['chart1'],
        downloadDir: './downloads/test',
        maxConcurrency: 5,
        organizeSongFolders: true,
        autoUnzip: true,
        deleteZipAfterExtraction: false,
        overwrite: true
      };
      
      expect(request.chartIds).toEqual(['chart1']);
      expect(request.downloadDir).toBe('./downloads/test');
      expect(request.maxConcurrency).toBe(5);
      expect(request.organizeSongFolders).toBe(true);
      expect(request.autoUnzip).toBe(true);
      expect(request.deleteZipAfterExtraction).toBe(false);
      expect(request.overwrite).toBe(true);
    });
  });

  describe('DownloadResponse', () => {
    it('should have correct structure', () => {
      const response: DownloadResponse = {
        downloadId: 'download-123',
        message: 'Download completed: 2 successful, 1 failed',
        successful: 2,
        failed: 1,
        total: 3,
        results: [
          {
            chartId: 'chart1',
            title: 'Song 1',
            artist: 'Artist 1',
            success: true,
            filePath: './downloads/song1.zip',
            fileSize: 1024,
            downloadTime: 500
          },
          {
            chartId: 'chart2',
            title: 'Song 2',
            artist: 'Artist 2',
            success: false,
            error: 'Download failed'
          }
        ]
      };
      
      expect(response.downloadId).toBe('download-123');
      expect(response.successful).toBe(2);
      expect(response.failed).toBe(1);
      expect(response.total).toBe(3);
      expect(response.results).toHaveLength(2);
      expect(response.results[0].success).toBe(true);
      expect(response.results[1].success).toBe(false);
      expect(response.results[1].error).toBe('Download failed');
    });
  });

  describe('ChartsListResponse', () => {
    it('should have correct structure', () => {
      const response: ChartsListResponse = {
        charts: [
          {
            id: 'chart1',
            title: 'Test Song',
            artist: 'Test Artist',
            bpm: '120',
            difficulties: [1, 3, 5],
            downloadUrl: 'https://example.com/chart1.zip',
            source: 'approved-dtx',
            tags: ['rock', 'medium'],
            imageUrl: 'https://example.com/preview.jpg',
            createdAt: '2023-01-01T00:00:00.000Z'
          }
        ],
        totalCount: 100,
        hasMore: true
      };
      
      expect(response.charts).toHaveLength(1);
      expect(response.charts[0].id).toBe('chart1');
      expect(response.charts[0].difficulties).toEqual([1, 3, 5]);
      expect(response.totalCount).toBe(100);
      expect(response.hasMore).toBe(true);
    });

    it('should allow minimal chart response', () => {
      const response: ChartsListResponse = {
        charts: [
          {
            id: 'chart1',
            title: 'Test Song',
            artist: 'Test Artist',
            bpm: '120',
            difficulties: [1],
            downloadUrl: 'https://example.com/chart1.zip',
            source: 'approved-dtx',
            tags: []
          }
        ],
        totalCount: 1,
        hasMore: false
      };
      
      expect(response.charts[0].imageUrl).toBeUndefined();
      expect(response.charts[0].createdAt).toBeUndefined();
      expect(response.charts[0].tags).toEqual([]);
    });
  });

  describe('ScrapeRequest and ScrapeResult', () => {
    it('should handle scrape request', () => {
      const request: ScrapeRequest = {
        sourceName: 'approved-dtx',
        maxPages: 5,
        requestDelay: 1000
      };
      
      expect(request.sourceName).toBe('approved-dtx');
      expect(request.maxPages).toBe(5);
      expect(request.requestDelay).toBe(1000);
    });

    it('should handle scrape result', () => {
      const result: ScrapeResult = {
        sourceName: 'approved-dtx',
        chartsFound: 25,
        chartsAdded: 20,
        chartsDuplicated: 5,
        errors: ['Failed to parse page 3'],
        duration: 30000
      };
      
      expect(result.sourceName).toBe('approved-dtx');
      expect(result.chartsFound).toBe(25);
      expect(result.chartsAdded).toBe(20);
      expect(result.chartsDuplicated).toBe(5);
      expect(result.errors).toEqual(['Failed to parse page 3']);
      expect(result.duration).toBe(30000);
    });
  });

  describe('SourcesResponse and StatsResponse', () => {
    it('should handle sources response', () => {
      const response: SourcesResponse = {
        sources: [
          {
            name: 'approved-dtx',
            baseUrl: 'https://approvedtx.blogspot.com/',
            enabled: true,
            strategy: 'approved-dtx',
            rateLimit: 1000,
            maxPages: 10
          }
        ]
      };
      
      expect(response.sources).toHaveLength(1);
      expect(response.sources[0].name).toBe('approved-dtx');
      expect(response.sources[0].enabled).toBe(true);
    });

    it('should handle stats response', () => {
      const response: StatsResponse = {
        totalCharts: 500,
        chartsBySource: {
          'approved-dtx': 300,
          'other-source': 200
        },
        sources: 2,
        enabledSources: 2
      };
      
      expect(response.totalCharts).toBe(500);
      expect(response.chartsBySource['approved-dtx']).toBe(300);
      expect(response.sources).toBe(2);
      expect(response.enabledSources).toBe(2);
    });
  });

  describe('ProgressUpdate', () => {
    it('should handle progress update', () => {
      const update: ProgressUpdate = {
        downloadId: 'download-123',
        state: { status: 'downloading', currentChart: 'chart1' },
        progress: { completed: 1, total: 3, percentage: 33.33 },
        timestamp: '2023-01-01T12:00:00.000Z'
      };
      
      expect(update.downloadId).toBe('download-123');
      expect(update.state.status).toBe('downloading');
      expect(update.progress.completed).toBe(1);
      expect(update.timestamp).toBe('2023-01-01T12:00:00.000Z');
    });
  });

  describe('ApiResponse', () => {
    it('should handle generic API response', () => {
      const successResponse: ApiResponse<string> = {
        success: true,
        data: 'Operation completed',
        message: 'Success'
      };
      
      expect(successResponse.success).toBe(true);
      expect(successResponse.data).toBe('Operation completed');
      expect(successResponse.error).toBeUndefined();

      const errorResponse: ApiResponse = {
        success: false,
        error: 'Something went wrong',
        message: 'Error occurred'
      };
      
      expect(errorResponse.success).toBe(false);
      expect(errorResponse.error).toBe('Something went wrong');
      expect(errorResponse.data).toBeUndefined();
    });
  });
});
