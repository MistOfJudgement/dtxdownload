/**
 * Main DTX Download Manager Application
 * Orchestrates all the managers and components
 */

import { ChartManager } from './managers/ChartManager.js';
import { SelectionManager } from './managers/SelectionManager.js';
import { UIStateManager } from './managers/UIStateManager.js';
import { DTXAPIClient } from './api-client.js';
import { StorageService } from './services/StorageService.js';
import { DOMUtils } from './utils/DOMUtils.js';
import { eventBus } from './utils/EventBus.js';
import { Chart } from './types/index.js';
import { convertChartResponsesToCharts } from './utils/typeConversion.js';

export class DTXDownloadManager {
    private chartManager: ChartManager;
    private selectionManager: SelectionManager;
    private uiStateManager: UIStateManager;
    private apiClient: DTXAPIClient;
    private isOnline: boolean = false;

    constructor() {
        // Initialize managers
        this.chartManager = new ChartManager();
        this.selectionManager = new SelectionManager();
        this.uiStateManager = new UIStateManager();
        this.apiClient = new DTXAPIClient();

        // Initialize the application
        this.init();
    }

    /**
     * Initialize the application
     */
    private async init(): Promise<void> {
        try {
            // Set up event listeners
            this.setupEventListeners();
            
            // Check backend connection
            await this.checkBackendConnection();
            
            // Load initial data
            await this.loadInitialData();
            
            // Set up UI
            this.setupUI();
            
            // Restore settings
            this.restoreSettings();
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.updateStatus('Application initialization failed');
        }
    }

