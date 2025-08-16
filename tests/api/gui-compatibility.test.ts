/**
 * Tests for GUI compatibility with API models
 * Ensures the models work with the actual patterns used in the GUI
 */

import { DownloadRequest, LegacyDownloadRequest } from '../../src/api/models';

describe('GUI Compatibility Tests', () => {
  describe('GUI Download Request Creation', () => {
    it('should match the request structure created by GUI app.ts', () => {
      // This mimics the request creation in gui/src/app.ts startDownload method
      const selectedCharts = ['chart1', 'chart2'];
      const downloadDir = './downloads/gui-test';
      const organizeIntoFolders = true;
      const deleteZipAfterExtraction = false;

      // Legacy GUI format (current implementation)
      const legacyDownloadRequest: LegacyDownloadRequest = {
        chartIds: selectedCharts,
        destination: downloadDir,
        concurrency: 3,
        skipExisting: false,
        options: {
          organizeIntoFolders,
          deleteZipAfterExtraction
        }
      };

      expect(legacyDownloadRequest.chartIds).toEqual(['chart1', 'chart2']);
      expect(legacyDownloadRequest.destination).toBe('./downloads/gui-test');
      expect(legacyDownloadRequest.concurrency).toBe(3);
      expect(legacyDownloadRequest.options.organizeIntoFolders).toBe(true);
      expect(legacyDownloadRequest.options.deleteZipAfterExtraction).toBe(false);
    });

    it('should support new GUI format when updated', () => {
      // Future GUI format using new DownloadRequest interface
      const selectedCharts = ['chart1', 'chart2'];
      const downloadDir = './downloads/gui-test';
      const organizeSongFolders = true;
      const deleteZipAfterExtraction = false;

      const newDownloadRequest: DownloadRequest = {
        chartIds: selectedCharts,
        downloadDir,
        maxConcurrency: 3,
        organizeSongFolders,
        deleteZipAfterExtraction,
        overwrite: false
      };

      expect(newDownloadRequest.chartIds).toEqual(['chart1', 'chart2']);
      expect(newDownloadRequest.downloadDir).toBe('./downloads/gui-test');
      expect(newDownloadRequest.maxConcurrency).toBe(3);
      expect(newDownloadRequest.organizeSongFolders).toBe(true);
      expect(newDownloadRequest.deleteZipAfterExtraction).toBe(false);
      expect(newDownloadRequest.overwrite).toBe(false);
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

      // Legacy format mapping
      const legacyRequest: LegacyDownloadRequest = {
        chartIds: ['chart1'],
        destination: './downloads',
        concurrency: 3,
        skipExisting: !guiCheckboxStates.overwriteExisting, // inverted logic
        options: {
          organizeIntoFolders: guiCheckboxStates.organizeFolders,
          deleteZipAfterExtraction: guiCheckboxStates.deleteZip
        }
      };

      expect(legacyRequest.skipExisting).toBe(true); // !false = true
      expect(legacyRequest.options.organizeIntoFolders).toBe(true);
      expect(legacyRequest.options.deleteZipAfterExtraction).toBe(false);

      // New format mapping
      const newRequest: DownloadRequest = {
        chartIds: ['chart1'],
        downloadDir: './downloads',
        maxConcurrency: 3,
        organizeSongFolders: guiCheckboxStates.organizeFolders,
        autoUnzip: guiCheckboxStates.autoUnzip,
        deleteZipAfterExtraction: guiCheckboxStates.deleteZip,
        overwrite: guiCheckboxStates.overwriteExisting
      };

      expect(newRequest.organizeSongFolders).toBe(true);
      expect(newRequest.autoUnzip).toBe(true);
      expect(newRequest.deleteZipAfterExtraction).toBe(false);
      expect(newRequest.overwrite).toBe(false);
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

      // Test with legacy format
      const legacyRequest: LegacyDownloadRequest = {
        chartIds: ['chart1'],
        destination: './downloads',
        concurrency: 3,
        skipExisting: false,
        options: {
          organizeIntoFolders: true,
          deleteZipAfterExtraction: true
        }
      };

      expect(() => mockStartDownload(legacyRequest)).not.toThrow();

      // Test with new format
      const newRequest: DownloadRequest = {
        chartIds: ['chart1'],
        downloadDir: './downloads',
        maxConcurrency: 3,
        organizeSongFolders: true
      };

      expect(() => mockStartDownload(newRequest)).not.toThrow();
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
      
      // Should work with both request formats
      const legacyRequest: LegacyDownloadRequest = {
        chartIds: ['chart1'],
        destination: savedPath,
        concurrency: 3,
        skipExisting: false,
        options: {
          organizeIntoFolders: true,
          deleteZipAfterExtraction: true
        }
      };

      const newRequest: DownloadRequest = {
        chartIds: ['chart1'],
        downloadDir: savedPath,
        maxConcurrency: 3
      };

      expect(legacyRequest.destination).toBe('./downloads/saved');
      expect(newRequest.downloadDir).toBe('./downloads/saved');
    });
  });

  describe('Form Validation Compatibility', () => {
    it('should support GUI form validation patterns', () => {
      // Test validation logic that would be used in GUI
      const validateDownloadRequest = (request: DownloadRequest | LegacyDownloadRequest): string[] => {
        const errors: string[] = [];

        // Common validation
        if (!request.chartIds || request.chartIds.length === 0) {
          errors.push('No charts selected');
        }

        // Format-specific validation
        if ('destination' in request) {
          // Legacy format
          if (!request.destination) {
            errors.push('Download directory is required');
          }
          if (request.concurrency < 1) {
            errors.push('Concurrency must be at least 1');
          }
        } else {
          // New format
          const newReq = request as DownloadRequest;
          if (newReq.maxConcurrency && newReq.maxConcurrency < 1) {
            errors.push('Max concurrency must be at least 1');
          }
        }

        return errors;
      };

      // Valid legacy request
      const validLegacy: LegacyDownloadRequest = {
        chartIds: ['chart1'],
        destination: './downloads',
        concurrency: 3,
        skipExisting: false,
        options: { organizeIntoFolders: true, deleteZipAfterExtraction: true }
      };
      expect(validateDownloadRequest(validLegacy)).toEqual([]);

      // Valid new request
      const validNew: DownloadRequest = {
        chartIds: ['chart1'],
        downloadDir: './downloads',
        maxConcurrency: 3
      };
      expect(validateDownloadRequest(validNew)).toEqual([]);

      // Invalid request (no charts)
      const invalid: DownloadRequest = {
        chartIds: [],
        downloadDir: './downloads'
      };
      expect(validateDownloadRequest(invalid)).toContain('No charts selected');
    });
  });
});
