/**
 * Tests for GUI compatibility with API models
 * Ensures the models work with the actual patterns used in the GUI
 */

import { DownloadRequest } from '@shared/models';

describe('GUI Compatibility Tests', () => {
  describe('GUI Download Request Creation', () => {
    it('should match the unified request structure used by GUI app.ts', () => {
      // This mimics the request creation in gui/src/app.ts startDownload method
      const selectedCharts = ['chart1', 'chart2'];
      const downloadDir = './downloads/gui-test';
      const organizeSongFolders = true;
      const deleteZipAfterExtraction = false;

      const downloadRequest: DownloadRequest = {
        chartIds: selectedCharts,
        downloadDir,
        maxConcurrency: 3,
        organizeSongFolders,
        deleteZipAfterExtraction,
        overwrite: false
      };

      expect(downloadRequest.chartIds).toEqual(['chart1', 'chart2']);
      expect(downloadRequest.downloadDir).toBe('./downloads/gui-test');
      expect(downloadRequest.maxConcurrency).toBe(3);
      expect(downloadRequest.organizeSongFolders).toBe(true);
      expect(downloadRequest.deleteZipAfterExtraction).toBe(false);
      expect(downloadRequest.overwrite).toBe(false);
    });

    it('should support all available options in the unified format', () => {
      // Test with all available options
      const selectedCharts = ['chart1', 'chart2'];
      const downloadDir = './downloads/gui-test';
      const organizeSongFolders = true;
      const deleteZipAfterExtraction = false;
      const autoUnzip = true;
      const overwrite = false;

      const downloadRequest: DownloadRequest = {
        chartIds: selectedCharts,
        downloadDir,
        maxConcurrency: 3,
        organizeSongFolders,
        autoUnzip,
        deleteZipAfterExtraction,
        overwrite
      };

      expect(downloadRequest.chartIds).toEqual(['chart1', 'chart2']);
      expect(downloadRequest.downloadDir).toBe('./downloads/gui-test');
      expect(downloadRequest.maxConcurrency).toBe(3);
      expect(downloadRequest.organizeSongFolders).toBe(true);
      expect(downloadRequest.autoUnzip).toBe(true);
      expect(downloadRequest.deleteZipAfterExtraction).toBe(false);
      expect(downloadRequest.overwrite).toBe(false);
    });
  });

  describe('GUI Option Mapping', () => {
    it('should correctly map GUI checkbox states to API options', () => {
      // Simulate GUI checkbox values
      const guiCheckboxStates = {
        organizeFolders: true,
        deleteZip: false,
        autoUnzip: true,
        overwriteExisting: false
      };

      const request: DownloadRequest = {
        chartIds: ['chart1'],
        downloadDir: './downloads',
        maxConcurrency: 3,
        organizeSongFolders: guiCheckboxStates.organizeFolders,
        autoUnzip: guiCheckboxStates.autoUnzip,
        deleteZipAfterExtraction: guiCheckboxStates.deleteZip,
        overwrite: guiCheckboxStates.overwriteExisting
      };

      expect(request.organizeSongFolders).toBe(true);
      expect(request.autoUnzip).toBe(true);
      expect(request.deleteZipAfterExtraction).toBe(false);
      expect(request.overwrite).toBe(false);
    });
  });

  describe('API Client Integration', () => {
    it('should work with the APIClient.startDownload method signature', () => {
      // This tests that our models are compatible with the GUI's API client
      
      // Mock API client method (from gui/src/api-client.ts)
      const mockStartDownload = (downloadRequest: any): Promise<any> => {
        // The API client just passes through the request object
        // Validate it has the basic structure
        if (!downloadRequest.chartIds) {
          throw new Error('chartIds required');
        }
        return Promise.resolve({ downloadId: 'test-123' });
      };

      // Test with unified format
      const request: DownloadRequest = {
        chartIds: ['chart1'],
        downloadDir: './downloads',
        maxConcurrency: 3,
        organizeSongFolders: true
      };

      expect(() => mockStartDownload(request)).not.toThrow();
    });
  });

  describe('Storage Service Compatibility', () => {
    it('should work with GUI storage service patterns', () => {
      // GUI uses localStorage to save/load download directory
      const mockStorageService = {
        saveDownloadDirectory: (path: string) => path,
        loadDownloadDirectory: () => './downloads/saved'
      };

      const savedPath = mockStorageService.loadDownloadDirectory();
      
      const request: DownloadRequest = {
        chartIds: ['chart1'],
        downloadDir: savedPath,
        maxConcurrency: 3
      };

      expect(request.downloadDir).toBe('./downloads/saved');
    });
  });

  describe('Form Validation Compatibility', () => {
    it('should support GUI form validation patterns', () => {
      // Test validation logic that would be used in GUI
      const validateDownloadRequest = (request: DownloadRequest): string[] => {
        const errors: string[] = [];

        // Basic validation
        if (!request.chartIds || request.chartIds.length === 0) {
          errors.push('No charts selected');
        }

        if (request.maxConcurrency !== undefined && request.maxConcurrency <= 0) {
          errors.push('Max concurrency must be at least 1');
        }

        return errors;
      };

      // Valid request
      const validRequest: DownloadRequest = {
        chartIds: ['chart1'],
        downloadDir: './downloads',
        maxConcurrency: 3
      };
      expect(validateDownloadRequest(validRequest)).toEqual([]);

      // Invalid request (no charts)
      const invalidRequest: DownloadRequest = {
        chartIds: [],
        downloadDir: './downloads'
      };
      expect(validateDownloadRequest(invalidRequest)).toContain('No charts selected');

      // Invalid request (bad concurrency)
      const badConcurrencyRequest: DownloadRequest = {
        chartIds: ['chart1'],
        downloadDir: './downloads',
        maxConcurrency: 0
      };
      expect(validateDownloadRequest(badConcurrencyRequest)).toContain('Max concurrency must be at least 1');
    });
  });

  describe('Optional Properties Support', () => {
    it('should work with minimal required properties', () => {
      // Test that only required properties are needed
      const minimalRequest: DownloadRequest = {
        chartIds: ['chart1', 'chart2']
      };

      expect(minimalRequest.chartIds).toEqual(['chart1', 'chart2']);
      expect(minimalRequest.downloadDir).toBeUndefined();
      expect(minimalRequest.maxConcurrency).toBeUndefined();
      expect(minimalRequest.organizeSongFolders).toBeUndefined();
    });

    it('should support partial option sets', () => {
      // Test different combinations of options
      const partialRequest1: DownloadRequest = {
        chartIds: ['chart1'],
        downloadDir: './downloads'
      };

      const partialRequest2: DownloadRequest = {
        chartIds: ['chart1'],
        maxConcurrency: 5,
        autoUnzip: true
      };

      const partialRequest3: DownloadRequest = {
        chartIds: ['chart1'],
        organizeSongFolders: true,
        deleteZipAfterExtraction: true,
        overwrite: true
      };

      expect(partialRequest1.chartIds).toEqual(['chart1']);
      expect(partialRequest1.downloadDir).toBe('./downloads');
      
      expect(partialRequest2.maxConcurrency).toBe(5);
      expect(partialRequest2.autoUnzip).toBe(true);
      
      expect(partialRequest3.organizeSongFolders).toBe(true);
      expect(partialRequest3.deleteZipAfterExtraction).toBe(true);
      expect(partialRequest3.overwrite).toBe(true);
    });
  });
});