    /**
     * Set up all event listeners
     */
    private setupEventListeners(): void {
        // Database actions
        DOMUtils.addEventListener('scrapeBtn', 'click', () => this.showScrapeModal());
        DOMUtils.addEventListener('importBtn', 'click', () => this.importDatabase());
        DOMUtils.addEventListener('clearDataBtn', 'click', () => this.clearAllData());
        
        // Search and filters
        DOMUtils.addEventListener('searchInput', 'input', (e) => {
            const target = e.target as HTMLInputElement;
            this.handleSearch(target.value);
        });
        
        DOMUtils.addEventListener('artistFilter', 'change', () => this.applyFilters());
        DOMUtils.addEventListener('clearFilters', 'click', () => this.clearFilters());
        
        // View controls
        DOMUtils.addEventListener('selectAll', 'change', (e) => {
            const target = e.target as HTMLInputElement;
            this.toggleSelectAll(target.checked);
        });
        
        DOMUtils.addEventListener('gridViewBtn', 'click', () => this.setViewMode('grid'));
        DOMUtils.addEventListener('listViewBtn', 'click', () => this.setViewMode('list'));
        
        // Download
        DOMUtils.addEventListener('downloadSelectedBtn', 'click', () => this.startDownload());
        DOMUtils.addEventListener('clearAllSelectedBtn', 'click', () => this.clearAllSelected());
        
        // Pagination
        DOMUtils.addEventListener('prevPageBtn', 'click', () => this.previousPage());
        DOMUtils.addEventListener('nextPageBtn', 'click', () => this.nextPage());
        
        // Internal event listeners
        eventBus.on('charts-updated', (charts: Chart[]) => this.onChartsUpdated(charts));
        eventBus.on('selection-changed', (selection: Set<string>) => this.onSelectionChanged(selection));
        eventBus.on('ui-state-changed', () => this.onUIStateChanged());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    /**
     * Check backend connection
     */
    private async checkBackendConnection(): Promise<void> {
        try {
            await this.apiClient.checkHealth();
            this.isOnline = true;
            this.updateStatus('Connected to backend server');
        } catch (error) {
            this.isOnline = false;
            this.updateStatus('Working offline (no backend connection)');
        }
    }

    /**
     * Load initial data
     */
    private async loadInitialData(): Promise<void> {
        this.uiStateManager.setLoading(true);
        
        try {
            if (this.isOnline) {
                // Try to load from backend
                const response = await this.apiClient.getCharts();
                if (response.charts && response.charts.length > 0) {
                    this.chartManager.setCharts(convertChartResponsesToCharts(response.charts));
                }
            }
            // Charts are automatically loaded from localStorage by ChartManager
        } catch (error) {
            console.error('Error loading initial data:', error);
            this.updateStatus('Error loading data');
        } finally {
            this.uiStateManager.setLoading(false);
        }
    }

    /**
     * Set up initial UI state
     */
    private setupUI(): void {
        this.renderCharts();
        this.updateStats();
        this.updateDownloadButton();
        this.populateArtistFilter();
    }

    /**
     * Restore settings from storage
     */
    private restoreSettings(): void {
        const downloadDir = StorageService.loadDownloadDirectory();
        DOMUtils.setValue('downloadDir', downloadDir);
    }

    /**
     * Event handlers
     */
    private onChartsUpdated(charts: Chart[]): void {
        this.renderCharts();
        this.updateStats();
        this.populateArtistFilter();
    }

    private onSelectionChanged(selection: Set<string>): void {
        this.updateStats();
        this.updateDownloadButton();
        this.updateSelectAllCheckbox();
        this.renderCharts(); // Re-render to update selection visual state
    }

    private onUIStateChanged(): void {
        this.renderCharts();
        this.updateViewModeButtons();
        this.updateSortButton();
    }

    /**
     * UI Actions
     */
    private handleSearch(query: string): void {
        this.chartManager.setSearchQuery(query);
        this.uiStateManager.resetPagination();
        this.renderCharts();
    }

    private applyFilters(): void {
        const artist = DOMUtils.getValue('artistFilter');
        const bpmMin = parseInt(DOMUtils.getValue('bpmMin')) || undefined;
        const bpmMax = parseInt(DOMUtils.getValue('bpmMax')) || undefined;
        const diffMin = parseFloat(DOMUtils.getValue('diffMin')) || undefined;
        const diffMax = parseFloat(DOMUtils.getValue('diffMax')) || undefined;

        this.chartManager.applyFilters({ artist, bpmMin, bpmMax, diffMin, diffMax });
        this.uiStateManager.resetPagination();
        this.renderCharts();
    }

    private clearFilters(): void {
        DOMUtils.setValue('searchInput', '');
        DOMUtils.setValue('artistFilter', '');
        DOMUtils.setValue('bpmMin', '');
        DOMUtils.setValue('bpmMax', '');
        DOMUtils.setValue('diffMin', '');
        DOMUtils.setValue('diffMax', '');
        
        this.chartManager.clearFilters();
        this.uiStateManager.resetPagination();
        this.renderCharts();
    }

    private setViewMode(mode: 'grid' | 'list'): void {
        this.uiStateManager.setViewMode(mode);
    }

    private toggleSelectAll(checked: boolean): void {
        const currentPageCharts = this.getCurrentPageCharts();
        const chartIds = currentPageCharts.map(chart => chart.id);
        
        if (checked) {
            this.selectionManager.selectMultiple(chartIds);
        } else {
            chartIds.forEach(id => this.selectionManager.deselect(id));
        }
    }

    private clearAllSelected(): void {
        this.selectionManager.clear();
    }

    private nextPage(): void {
        const totalItems = this.chartManager.getFilteredCharts().length;
        const { totalPages } = this.uiStateManager.getPaginationInfo(totalItems);
        this.uiStateManager.nextPage(totalPages);
    }

    private previousPage(): void {
        this.uiStateManager.previousPage();
    }

    /**
     * Get current page charts
     */
    private getCurrentPageCharts(): Chart[] {
        const filteredCharts = this.chartManager.getFilteredCharts();
        const state = this.uiStateManager.getState();
        this.chartManager.sortCharts(state.sortBy, state.sortOrder);
        return this.uiStateManager.getPaginatedItems(filteredCharts);
    }

    /**
     * Render charts (simplified version)
     */
    private renderCharts(): void {
        const charts = this.getCurrentPageCharts();
        const viewMode = this.uiStateManager.getViewMode();
        
        if (charts.length === 0) {
            this.showEmptyState();
            return;
        }

        this.hideEmptyState();
        
        if (viewMode === 'grid') {
            this.renderGridView(charts);
        } else {
            this.renderListView(charts);
        }
        
        this.renderPagination();
    }

    /**
     * Simplified rendering methods
     */
    private renderGridView(charts: Chart[]): void {
        DOMUtils.toggleElement('chartsGrid', true);
        DOMUtils.toggleElement('chartsList', false);
        
        const html = charts.map(chart => this.createChartCardHTML(chart)).join('');
        DOMUtils.setInnerHTML('chartsGrid', html);
        
        this.attachChartEventListeners();
    }

    private renderListView(charts: Chart[]): void {
        DOMUtils.toggleElement('chartsList', true);
        DOMUtils.toggleElement('chartsGrid', false);
        
        const headerHTML = `
            <div class="list-header">
                <div></div><div>Image</div><div>Title</div>
                <div class="hide-mobile">Artist</div>
                <div class="hide-mobile">BPM</div>
                <div>Difficulty</div>
            </div>
        `;
        
        const itemsHTML = charts.map(chart => this.createListItemHTML(chart)).join('');
        DOMUtils.setInnerHTML('chartsList', headerHTML + itemsHTML);
        
        this.attachChartEventListeners();
    }

    private createChartCardHTML(chart: Chart): string {
        const isSelected = this.selectionManager.isSelected(chart.id);
        const imageUrl = chart.previewImageUrl || chart.imageUrl || this.getPlaceholderImage();
        
        return `
            <div class="chart-card ${isSelected ? 'selected' : ''}" data-chart-id="${chart.id}">
                <div class="chart-checkbox">
                    <label class="checkbox-label">
                        <input type="checkbox" ${isSelected ? 'checked' : ''}>
                        <span class="checkmark"></span>
                    </label>
                </div>
                <img src="${imageUrl}" alt="${chart.title}" class="chart-image">
                <div class="chart-content">
                    <div class="chart-title" title="${chart.title}">${chart.title}</div>
                    <div class="chart-artist" title="${chart.artist}">${chart.artist}</div>
                    <div class="chart-meta">
                        <span class="chart-bpm">${chart.bpm} BPM</span>
                        <div class="chart-difficulties">
                            ${chart.difficulties.map(diff => `<span class="difficulty-badge">${diff}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    private createListItemHTML(chart: Chart): string {
        const isSelected = this.selectionManager.isSelected(chart.id);
        const imageUrl = chart.previewImageUrl || chart.imageUrl || this.getPlaceholderImage(60);
        
        return `
            <div class="list-item ${isSelected ? 'selected' : ''}" data-chart-id="${chart.id}">
                <label class="checkbox-label">
                    <input type="checkbox" ${isSelected ? 'checked' : ''}>
                    <span class="checkmark"></span>
                </label>
                <img src="${imageUrl}" alt="${chart.title}" class="list-image">
                <div class="list-title" title="${chart.title}">${chart.title}</div>
                <div class="list-artist hide-mobile" title="${chart.artist}">${chart.artist}</div>
                <div class="hide-mobile">${chart.bpm} BPM</div>
                <div>${chart.difficulties.join(' / ')}</div>
            </div>
        `;
    }

    private attachChartEventListeners(): void {
        // Attach click handlers to chart cards/items
        document.querySelectorAll('[data-chart-id]').forEach(element => {
            const chartId = element.getAttribute('data-chart-id')!;
            const checkbox = element.querySelector('input[type="checkbox"]') as HTMLInputElement;
            
            checkbox?.addEventListener('change', (e) => {
                e.stopPropagation();
                this.selectionManager.toggle(chartId);
            });
            
            element.addEventListener('click', (e) => {
                if ((e.target as HTMLElement).tagName !== 'INPUT') {
                    this.selectionManager.toggle(chartId);
                }
            });
        });
    }

    /**
     * UI Update methods
     */
    private updateStats(): void {
        const totalCharts = this.chartManager.getFilteredCharts().length;
        const selectedCount = this.selectionManager.getCount();
        
        DOMUtils.setTextContent('totalCharts', totalCharts);
        DOMUtils.setTextContent('selectedCount', selectedCount);
    }

    private updateDownloadButton(): void {
        const count = this.selectionManager.getCount();
        const button = DOMUtils.getRequiredElement('downloadSelectedBtn');
        
        DOMUtils.setDisabled('downloadSelectedBtn', count === 0);
        button.innerHTML = count === 0 
            ? '<i class="fas fa-download"></i> Download Selected'
            : `<i class="fas fa-download"></i> Download ${count} Charts`;
    }

    private updateSelectAllCheckbox(): void {
        const currentPageCharts = this.getCurrentPageCharts();
        const chartIds = currentPageCharts.map(chart => chart.id);
        const state = this.selectionManager.getSelectionState(chartIds);
        
        const checkbox = DOMUtils.getRequiredElement<HTMLInputElement>('selectAll');
        
        switch (state) {
            case 'none':
                checkbox.checked = false;
                checkbox.indeterminate = false;
                break;
            case 'all':
                checkbox.checked = true;
                checkbox.indeterminate = false;
                break;
            case 'some':
                checkbox.checked = false;
                checkbox.indeterminate = true;
                break;
        }
    }

    private updateViewModeButtons(): void {
        const viewMode = this.uiStateManager.getViewMode();
        
        DOMUtils.getRequiredElement('gridViewBtn').classList.toggle('active', viewMode === 'grid');
        DOMUtils.getRequiredElement('listViewBtn').classList.toggle('active', viewMode === 'list');
    }

    private updateSortButton(): void {
        const sortOrder = this.uiStateManager.getSortOrder();
        const icon = document.querySelector('#sortOrderBtn i');
        
        if (icon) {
            icon.className = sortOrder === 'asc' ? 'fas fa-sort-amount-down' : 'fas fa-sort-amount-up';
        }
    }

    private renderPagination(): void {
        const totalItems = this.chartManager.getFilteredCharts().length;
        const { totalPages, hasNext, hasPrev } = this.uiStateManager.getPaginationInfo(totalItems);
        const currentPage = this.uiStateManager.getCurrentPage();
        
        if (totalPages <= 1) {
            DOMUtils.toggleElement('pagination', false);
            return;
        }
        
        DOMUtils.toggleElement('pagination', true);
        DOMUtils.setTextContent('currentPage', currentPage);
        DOMUtils.setTextContent('totalPages', totalPages);
        DOMUtils.setDisabled('prevPageBtn', !hasPrev);
        DOMUtils.setDisabled('nextPageBtn', !hasNext);
    }

    private populateArtistFilter(): void {
        const artists = this.chartManager.getUniqueArtists();
        const select = DOMUtils.getRequiredElement<HTMLSelectElement>('artistFilter');
        
        select.innerHTML = '<option value="">All Artists</option>';
        
        artists.forEach(artist => {
            const option = document.createElement('option');
            option.value = artist;
            option.textContent = artist;
            select.appendChild(option);
        });
    }

    /**
     * Helper methods
     */
    private showEmptyState(): void {
        DOMUtils.showOnly('emptyState', ['chartsGrid', 'chartsList', 'pagination']);
    }

    private hideEmptyState(): void {
        DOMUtils.toggleElement('emptyState', false);
    }

    private updateStatus(message: string): void {
        DOMUtils.setTextContent('statusMessage', message);
    }

    private getPlaceholderImage(size: number = 200): string {
        return `data:image/svg+xml;base64,${btoa(`
            <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
                <rect width="${size}" height="${size}" fill="#f4f4f4"/>
                <text x="50%" y="50%" font-family="Arial" font-size="12" fill="#999" 
                      text-anchor="middle" dy=".3em">No Image</text>
            </svg>
        `)}`;
    }

    /**
     * Placeholder methods for complex functionality
     */
    private showScrapeModal(): void {
        DOMUtils.toggleElement('scrapeModal', true);
    }

    private importDatabase(): void {
        const input = DOMUtils.getRequiredElement<HTMLInputElement>('importFile');
        input.click();
    }

    private clearAllData(): void {
        if (confirm('Are you sure you want to clear all chart data? This cannot be undone.')) {
            this.chartManager.clearCharts();
            this.selectionManager.clear();
            this.updateStatus('All data cleared');
        }
    }

    private startDownload(): void {
        // Placeholder for download functionality
        console.log('Download started for:', this.selectionManager.getSelectedArray());
    }

    private handleKeyboardShortcuts(event: KeyboardEvent): void {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'a':
                    event.preventDefault();
                    const currentPageCharts = this.getCurrentPageCharts();
                    this.selectionManager.selectMultiple(currentPageCharts.map(c => c.id));
                    break;
                case 'f':
                    event.preventDefault();
                    DOMUtils.getRequiredElement('searchInput').focus();
                    break;
            }
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    (window as any).dtxManager = new DTXDownloadManager();
});

export default DTXDownloadManager;
