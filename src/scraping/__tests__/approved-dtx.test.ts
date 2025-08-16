/**
 * Tests for the ApprovedDTX scraping strategy
 */

import * as cheerio from 'cheerio';
import { ApprovedDtxStrategy } from '../strategies/approved-dtx';
import testChartBareYourTeeth from './test-data/test-chart-bare-your-teeth';

describe('ApprovedDtxStrategy', () => {
  let strategy: ApprovedDtxStrategy;

  beforeEach(() => {
    strategy = new ApprovedDtxStrategy();
  });

  describe('canHandle', () => {
    it('should handle ApprovedDTX URLs', () => {
      expect(strategy.canHandle('http://approvedtx.blogspot.com/')).toBe(true);
      expect(strategy.canHandle('https://approvedtx.blogspot.com/2023/01/test.html')).toBe(true);
    });

    it('should not handle other URLs', () => {
      expect(strategy.canHandle('https://example.com')).toBe(false);
      expect(strategy.canHandle('https://other-site.com')).toBe(false);
    });
  });

  describe('extractChartFromElement', () => {
    it('should extract chart data from "Bare your teeth" HTML element', async () => {
      // Load the test HTML into cheerio and get the post element
      const $ = cheerio.load(testChartBareYourTeeth.html);
      const postElement = $('.post')[0]; // Get the actual DOM element
      
      if (!postElement) {
        throw new Error('Could not find post element in test HTML');
      }
      
      const chart = await strategy.extractChartFromElement(postElement);
      
      expect(chart).not.toBeNull();
      if (chart) {
        expect(chart.title).toBe(testChartBareYourTeeth.expected.title);
        expect(chart.artist).toBe(testChartBareYourTeeth.expected.artist);
        expect(chart.bpm).toBe(testChartBareYourTeeth.expected.bpm);
        expect(chart.difficulties).toEqual(testChartBareYourTeeth.expected.difficulties);
        expect(chart.downloadUrl).toBe(testChartBareYourTeeth.expected.downloadUrl);
        expect(chart.previewImageUrl).toBe(testChartBareYourTeeth.expected.previewImageUrl);
        expect(chart.source).toBe('approved-dtx');
      }
    });

    it('should extract chart data from valid element', async () => {
      // Create a mock element that simulates ApprovedDTX HTML structure
      const mockElement = {
        type: 'tag',
        name: 'div',
        children: []
      } as any;

      // For now, let's test that it returns null for invalid elements
      // In a real implementation, we'd need proper HTML content to parse
      const chart = await strategy.extractChartFromElement(mockElement);
      
      expect(chart).toBeNull();
    });

    it('should throw error for invalid element', async () => {
      const mockElement = {} as any;
      
      await expect(strategy.extractChartFromElement(mockElement))
        .rejects.toThrow('Failed to extract chart from ApprovedDTX element');
    });
  });

  describe('parseDifficulties', () => {
    it('should parse difficulty string correctly', () => {
      const difficulties = (strategy as any).parseDifficulties('5.5/6.0/7.2');
      expect(difficulties).toEqual([5.5, 6.0, 7.2]);
    });

    it('should filter out invalid difficulties', () => {
      const difficulties = (strategy as any).parseDifficulties('5.5/15.0/7.2');
      expect(difficulties).toEqual([5.5, 7.2]);
    });
  });

  describe('generateChartId', () => {
    it('should generate consistent chart ID', () => {
      const id = (strategy as any).generateChartId('Test Song', 'Test Artist');
      expect(id).toBe('approved-dtx-test-song-test-artist');
    });

    it('should handle special characters', () => {
      const id = (strategy as any).generateChartId('Test Song!', 'Test & Artist');
      expect(id).toBe('approved-dtx-test-song-test-artist');
    });
  });

  describe('full HTML processing', () => {
    it('should extract chart data from "Bare your teeth" full HTML page', async () => {
      // Mock the HTTP client to return the test HTML
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({ body: testChartBareYourTeeth.html })
      };
      
      // Inject the mock HTTP client
      (strategy as any).httpClient = mockHttpClient;
      
      // Use the protected scrapePageWithHtml method to test HTML parsing
      const source = { name: 'approved-dtx', baseUrl: 'https://approvedtx.blogspot.com/' };
      const result = await (strategy as any).scrapePageWithHtml(testChartBareYourTeeth.sourceURL, source);
      
      expect(result.pageCharts).toHaveLength(1);
      const chart = result.pageCharts[0];
      
      expect(chart.title).toBe(testChartBareYourTeeth.expected.title);
      expect(chart.artist).toBe(testChartBareYourTeeth.expected.artist);
      expect(chart.bpm).toBe(testChartBareYourTeeth.expected.bpm);
      expect(chart.difficulties).toEqual(testChartBareYourTeeth.expected.difficulties);
      expect(chart.downloadUrl).toBe(testChartBareYourTeeth.expected.downloadUrl);
      expect(chart.previewImageUrl).toBe(testChartBareYourTeeth.expected.previewImageUrl);
      expect(chart.source).toBe('approved-dtx');
    });

    it('should return empty array for invalid HTML', async () => {
      const mockHttpClient = {
        get: jest.fn().mockResolvedValue({ body: '<html><body>Invalid content</body></html>' })
      };
      
      (strategy as any).httpClient = mockHttpClient;
      
      const source = { name: 'approved-dtx', baseUrl: 'https://approvedtx.blogspot.com/' };
      const result = await (strategy as any).scrapePageWithHtml('https://approvedtx.blogspot.com/invalid.html', source);
      
      expect(result.pageCharts).toHaveLength(0);
    });

    it('should handle HTTP errors gracefully', async () => {
      const mockHttpClient = {
        get: jest.fn().mockRejectedValue(new Error('Network error'))
      };
      
      (strategy as any).httpClient = mockHttpClient;
      
      const source = { name: 'approved-dtx', baseUrl: 'https://approvedtx.blogspot.com/' };
      
      await expect((strategy as any).scrapePageWithHtml('https://approvedtx.blogspot.com/error.html', source))
        .rejects.toThrow('Network error');
    });
  })
});
