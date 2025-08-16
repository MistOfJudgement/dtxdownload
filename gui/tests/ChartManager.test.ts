import { ChartManager } from '../src/managers/ChartManager';
import { Chart } from '../src/types/index';
import { StorageService } from '../src/services/StorageService';
import { eventBus } from '../src/utils/EventBus';

// Mock dependencies
jest.mock('../src/services/StorageService');
jest.mock('../src/utils/EventBus');

describe('ChartManager', () => {
  let chartManager: ChartManager;
  const mockStorageService = StorageService as jest.Mocked<typeof StorageService>;
  const mockEventBus = eventBus as jest.Mocked<typeof eventBus>;

  const mockCharts: Chart[] = [
    {
      id: '1',
      title: 'Test Chart 1',
      artist: 'Artist A',
      bpm: '120',
      difficulties: [3.5, 7.2],
      source: 'test',
      downloadUrl: 'http://example.com/1',
      tags: ['electronic'],
      previewImageUrl: 'http://example.com/image1.jpg',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01')
    },
    {
      id: '2',
      title: 'Another Song',
      artist: 'Artist B',
      bpm: '140',
      difficulties: [5.1, 9.8],
      source: 'test',
      downloadUrl: 'http://example.com/2',
      tags: ['rock'],
      previewImageUrl: 'http://example.com/image2.jpg',
      createdAt: new Date('2023-01-02'),
      updatedAt: new Date('2023-01-02')
    },
    {
      id: '3',
      title: 'Third Track',
      artist: 'Artist A',
      bpm: '90',
      difficulties: [2.1],
      source: 'test',
      downloadUrl: 'http://example.com/3',
      tags: ['ambient'],
      previewImageUrl: 'http://example.com/image3.jpg',
      createdAt: new Date('2023-01-03'),
      updatedAt: new Date('2023-01-03')
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageService.loadCharts.mockReturnValue([]);
    chartManager = new ChartManager();
  });

  describe('Initialization', () => {
    it('should load charts from storage on initialization', () => {
      mockStorageService.loadCharts.mockReturnValue(mockCharts);
      
      const newManager = new ChartManager();
      
      expect(mockStorageService.loadCharts).toHaveBeenCalled();
      expect(newManager.getCharts()).toEqual(mockCharts);
    });

    it('should emit charts-updated event on initialization', () => {
      mockStorageService.loadCharts.mockReturnValue(mockCharts);
      
      new ChartManager();
      
      expect(mockEventBus.emit).toHaveBeenCalledWith('charts-updated', mockCharts);
    });
  });

  describe('Chart Management', () => {
    it('should set charts and save to storage', () => {
      chartManager.setCharts(mockCharts);

      expect(mockStorageService.saveCharts).toHaveBeenCalledWith(mockCharts);
      expect(mockEventBus.emit).toHaveBeenCalledWith('charts-updated', mockCharts);
      expect(chartManager.getCharts()).toEqual(mockCharts);
    });

    it('should add multiple charts incrementally', () => {
      chartManager.addCharts(mockCharts);

      expect(mockStorageService.saveCharts).toHaveBeenCalledWith(mockCharts);
      expect(mockEventBus.emit).toHaveBeenCalledWith('charts-updated', mockCharts);
    });

    it('should not add duplicate charts', () => {
      chartManager.setCharts([mockCharts[0]]);
      chartManager.addCharts(mockCharts); // Try to add all, including duplicate

      const result = chartManager.getCharts();
      expect(result).toHaveLength(3); // Should only have 3 unique charts
    });

    it('should get chart by id', () => {
      chartManager.setCharts(mockCharts);
      
      const chart = chartManager.getChart('2');
      
      expect(chart).toEqual(mockCharts[1]);
    });

    it('should return undefined for non-existent chart', () => {
      chartManager.setCharts(mockCharts);
      
      const chart = chartManager.getChart('non-existent');
      
      expect(chart).toBeUndefined();
    });

    it('should get charts by ids', () => {
      chartManager.setCharts(mockCharts);
      
      const charts = chartManager.getChartsByIds(['1', '3']);
      
      expect(charts).toHaveLength(2);
      expect(charts[0].id).toBe('1');
      expect(charts[1].id).toBe('3');
    });

    it('should clear all charts', () => {
      chartManager.setCharts(mockCharts);
      
      chartManager.clearCharts();

      expect(mockStorageService.clearCharts).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('charts-updated', []);
      expect(chartManager.getCharts()).toEqual([]);
    });
  });

  describe('Search Functionality', () => {
    beforeEach(() => {
      chartManager.setCharts(mockCharts);
    });

    it('should filter charts by title search', () => {
      chartManager.setSearchQuery('Another');
      
      const filtered = chartManager.getFilteredCharts();
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Another Song');
    });

    it('should filter charts by artist search', () => {
      chartManager.setSearchQuery('Artist A');
      
      const filtered = chartManager.getFilteredCharts();
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(chart => chart.artist === 'Artist A')).toBe(true);
    });

    it('should be case insensitive', () => {
      chartManager.setSearchQuery('ANOTHER');
      
      const filtered = chartManager.getFilteredCharts();
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Another Song');
    });

    it('should return all charts when search query is empty', () => {
      chartManager.setSearchQuery('');
      
      const filtered = chartManager.getFilteredCharts();
      
      expect(filtered).toEqual(mockCharts);
    });
  });

  describe('Filtering', () => {
    beforeEach(() => {
      chartManager.setCharts(mockCharts);
    });

    it('should filter by artist', () => {
      chartManager.applyFilters({ artist: 'Artist A' });
      
      const filtered = chartManager.getFilteredCharts();
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(chart => chart.artist === 'Artist A')).toBe(true);
    });

    it('should filter by BPM range', () => {
      chartManager.applyFilters({ bpmMin: 100, bpmMax: 130 });
      
      const filtered = chartManager.getFilteredCharts();
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].bpm).toBe('120');
    });

    it('should filter by difficulty range', () => {
      chartManager.applyFilters({ diffMin: 5, diffMax: 10 });
      
      const filtered = chartManager.getFilteredCharts();
      
      expect(filtered).toHaveLength(2);
      expect(filtered.every(chart => 
        chart.difficulties.some(diff => diff >= 5 && diff <= 10)
      )).toBe(true);
    });

    it('should combine multiple filters', () => {
      chartManager.applyFilters({ 
        artist: 'Artist A',
        bpmMin: 80,
        bpmMax: 100
      });
      
      const filtered = chartManager.getFilteredCharts();
      
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toBe('Third Track');
    });

    it('should clear filters', () => {
      chartManager.applyFilters({ artist: 'Artist A' });
      chartManager.clearFilters();
      
      const filtered = chartManager.getFilteredCharts();
      
      expect(filtered).toEqual(mockCharts);
    });
  });

  describe('Sorting', () => {
    beforeEach(() => {
      chartManager.setCharts(mockCharts);
    });

    it('should sort by title ascending', () => {
      chartManager.sortCharts('title', 'asc');
      const charts = chartManager.getFilteredCharts();
      
      expect(charts[0].title).toBe('Another Song');
      expect(charts[1].title).toBe('Test Chart 1');
      expect(charts[2].title).toBe('Third Track');
    });

    it('should sort by title descending', () => {
      chartManager.sortCharts('title', 'desc');
      const charts = chartManager.getFilteredCharts();
      
      expect(charts[0].title).toBe('Third Track');
      expect(charts[1].title).toBe('Test Chart 1');
      expect(charts[2].title).toBe('Another Song');
    });

    it('should sort by artist', () => {
      chartManager.sortCharts('artist', 'asc');
      const charts = chartManager.getFilteredCharts();
      
      expect(charts[0].artist).toBe('Artist A');
      expect(charts[1].artist).toBe('Artist A');
      expect(charts[2].artist).toBe('Artist B');
    });

    it('should sort by BPM numerically', () => {
      chartManager.sortCharts('bpm', 'asc');
      const charts = chartManager.getFilteredCharts();
      
      expect(charts[0].bpm).toBe('90');
      expect(charts[1].bpm).toBe('120');
      expect(charts[2].bpm).toBe('140');
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      chartManager.setCharts(mockCharts);
    });

    it('should get unique artists', () => {
      const artists = chartManager.getUniqueArtists();
      
      expect(artists).toEqual(['Artist A', 'Artist B']);
    });

    it('should return empty array when no charts', () => {
      chartManager.clearCharts();
      
      const artists = chartManager.getUniqueArtists();
      
      expect(artists).toEqual([]);
    });
  });
});
