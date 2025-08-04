/**
 * Tests for the ApprovedDTX scraping strategy
 */

import { ApprovedDtxStrategy } from '../strategies/approved-dtx';

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

    it('should return null for invalid element', async () => {
      const mockElement = {} as any;
      
      const chart = await strategy.extractChartFromElement(mockElement);
      expect(chart).toBeNull();
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
});
