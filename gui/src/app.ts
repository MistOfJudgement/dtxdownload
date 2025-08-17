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
import { DownloadRequest } from '@shared/models.js';

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
        
        // Directory selection
        DOMUtils.addEventListener('selectDirBtn', 'click', () => this.selectDownloadDirectory());
        DOMUtils.addEventListener('directoryInput', 'change', (e) => this.handleDirectorySelection(e));
        
        // Pagination
        DOMUtils.addEventListener('prevPageBtn', 'click', () => this.previousPage());
        DOMUtils.addEventListener('nextPageBtn', 'click', () => this.nextPage());
        
        // Scrape modal
        DOMUtils.addEventListener('closeScrapeModal', 'click', () => this.hideScrapeModal());
        DOMUtils.addEventListener('cancelScrapeBtn', 'click', () => this.hideScrapeModal());
        DOMUtils.addEventListener('startScrapeModalBtn', 'click', () => this.startScraping());
        
        // Close modal when clicking outside
        DOMUtils.addEventListener('scrapeModal', 'click', (e) => {
            const target = e.target as HTMLElement;
            if (target.id === 'scrapeModal') {
                this.hideScrapeModal();
            }
        });
        
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
                // Try to load from backend - request all charts with high limit
                const response = await this.apiClient.getCharts({ limit: 10000 });
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
        this.updateSelectedSongsList();
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

    private updateSelectedSongsList(): void {
        const selectedChartIds = this.selectionManager.getSelectedArray();
        const selectedSongsList = DOMUtils.getRequiredElement('selectedSongsList');
        const selectedSongsCount = DOMUtils.getRequiredElement('selectedSongsCount');
        
        // Update count
        selectedSongsCount.textContent = selectedChartIds.length.toString();
        
        // Clear previous content
        selectedSongsList.innerHTML = '';
        
        if (selectedChartIds.length === 0) {
            selectedSongsList.innerHTML = '<div class="no-selection-message">No songs selected</div>';
            return;
        }
        
        // Get full chart objects from chart manager
        const selectedCharts = this.chartManager.getChartsByIds(selectedChartIds);
        
        // Create list of selected songs
        selectedCharts.forEach((chart: Chart) => {
            const songItem = document.createElement('div');
            songItem.className = 'selected-song-item';
            
            songItem.innerHTML = `
                <div class="selected-song-info">
                    <div class="selected-song-title">${chart.title}</div>
                    <div class="selected-song-artist">${chart.artist}</div>
                </div>
                <button class="selected-song-remove" title="Remove from selection" data-chart-id="${chart.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            // Add remove button functionality
            const removeBtn = songItem.querySelector('.selected-song-remove') as HTMLButtonElement;
            removeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectionManager.toggle(chart.id);
                // Selection change event will trigger updateSelectedSongsList automatically
            });
            
            selectedSongsList.appendChild(songItem);
        });
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
     * Modal and complex functionality
     */
    private showScrapeModal(): void {
        DOMUtils.toggleElement('scrapeModal', true);
    }

    private hideScrapeModal(): void {
        DOMUtils.toggleElement('scrapeModal', false);
        this.resetScrapeProgress();
    }

    private showScrapeProgress(): void {
        DOMUtils.toggleElement('scrapeProgress', true);
        DOMUtils.setDisabled('startScrapeModalBtn', true);
        DOMUtils.setDisabled('cancelScrapeBtn', true);
        DOMUtils.setTextContent('startScrapeModalBtn', 'Scraping...');
    }

    private hideScrapeProgress(): void {
        DOMUtils.toggleElement('scrapeProgress', false);
        DOMUtils.setDisabled('startScrapeModalBtn', false);
        DOMUtils.setDisabled('cancelScrapeBtn', false);
        DOMUtils.setInnerHTML('startScrapeModalBtn', '<i class="fas fa-spider"></i> Start Scraping');
    }

    private resetScrapeProgress(): void {
        this.hideScrapeProgress();
        DOMUtils.setTextContent('scrapeProgressLabel', 'Preparing to scrape...');
        DOMUtils.setTextContent('scrapeProgressValue', '0/0');
        DOMUtils.setTextContent('scrapeProgressDetails', 'Starting scrape process...');
        const progressFill = DOMUtils.getRequiredElement('scrapeProgressFill');
        progressFill.style.width = '0%';
    }

    private updateScrapeProgress(current: number, total: number, status: string, details?: string): void {
        const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
        
        DOMUtils.setTextContent('scrapeProgressLabel', status);
        DOMUtils.setTextContent('scrapeProgressValue', `${current}/${total}`);
        if (details) {
            DOMUtils.setTextContent('scrapeProgressDetails', details);
        }
        
        const progressFill = DOMUtils.getRequiredElement('scrapeProgressFill');
        progressFill.style.width = `${percentage}%`;
    }

    private async startScraping(): Promise<void> {
        const source = DOMUtils.getValue('scrapeSource');
        const maxPages = parseInt(DOMUtils.getValue('maxPages')) || 1;
        const incremental = (DOMUtils.getRequiredElement<HTMLInputElement>('incrementalScrape')).checked;
        
        // Show progress UI
        this.showScrapeProgress();
        this.updateScrapeProgress(0, maxPages + 2, 'Starting scrape...', 'Initializing scraping process...');
        
        try {
            if (this.isOnline) {
                // Simulate progress updates during scraping
                this.simulateScrapeProgress(maxPages);
                
                const scrapeRequest = {
                    source,
                    maxPages,
                    incremental
                };
                
                const response = await this.apiClient.startScraping(scrapeRequest);
                
                // Complete progress
                this.updateScrapeProgress(maxPages + 2, maxPages + 2, 'Scraping complete!', 'Processing results...');
                
                // After scraping, reload charts from the database
                if (response.chartsFound !== undefined) {
                    // Reload charts from database to show updated results
                    const chartsResponse = await this.apiClient.getCharts();
                    if (chartsResponse.charts && chartsResponse.charts.length > 0) {
                        this.chartManager.setCharts(convertChartResponsesToCharts(chartsResponse.charts));
                    }
                    
                    // Update status based on scraping results
                    if (response.chartsAdded > 0) {
                        this.updateStatus(`Successfully scraped ${response.chartsAdded} new charts (${response.chartsFound} total found, ${response.chartsDuplicated} duplicates)`);
                        this.updateScrapeProgress(maxPages + 2, maxPages + 2, 'Success!', `Found ${response.chartsAdded} new charts`);
                    } else if (response.chartsFound > 0) {
                        this.updateStatus(`Scraping complete: Found ${response.chartsFound} charts, but all were already in database`);
                        this.updateScrapeProgress(maxPages + 2, maxPages + 2, 'Complete!', `All ${response.chartsFound} charts already in database`);
                    } else {
                        this.updateStatus('No charts found during scraping');
                        this.updateScrapeProgress(maxPages + 2, maxPages + 2, 'Complete!', 'No new charts found');
                    }
                } else if (response.message) {
                    this.updateStatus(response.message);
                    this.updateScrapeProgress(maxPages + 2, maxPages + 2, 'Complete!', response.message);
                } else {
                    this.updateStatus('Scraping completed');
                    this.updateScrapeProgress(maxPages + 2, maxPages + 2, 'Complete!', 'Scraping process finished');
                }
                
                // Hide modal after a short delay
                setTimeout(() => {
                    this.hideScrapeModal();
                }, 2000);
                
            } else {
                this.updateStatus('Cannot scrape charts: No backend connection');
                this.updateScrapeProgress(0, maxPages + 2, 'Error!', 'No backend connection');
                setTimeout(() => {
                    this.hideScrapeModal();
                }, 2000);
            }
        } catch (error) {
            console.error('Scraping failed:', error);
            this.updateStatus('Scraping failed: ' + (error as Error).message);
            this.updateScrapeProgress(0, maxPages + 2, 'Failed!', (error as Error).message);
            setTimeout(() => {
                this.hideScrapeModal();
            }, 3000);
        }
    }

    private async simulateScrapeProgress(maxPages: number): Promise<void> {
        // Simulate more realistic progress updates during scraping
        const steps = [
            { progress: 0.1, message: 'Connecting to source...' },
            { progress: 0.2, message: 'Analyzing page structure...' },
        ];
        
        // Add page scraping steps
        for (let i = 1; i <= maxPages; i++) {
            steps.push({
                progress: 0.2 + (i / maxPages) * 0.7,
                message: `Scraping page ${i} of ${maxPages}...`
            });
        }
        
        steps.push(
            { progress: 0.95, message: 'Processing results...' },
            { progress: 1.0, message: 'Finalizing...' }
        );
        
        for (const step of steps) {
            // Variable delay based on step (scraping pages takes longer)
            const delay = step.message.includes('Scraping page') ? 300 : 150;
            await new Promise(resolve => setTimeout(resolve, delay));
            
            const currentStep = Math.floor(step.progress * (maxPages + 2));
            const totalSteps = maxPages + 2;
            
            this.updateScrapeProgress(
                currentStep, 
                totalSteps, 
                step.message, 
                `Step ${currentStep} of ${totalSteps}`
            );
        }
    }

    private importDatabase(): void {
        const input = DOMUtils.getRequiredElement<HTMLInputElement>('importFile');
        input.click();
    }

    private async clearAllData(): Promise<void> {
        if (confirm('Are you sure you want to clear all chart data? This cannot be undone.')) {
            try {
                // Clear frontend data
                this.chartManager.clearCharts();
                this.selectionManager.clear();
                
                // Clear backend database if online
                if (this.isOnline) {
                    const response = await this.apiClient.clearAllCharts();
                    this.updateStatus(`Cleared ${response.deletedCount} charts from database`);
                } else {
                    this.updateStatus('All local data cleared (offline mode)');
                }
            } catch (error) {
                console.error('Error clearing data:', error);
                this.updateStatus('Error clearing data: ' + (error as Error).message);
            }
        }
    }

    private async startDownload(): Promise<void> {
        try {
            const selectedCharts = this.selectionManager.getSelectedArray();
            
            if (selectedCharts.length === 0) {
                this.updateStatus('No charts selected for download');
                return;
            }

            // Get download directory from UI
            const downloadDirElement = DOMUtils.getElementById('downloadDir') as HTMLInputElement;
            const downloadDir = downloadDirElement?.value || './downloads';

            // Get download options
            this.updateStatus(`Starting download of ${selectedCharts.length} chart(s)...`);

            // Create download request
            const downloadRequest: DownloadRequest= {
                chartIds: selectedCharts,
                downloadDir: downloadDir,
                maxConcurrency: 3,
                overwrite: false,
                timeout: 10000 // 10 seconds per chart
            };

            // Start download via API
            const response = await this.apiClient.startDownload(downloadRequest);
            
            if (response.downloadId) {
                this.updateStatus(`Download started! Download ID: ${response.downloadId}`);
                console.log('Download started successfully:', response);
                
                // Optional: Clear selection after starting download
                this.selectionManager.clear();
            } else {
                throw new Error('No download ID received from server');
            }

        } catch (error) {
            console.error('Download failed:', error);
            this.updateStatus(`Download failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Open directory selection dialog
     */
    private async selectDownloadDirectory(): Promise<void> {
        try {
            // Check if running in Electron
            if (typeof (window as any).electronAPI !== 'undefined') {
                // Use Electron's native directory dialog
                const selectedPath = await (window as any).electronAPI.selectDirectory();
                if (selectedPath) {
                    DOMUtils.setValue('downloadDir', selectedPath);
                    StorageService.saveDownloadDirectory(selectedPath);
                    console.log('Download directory selected:', selectedPath);
                }
            } else {
                // Fallback to web-based directory selection
                const directoryInput = DOMUtils.getElementById('directoryInput') as HTMLInputElement;
                if (directoryInput) {
                    directoryInput.click();
                }
            }
        } catch (error) {
            console.error('Error selecting directory:', error);
        }
    }

    /**
     * Handle directory selection from file input
     */
    private handleDirectorySelection(event: Event): void {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            // Get the first file's path and extract directory
            const file = target.files[0];
            const fullPath = (file as any).webkitRelativePath || file.name;
            
            // Extract directory path (remove filename)
            const pathParts = fullPath.split('/');
            pathParts.pop(); // Remove filename
            const directoryPath = pathParts.join('/') || './';
            
            // Update UI and save to storage
            DOMUtils.setValue('downloadDir', directoryPath);
            StorageService.saveDownloadDirectory(directoryPath);
            
            console.log('Download directory selected:', directoryPath);
        }
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
