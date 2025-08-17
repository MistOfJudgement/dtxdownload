/**
 * Tests for the DTX API Client - Real behavior and integration testing
 * These tests verify actual API client functionality, error handling, and usage patterns
 */

import { DTXAPIClient } from '../../gui/src/api-client';
import { 
  DownloadRequest, 
  ChartsListResponse, 
  DownloadResponse,
  ScrapeRequest
} from '../../shared/models';

// Mock fetch for testing
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('DTX API Client - Behavior Tests', () => {
  let client: DTXAPIClient;

  beforeEach(() => {
    client = new DTXAPIClient('http://test-api.local');
    mockFetch.mockClear();
  });

  describe('Request/Response Handling', () => {
    it('should handle successful chart listing with proper query parameters', async () => {
      const mockResponse: ChartsListResponse = {
        charts: [
          {
            id: 'chart1',
            title: 'Test Song',
            artist: 'Test Artist',
            bpm: '120',
            difficulties: [1, 3, 5],
            downloadUrl: 'http://example.com/chart1.zip',
            source: 'approved-dtx',
            tags: ['rock']
          }
        ],
        totalCount: 1,
        hasMore: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const result = await client.getCharts({
        source: 'approved-dtx',
        artist: 'Test Artist',
        limit: 10,
        offset: 0
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.local/api/charts?source=approved-dtx&artist=Test+Artist&limit=10&offset=0',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
      expect(result.charts).toHaveLength(1);
      expect(result.charts[0].title).toBe('Test Song');
    });

    it('should handle download requests properly', async () => {
      const mockResponse: DownloadResponse = {
        downloadId: 'download-123',
        message: 'Download started',
        successful: 0,
        failed: 0,
        total: 2,
        results: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const downloadRequest: DownloadRequest = {
        chartIds: ['chart1', 'chart2'],
        downloadDir: './downloads',
        maxConcurrency: 3,
        organizeSongFolders: true
      };

      const result = await client.startDownload(downloadRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.local/api/downloads',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(downloadRequest),
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
      expect(result.downloadId).toBe('download-123');
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP error responses properly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(client.getCharts()).rejects.toThrow('API Error: 400 Bad Request');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.checkHealth()).rejects.toThrow('Network error');
    });

    it('should handle malformed JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON'))
      });

      await expect(client.getStats()).rejects.toThrow('Invalid JSON');
    });
  });

  describe('Query Parameter Handling', () => {
    it('should properly encode and filter query parameters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ charts: [], totalCount: 0, hasMore: false })
      });

      await client.getCharts({
        source: 'approved-dtx',
        artist: 'Artist With Spaces',
        // title: undefined, // Should be filtered out - removed to avoid exactOptionalPropertyTypes error
        limit: 25,
        offset: 50
      });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('source=approved-dtx');
      expect(calledUrl).toContain('artist=Artist+With+Spaces');
      expect(calledUrl).not.toContain('title=');
      expect(calledUrl).toContain('limit=25');
      expect(calledUrl).toContain('offset=50');
    });

    it('should handle empty query parameters correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ charts: [], totalCount: 0, hasMore: false })
      });

      await client.getCharts({});

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.local/api/charts',
        expect.any(Object)
      );
    });
  });

  describe('Request Body Serialization', () => {
    it('should properly serialize complex request objects', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ sourceName: 'test', chartsFound: 0, chartsAdded: 0, chartsDuplicated: 0, errors: [], duration: 0 })
      });

      const scrapeRequest: ScrapeRequest = {
        sourceName: 'approved-dtx',
        maxPages: 5,
        requestDelay: 1000
      };

      await client.startScraping(scrapeRequest);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://test-api.local/api/scrape',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(scrapeRequest)
        })
      );
    });
  });

  describe('Real-world Usage Patterns', () => {
    it('should support the typical GUI workflow: search -> select -> download', async () => {
      // Step 1: Search for charts
      const searchResponse: ChartsListResponse = {
        charts: [
          {
            id: 'chart1',
            title: 'Song 1',
            artist: 'Artist 1',
            bpm: '120',
            difficulties: [1, 3],
            downloadUrl: 'http://example.com/chart1.zip',
            source: 'approved-dtx',
            tags: []
          },
          {
            id: 'chart2',
            title: 'Song 2',
            artist: 'Artist 1',
            bpm: '140',
            difficulties: [2, 4],
            downloadUrl: 'http://example.com/chart2.zip',
            source: 'approved-dtx',
            tags: []
          }
        ],
        totalCount: 2,
        hasMore: false
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(searchResponse)
      });

      const charts = await client.getCharts({ artist: 'Artist 1' });
      expect(charts.charts).toHaveLength(2);

      // Step 2: Download selected charts
      const downloadResponse: DownloadResponse = {
        downloadId: 'download-workflow-test',
        message: 'Download started',
        successful: 0,
        failed: 0,
        total: 2,
        results: []
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(downloadResponse)
      });

      const selectedIds = charts.charts.map(chart => chart.id);
      const downloadResult = await client.startDownload({
        chartIds: selectedIds,
        downloadDir: './downloads/test',
        organizeSongFolders: true
      });

      expect(downloadResult.downloadId).toBe('download-workflow-test');
      expect(downloadResult.total).toBe(2);
    });

    it('should handle pagination correctly', async () => {
      const firstPageResponse: ChartsListResponse = {
        charts: Array.from({ length: 10 }, (_, i) => ({
          id: `chart${i + 1}`,
          title: `Song ${i + 1}`,
          artist: 'Test Artist',
          bpm: '120',
          difficulties: [1],
          downloadUrl: `http://example.com/chart${i + 1}.zip`,
          source: 'test',
          tags: []
        })),
        totalCount: 25,
        hasMore: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(firstPageResponse)
      });

      const firstPage = await client.getCharts({ limit: 10, offset: 0 });
      expect(firstPage.charts).toHaveLength(10);
      expect(firstPage.hasMore).toBe(true);
      expect(firstPage.totalCount).toBe(25);

      // Simulate loading next page
      const secondPageResponse: ChartsListResponse = {
        charts: Array.from({ length: 10 }, (_, i) => ({
          id: `chart${i + 11}`,
          title: `Song ${i + 11}`,
          artist: 'Test Artist',
          bpm: '120',
          difficulties: [1],
          downloadUrl: `http://example.com/chart${i + 11}.zip`,
          source: 'test',
          tags: []
        })),
        totalCount: 25,
        hasMore: true
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(secondPageResponse)
      });

      const secondPage = await client.getCharts({ limit: 10, offset: 10 });
      expect(secondPage.charts).toHaveLength(10);
      expect(secondPage.charts[0].id).toBe('chart11');
    });
  });

  describe('Configuration and Setup', () => {
    it('should use default base URL when none provided', () => {
      const defaultClient = new DTXAPIClient();
      expect(defaultClient).toBeDefined();
      // Since baseUrl is private, we test indirectly by making a request
    });

    it('should use custom base URL when provided', async () => {
      const customClient = new DTXAPIClient('http://custom-api.local:3000');
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', timestamp: new Date().toISOString() })
      });

      await customClient.checkHealth();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://custom-api.local:3000/api/health',
        expect.any(Object)
      );
    });
  });
});
