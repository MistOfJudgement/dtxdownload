/**
 * Manages chart data, validation, and filtering
 */

import { Chart, ValidationResult, FilterConfig } from '../types/index.js';
import { StorageService } from '../services/StorageService.js';
import { eventBus } from '../utils/EventBus.js';

export class ChartManager {
    private charts: Chart[] = [];
    private filteredCharts: Chart[] = [];
    private filterConfig: FilterConfig = {
        artists: new Set(),
        sources: new Set(),
        difficulties: { min: 0, max: 10 },
        bpm: { min: 60, max: 200 }
    };
    private searchQuery: string = '';

    constructor() {
        this.loadCharts();
    }

    /**
     * Get all charts
     */
    getCharts(): Chart[] {
        return [...this.charts];
    }

    /**
     * Get filtered charts
     */
    getFilteredCharts(): Chart[] {
        return [...this.filteredCharts];
    }

    /**
     * Add charts (replace existing)
     */
    setCharts(charts: Chart[]): void {
        this.charts = this.validateAndCleanCharts(charts);
        this.applyFilters();
        this.saveCharts();
        eventBus.emit('charts-updated', this.charts);
    }

    /**
     * Add new charts (incremental)
     */
    addCharts(newCharts: Chart[]): void {
        const existingIds = new Set(this.charts.map(c => c.id));
        const validNewCharts = this.validateAndCleanCharts(newCharts)
            .filter(chart => !existingIds.has(chart.id));
        
        this.charts.push(...validNewCharts);
        this.applyFilters();
        this.saveCharts();
        eventBus.emit('charts-updated', this.charts);
    }

    /**
     * Clear all charts
     */
    clearCharts(): void {
        this.charts = [];
        this.filteredCharts = [];
        StorageService.clearCharts();
        eventBus.emit('charts-updated', this.charts);
    }

    /**
     * Get chart by ID
     */
    getChart(id: string): Chart | undefined {
        return this.charts.find(chart => chart.id === id);
    }

    /**
     * Get charts by IDs
     */
    getChartsByIds(ids: string[]): Chart[] {
        return this.charts.filter(chart => ids.includes(chart.id));
    }

    /**
     * Apply search filter
     */
    setSearchQuery(query: string): void {
        this.searchQuery = query.toLowerCase();
        this.applyFilters();
    }

    /**
     * Apply filters
     */
    applyFilters(filters?: Partial<{
        artist: string;
        bpmMin: number;
        bpmMax: number;
        diffMin: number;
        diffMax: number;
    }>): void {
        let filtered = [...this.charts];

        // Search filter
        if (this.searchQuery) {
            filtered = filtered.filter(chart => 
                chart.title.toLowerCase().includes(this.searchQuery) ||
                chart.artist.toLowerCase().includes(this.searchQuery)
            );
        }

        // Additional filters
        if (filters) {
            if (filters.artist) {
                filtered = filtered.filter(chart => chart.artist === filters.artist);
            }
            
            if (filters.bpmMin !== undefined) {
                filtered = filtered.filter(chart => parseInt(chart.bpm) >= filters.bpmMin!);
            }
            
            if (filters.bpmMax !== undefined) {
                filtered = filtered.filter(chart => parseInt(chart.bpm) <= filters.bpmMax!);
            }
            
            if (filters.diffMin !== undefined) {
                filtered = filtered.filter(chart => Math.max(...chart.difficulties) >= filters.diffMin!);
            }
            
            if (filters.diffMax !== undefined) {
                filtered = filtered.filter(chart => Math.min(...chart.difficulties) <= filters.diffMax!);
            }
        }

        this.filteredCharts = filtered;
        eventBus.emit('filter-changed', this.filterConfig);
    }

    /**
     * Clear all filters
     */
    clearFilters(): void {
        this.searchQuery = '';
        this.filteredCharts = [...this.charts];
        eventBus.emit('filter-changed', this.filterConfig);
    }

    /**
     * Get unique artists for filter dropdown
     */
    getUniqueArtists(): string[] {
        return [...new Set(this.charts.map(chart => chart.artist))].sort();
    }

    /**
     * Sort charts
     */
    sortCharts(sortBy: string, sortOrder: 'asc' | 'desc'): void {
        this.filteredCharts.sort((a, b) => {
            let aVal: any, bVal: any;
            
            switch (sortBy) {
                case 'title':
                    aVal = a.title.toLowerCase();
                    bVal = b.title.toLowerCase();
                    break;
                case 'artist':
                    aVal = a.artist.toLowerCase();
                    bVal = b.artist.toLowerCase();
                    break;
                case 'bpm':
                    aVal = parseInt(a.bpm);
                    bVal = parseInt(b.bpm);
                    break;
                case 'difficulty':
                    aVal = Math.max(...a.difficulties);
                    bVal = Math.max(...b.difficulties);
                    break;
                case 'createdAt':
                    aVal = new Date(a.createdAt);
                    bVal = new Date(b.createdAt);
                    break;
                default:
                    return 0;
            }
            
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }

    /**
     * Validate chart data
     */
    private validateChart(chart: Chart): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        
        // Check for missing required fields
        if (!chart.title || chart.title.trim() === '') {
            errors.push('Missing title');
        }
        if (!chart.artist || chart.artist.trim() === '') {
            errors.push('Missing artist');
        }
        
        // Check for mismatched language/encoding in title-artist pairs
        const hasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(chart.title);
        const artistHasJapanese = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(chart.artist);
        
        if (hasJapanese !== artistHasJapanese) {
            warnings.push(`Language mismatch: "${chart.title}" by "${chart.artist}"`);
        }
        
        // Validate BPM format
        if (chart.bpm && !/^\d+(-\d+)?$/.test(chart.bpm)) {
            errors.push('Invalid BPM format');
        }
        
        // Validate difficulties
        if (!Array.isArray(chart.difficulties) || chart.difficulties.length === 0) {
            errors.push('Missing or invalid difficulties');
        }
        
        // Validate download URL
        if (!chart.downloadUrl || !/^https?:\/\/.+/.test(chart.downloadUrl)) {
            errors.push('Invalid download URL');
        }
        
        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            issues: [...errors, ...warnings]  // For backward compatibility
        };
    }

    /**
     * Validate and clean chart array
     */
    private validateAndCleanCharts(charts: Chart[]): Chart[] {
        let cleaned = 0;
        let removed = 0;
        
        const validCharts = charts.filter(chart => {
            const validation = this.validateChart(chart);
            if (!validation.isValid) {
                console.warn(`Removing invalid chart: ${chart.title} by ${chart.artist}`, validation.errors);
                removed++;
                return false;
            }
            if (validation.warnings.length > 0) {
                console.info(`Chart has warnings: ${chart.title} by ${chart.artist}`, validation.warnings);
            }
            cleaned++;
            return true;
        });
        
        if (removed > 0) {
            console.log(`Cleaned chart data: ${cleaned} valid, ${removed} removed`);
        }
        
        return validCharts;
    }

    /**
     * Load charts from storage
     */
    private loadCharts(): void {
        this.charts = StorageService.loadCharts();
        this.filteredCharts = [...this.charts];
        
        if (this.charts.length > 0) {
            console.log(`Loaded ${this.charts.length} charts from storage`);
        }
    }

    /**
     * Save charts to storage
     */
    private saveCharts(): void {
        StorageService.saveCharts(this.charts);
    }
}
