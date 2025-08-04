/**
 * Tests for the ApprovedDTX scraping strategy
 */

import { ApprovedDtxStrategy } from '../strategies/approved-dtx';
import { Source } from '../interfaces';

describe('ApprovedDtxStrategy', () => {
  let strategy: ApprovedDtxStrategy;
  let mockSource: Source;

  beforeEach(() => {
    strategy = new ApprovedDtxStrategy();
    mockSource = {
      name: 'approved-dtx',
      enabled: true,
      baseUrl: 'http://approvedtx.blogspot.com/',
      strategy: 'approved-dtx',
      rateLimit: 1000,
      maxPages: 5,
      settings: {}
    };
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
      // Mock HTML element with typical ApprovedDTX format
      const mockHtml = `
        <div>
          Test Song / Test Artist
          140BPM : 5.5/6.0/7.2
          <img src="https://example.com/image.jpg" />
          <a href="https://example.com/link1">Link 1</a>
          <a href="https://drive.google.com/file/d/test123/view">Download</a>
        </div>
      `;

      const mockElement = {
        type: 'tag',
        name: 'div',
        children: []
      } as any;

      // Mock cheerio.load to return our test HTML
      const originalLoad = require('cheerio').load;
      require('cheerio').load = jest.fn().mockReturnValue({
        text: () => 'Test Song / Test Artist\n140BPM : 5.5/6.0/7.2',
        find: jest.fn().mockImplementation((selector: string) => {
          if (selector === 'a') {
            return {
              length: 2,
              eq: jest.fn().mockImplementation((index: number) => ({
                attr: jest.fn().mockReturnValue(
                  index === 1 ? 'https://drive.google.com/file/d/test123/view' : 'https://example.com/link1'
                )
              }))
            };
          }
          if (selector === 'img') {
            return {
              first: () => ({
                attr: jest.fn().mockReturnValue('https://example.com/image.jpg')
              })
            };
          }
          return { length: 0 };
        }),
        '*': {
          text: () => 'Test Song / Test Artist\n140BPM : 5.5/6.0/7.2'
        }
      });

      const chart = await strategy.extractChartFromElement(mockElement);

      expect(chart).toEqual({
        id: expect.stringContaining('test-song-test-artist'),
        title: 'Test Song',
        artist: 'Test Artist',
        bpm: '140BPM',
        difficulties: [5.5, 6.0, 7.2],
        downloadUrl: 'https://drive.google.com/file/d/test123/view',
        source: 'approved-dtx',
        previewImageUrl: 'https://example.com/image.jpg',
        tags: ['dtx', 'drum'],
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      });

      // Restore original function
      require('cheerio').load = originalLoad;
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
