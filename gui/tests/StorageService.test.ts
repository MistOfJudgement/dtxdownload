import { StorageService } from '../src/services/StorageService';
import { Chart } from '../src/types/index';

describe('StorageService', () => {
  const mockCharts: Chart[] = [
    {
      id: '1',
      title: 'Test Chart 1',
      artist: 'Test Artist 1',
      bpm: '120',
      difficulties: [3.5, 7.2],
      source: 'test',
      downloadUrl: 'http://example.com/1',
      tags: ['tag1'],
      previewImageUrl: 'http://example.com/image1.jpg',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01')
    },
    {
      id: '2',
      title: 'Test Chart 2',
      artist: 'Test Artist 2',
      bpm: '140',
      difficulties: [5.1, 9.8],
      source: 'test',
      downloadUrl: 'http://example.com/2',
      tags: ['tag2'],
      previewImageUrl: 'http://example.com/image2.jpg',
      createdAt: new Date('2023-01-02'),
      updatedAt: new Date('2023-01-02')
    }
  ];

  beforeEach(() => {
    // Clear localStorage before each test
    jest.clearAllMocks();
    (localStorage.setItem as jest.Mock).mockClear();
    (localStorage.getItem as jest.Mock).mockClear();
    (localStorage.removeItem as jest.Mock).mockClear();
  });

  describe('Charts Management', () => {
    it('should save charts to localStorage', () => {
      StorageService.saveCharts(mockCharts);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'dtx_charts',
        JSON.stringify(mockCharts)
      );
    });

    it('should load charts from localStorage', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(mockCharts));

      const result = StorageService.loadCharts();

      // Dates will be serialized as strings in localStorage
      const expectedCharts = mockCharts.map(chart => ({
        ...chart,
        createdAt: chart.createdAt.toISOString(),
        updatedAt: chart.updatedAt.toISOString()
      }));

      expect(localStorage.getItem).toHaveBeenCalledWith('dtx_charts');
      expect(result).toEqual(expectedCharts);
    });

    it('should return empty array when no charts in localStorage', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      const result = StorageService.loadCharts();

      expect(result).toEqual([]);
    });

    it('should handle invalid JSON in localStorage gracefully', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue('invalid json');
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = StorageService.loadCharts();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should clear charts from localStorage', () => {
      StorageService.clearCharts();

      expect(localStorage.removeItem).toHaveBeenCalledWith('dtx_charts');
    });

    it('should handle localStorage errors when saving charts', () => {
      (localStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => StorageService.saveCharts(mockCharts)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Download Directory Management', () => {
    it('should save download directory', () => {
      const testPath = '/test/downloads';
      StorageService.saveDownloadDirectory(testPath);

      expect(localStorage.setItem).toHaveBeenCalledWith('dtx_last_download_dir', testPath);
    });

    it('should load download directory', () => {
      const testPath = '/test/downloads';
      (localStorage.getItem as jest.Mock).mockReturnValue(testPath);

      const result = StorageService.loadDownloadDirectory();

      expect(localStorage.getItem).toHaveBeenCalledWith('dtx_last_download_dir');
      expect(result).toBe(testPath);
    });

    it('should return default directory when none saved', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      const result = StorageService.loadDownloadDirectory();

      expect(result).toBe('./downloads');
    });

    it('should handle localStorage errors when loading directory', () => {
      (localStorage.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage error');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = StorageService.loadDownloadDirectory();

      expect(result).toBe('./downloads');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Settings Management', () => {
    const mockSettings = { theme: 'dark', autoDownload: true };

    it('should save settings', () => {
      StorageService.saveSettings(mockSettings);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'dtx_settings',
        JSON.stringify(mockSettings)
      );
    });

    it('should load settings', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify(mockSettings));

      const result = StorageService.loadSettings();

      expect(localStorage.getItem).toHaveBeenCalledWith('dtx_settings');
      expect(result).toEqual(mockSettings);
    });

    it('should return empty object when no settings saved', () => {
      (localStorage.getItem as jest.Mock).mockReturnValue(null);

      const result = StorageService.loadSettings();

      expect(result).toEqual({});
    });
  });

  describe('Clear All Data', () => {
    it('should clear all stored data', () => {
      StorageService.clearAll();

      expect(localStorage.removeItem).toHaveBeenCalledWith('dtx_charts');
      expect(localStorage.removeItem).toHaveBeenCalledWith('dtx_last_download_dir');
      expect(localStorage.removeItem).toHaveBeenCalledWith('dtx_settings');
    });

    it('should handle localStorage errors when clearing', () => {
      (localStorage.removeItem as jest.Mock).mockImplementation(() => {
        throw new Error('localStorage error');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => StorageService.clearAll()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
