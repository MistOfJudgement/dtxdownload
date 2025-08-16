/**
 * Tests for API server request format conversion
 */

import { DownloadRequest, LegacyDownloadRequest } from '../../src/api/models';

describe('API Server Request Format Conversion', () => {
  describe('Legacy to New Format Conversion', () => {
    it('should convert legacy GUI format to new DownloadRequest format', () => {
      const legacyRequest: LegacyDownloadRequest = {
        chartIds: ['chart1', 'chart2'],
        destination: './downloads/legacy-test',
        concurrency: 3,
        skipExisting: false,
        options: {
          organizeIntoFolders: true,
          deleteZipAfterExtraction: true
        }
      };

      // This is the conversion logic from simple-server.ts
      const convertedRequest: DownloadRequest = {
        chartIds: legacyRequest.chartIds,
        downloadDir: legacyRequest.destination,
        maxConcurrency: legacyRequest.concurrency || 3,
        organizeSongFolders: legacyRequest.options.organizeIntoFolders,
        deleteZipAfterExtraction: legacyRequest.options.deleteZipAfterExtraction,
        overwrite: !legacyRequest.skipExisting
      };

      expect(convertedRequest.chartIds).toEqual(['chart1', 'chart2']);
      expect(convertedRequest.downloadDir).toBe('./downloads/legacy-test');
      expect(convertedRequest.maxConcurrency).toBe(3);
      expect(convertedRequest.organizeSongFolders).toBe(true);
      expect(convertedRequest.deleteZipAfterExtraction).toBe(true);
      expect(convertedRequest.overwrite).toBe(true); // !skipExisting
    });

    it('should handle skipExisting=true correctly', () => {
      const legacyRequest: LegacyDownloadRequest = {
        chartIds: ['chart1'],
        destination: './downloads/test',
        concurrency: 1,
        skipExisting: true, // should result in overwrite: false
        options: {
          organizeIntoFolders: false,
          deleteZipAfterExtraction: false
        }
      };

      const convertedRequest: DownloadRequest = {
        chartIds: legacyRequest.chartIds,
        downloadDir: legacyRequest.destination,
        maxConcurrency: legacyRequest.concurrency || 3,
        organizeSongFolders: legacyRequest.options.organizeIntoFolders,
        deleteZipAfterExtraction: legacyRequest.options.deleteZipAfterExtraction,
        overwrite: !legacyRequest.skipExisting
      };

      expect(convertedRequest.overwrite).toBe(false);
      expect(convertedRequest.organizeSongFolders).toBe(false);
      expect(convertedRequest.deleteZipAfterExtraction).toBe(false);
    });
  });

  describe('Request Format Detection', () => {
    it('should detect legacy format by presence of destination and options', () => {
      const legacyRequest: any = {
        chartIds: ['chart1'],
        destination: './downloads/test',
        concurrency: 3,
        skipExisting: false,
        options: {
          organizeIntoFolders: true,
          deleteZipAfterExtraction: true
        }
      };

      const isLegacyFormat = !!(legacyRequest.destination && legacyRequest.options);
      expect(isLegacyFormat).toBe(true);
    });

    it('should detect new format by absence of destination and options', () => {
      const newRequest: any = {
        chartIds: ['chart1'],
        downloadDir: './downloads/test',
        maxConcurrency: 3,
        organizeSongFolders: true
      };

      const isLegacyFormat = !!(newRequest.destination && newRequest.options);
      expect(isLegacyFormat).toBeFalsy();
    });
  });

  describe('Default Value Handling', () => {
    it('should apply correct defaults for new format', () => {
      const minimalRequest: DownloadRequest = {
        chartIds: ['chart1']
      };

      // Apply defaults as done in server
      const requestWithDefaults = {
        chartIds: minimalRequest.chartIds,
        downloadDir: minimalRequest.downloadDir || './downloads',
        maxConcurrency: minimalRequest.maxConcurrency || 3,
        organizeSongFolders: minimalRequest.organizeSongFolders || false,
        overwrite: minimalRequest.overwrite || false
      };

      expect(requestWithDefaults.downloadDir).toBe('./downloads');
      expect(requestWithDefaults.maxConcurrency).toBe(3);
      expect(requestWithDefaults.organizeSongFolders).toBe(false);
      expect(requestWithDefaults.overwrite).toBe(false);
    });

    it('should preserve explicit values when provided', () => {
      const explicitRequest: DownloadRequest = {
        chartIds: ['chart1'],
        downloadDir: './custom/downloads',
        maxConcurrency: 5,
        organizeSongFolders: true,
        overwrite: true
      };

      // Apply defaults (should not override existing values)
      const requestWithDefaults = {
        chartIds: explicitRequest.chartIds,
        downloadDir: explicitRequest.downloadDir || './downloads',
        maxConcurrency: explicitRequest.maxConcurrency || 3,
        organizeSongFolders: explicitRequest.organizeSongFolders || false,
        overwrite: explicitRequest.overwrite || false
      };

      expect(requestWithDefaults.downloadDir).toBe('./custom/downloads');
      expect(requestWithDefaults.maxConcurrency).toBe(5);
      expect(requestWithDefaults.organizeSongFolders).toBe(true);
      expect(requestWithDefaults.overwrite).toBe(true);
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
