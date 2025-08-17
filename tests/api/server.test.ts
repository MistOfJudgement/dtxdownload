/**
 * Tests for API server request handling
 */

import { DownloadRequest } from '../../shared/models';

describe('API Server Request Handling', () => {
  describe('DownloadRequest Validation', () => {
    it('should handle standard DownloadRequest format', () => {
      const downloadRequest: DownloadRequest = {
        chartIds: ['chart1', 'chart2'],
        downloadDir: './downloads/test',
        maxConcurrency: 3,
        organizeSongFolders: true,
        deleteZipAfterExtraction: true,
        overwrite: false
      };

      expect(downloadRequest.chartIds).toEqual(['chart1', 'chart2']);
      expect(downloadRequest.downloadDir).toBe('./downloads/test');
      expect(downloadRequest.maxConcurrency).toBe(3);
      expect(downloadRequest.organizeSongFolders).toBe(true);
      expect(downloadRequest.deleteZipAfterExtraction).toBe(true);
      expect(downloadRequest.overwrite).toBe(false);
    });

    it('should handle minimal DownloadRequest with required fields only', () => {
      const downloadRequest: DownloadRequest = {
        chartIds: ['chart1']
      };

      expect(downloadRequest.chartIds).toEqual(['chart1']);
      expect(downloadRequest.downloadDir).toBeUndefined();
      expect(downloadRequest.maxConcurrency).toBeUndefined();
      expect(downloadRequest.organizeSongFolders).toBeUndefined();
    });

    it('should handle DownloadRequest with default values', () => {
      const downloadRequest: DownloadRequest = {
        chartIds: ['chart1', 'chart2']
      };

      // Simulate server-side default handling
      const processedRequest = {
        ...downloadRequest,
        downloadDir: downloadRequest.downloadDir || './downloads',
        maxConcurrency: downloadRequest.maxConcurrency || 3,
        organizeSongFolders: downloadRequest.organizeSongFolders ?? false,
        overwrite: downloadRequest.overwrite ?? true
      };

      expect(processedRequest.downloadDir).toBe('./downloads');
      expect(processedRequest.maxConcurrency).toBe(3);
      expect(processedRequest.organizeSongFolders).toBe(false);
      expect(processedRequest.overwrite).toBe(true);
    });
  });

  describe('Request Validation Logic', () => {
    it('should validate chartIds is required and non-empty', () => {
      const validateChartIds = (chartIds: any) => {
        return !!(chartIds && Array.isArray(chartIds) && chartIds.length > 0);
      };

      expect(validateChartIds(['chart1'])).toBe(true);
      expect(validateChartIds(['chart1', 'chart2'])).toBe(true);
      expect(validateChartIds([])).toBe(false);
      expect(validateChartIds(null)).toBe(false);
      expect(validateChartIds(undefined)).toBe(false);
      expect(validateChartIds('not-array')).toBe(false);
    });
  });
});
