/**
 * DTX Download Manager - Frontend Application
 * Connects to the optimized backend services for chart management and downloading
 * 
 * @fileoverview Main application class for DTX Download Manager
 * @typedef {import('./types.js').IChart} IChart
 * @typedef {import('./types.js').FilterConfig} FilterConfig
 * @typedef {import('./types.js').DownloadOptions} DownloadOptions
 */

class DTXDownloadManager {
    constructor() {
        this.charts = [];
        this.filteredCharts = [];
        this.selectedCharts = new Set();
        this.currentPage = 1;
        this.chartsPerPage = 20;
        this.viewMode = 'grid';
        this.sortBy = 'name';
        this.sortOrder = 'asc';
        this.filterConfig = {
            difficulty: 'all',
            genre: 'all',
            search: ''
        };
        
        // Initialize API client
        this.apiClient = new DTXAPIClient();
        this.isOnline = false;
        
        this.init();
    }

    // Helper function to show/hide elements using CSS classes
    toggleElement(elementId, show) {
        const element = document.getElementById(elementId);
        if (element) {
            if (show) {
                element.classList.remove('hidden');
            } else {
                element.classList.add('hidden');
            }
        }
    }

    // Helper function to show an element and hide others
    showOnly(showElementId, hideElementIds) {
        this.toggleElement(showElementId, true);
        hideElementIds.forEach(id => this.toggleElement(id, false));
    }

    // Initialize the application
    init() {
        this.initializeEventListeners();
        this.loadInitialData();
    }

    // Validate chart data consistency
    validateChart(chart) {
        const errors = [];
        const warnings = [];
        
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
        
        // Warn about potentially mismatched language pairs (not an error, just a warning)
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
            errors: errors,
            warnings: warnings,
            issues: [...errors, ...warnings]  // Keep for backward compatibility
        };
    }

    // Clean and validate existing chart data
    cleanChartData() {
        let cleaned = 0;
        let removed = 0;
        
        this.charts = this.charts.filter(chart => {
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
            this.saveToLocalStorage();
        }
    }

    // Initialize all event listeners
    initializeEventListeners() {
        // Database actions
        document.getElementById('scrapeBtn').addEventListener('click', () => this.showScrapeModal());
        document.getElementById('importBtn').addEventListener('click', () => this.importDatabase());
        document.getElementById('importFile').addEventListener('change', (e) => this.handleFileImport(e));
        document.getElementById('clearDataBtn').addEventListener('click', () => this.clearAllData());
        
        // Scrape modal
        document.getElementById('closeScrapeModal').addEventListener('click', () => this.hideScrapeModal());
        document.getElementById('cancelScrapeBtn').addEventListener('click', () => this.hideScrapeModal());
        document.getElementById('startScrapeModalBtn').addEventListener('click', () => this.startScraping());
        document.getElementById('startScrapeBtn').addEventListener('click', () => this.showScrapeModal());
        
        // Filters
        document.getElementById('searchInput').addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('artistFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('bpmMin').addEventListener('input', () => this.applyFilters());
        document.getElementById('bpmMax').addEventListener('input', () => this.applyFilters());
        document.getElementById('diffMin').addEventListener('input', () => this.applyFilters());
        document.getElementById('diffMax').addEventListener('input', () => this.applyFilters());
        document.getElementById('clearFilters').addEventListener('click', () => this.clearFilters());
        
        // View controls
        document.getElementById('selectAll').addEventListener('change', (e) => this.toggleSelectAll(e.target.checked));
        document.getElementById('gridViewBtn').addEventListener('click', () => this.setViewMode('grid'));
        document.getElementById('listViewBtn').addEventListener('click', () => this.setViewMode('list'));
        document.getElementById('sortSelect').addEventListener('change', (e) => this.setSortBy(e.target.value));
        document.getElementById('sortOrderBtn').addEventListener('click', () => this.toggleSortOrder());
        
        // Pagination
        document.getElementById('prevPageBtn').addEventListener('click', () => this.goToPage(this.currentPage - 1));
        document.getElementById('nextPageBtn').addEventListener('click', () => this.goToPage(this.currentPage + 1));
        
        // Download
        document.getElementById('downloadSelectedBtn').addEventListener('click', () => this.startDownload());
        document.getElementById('closeDownloadModal').addEventListener('click', () => this.hideDownloadModal());
        document.getElementById('cancelDownloadBtn').addEventListener('click', () => this.cancelDownload());
        
        // Selected songs panel
        document.getElementById('clearAllSelectedBtn').addEventListener('click', () => this.clearAllSelected());
        
        // Directory selection
        document.getElementById('selectDirBtn').addEventListener('click', () => this.selectDownloadDirectory());
        
        // Modal click outside to close
        document.getElementById('scrapeModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.hideScrapeModal();
        });
        document.getElementById('downloadModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.hideDownloadModal();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    // Load initial data from localStorage or backend
    async loadInitialData() {
        this.showLoading();
        
        try {
            // Check if backend is available
            await this.checkBackendConnection();
            
            if (this.isOnline) {
                // Load from backend
                const response = await this.apiClient.getCharts();
                this.charts = response.charts || [];
                
                if (this.charts.length === 0) {
                    // No charts in backend, try localStorage
                    await this.loadFromLocalStorage();
                }
            } else {
                // Fallback to localStorage
                await this.loadFromLocalStorage();
            }
            
            // Clean and validate existing data
            this.cleanChartData();
            
            this.filteredCharts = [...this.charts];
            this.populateArtistFilter();
            this.renderCharts();
            this.updateStats();
            
        } catch (error) {
            console.error('Error loading initial data:', error);
            // Fallback to localStorage
            await this.loadFromLocalStorage();
        }
        
        this.hideLoading();
    }

    // Check if backend API is available
    async checkBackendConnection() {
        try {
            await this.apiClient.checkHealth();
            this.isOnline = true;
            this.updateStatus('Connected to backend server');
            console.log('✅ Backend connected');
        } catch (error) {
            this.isOnline = false;
            this.updateStatus('Working offline (no backend connection)');
            console.log('⚠️ Backend not available, working offline');
        }
    }

    // Load data from localStorage
    async loadFromLocalStorage() {
        try {
            const savedCharts = localStorage.getItem('dtx_charts');
            if (savedCharts) {
                this.charts = JSON.parse(savedCharts);
                console.log(`Loaded ${this.charts.length} charts from localStorage`);
            } else {
                this.showEmptyState();
            }
        } catch (error) {
            console.error('Error loading from localStorage:', error);
            this.showEmptyState();
        }
    }

    // Show scrape modal
    showScrapeModal() {
        document.getElementById('scrapeModal').classList.remove('hidden');
    }

    // Hide scrape modal
    hideScrapeModal() {
        document.getElementById('scrapeModal').classList.add('hidden');
    }

    // Start scraping process
    async startScraping() {
        const source = document.getElementById('scrapeSource').value;
        const maxPages = parseInt(document.getElementById('maxPages').value);
        const incremental = document.getElementById('incrementalScrape').checked;
        
        this.hideScrapeModal();
        this.showProgress('Scraping charts...', 0);
        
        try {
            if (this.isOnline) {
                // Use backend API for scraping
                const result = await this.apiClient.startScraping({
                    source: source,
                    maxPages: maxPages,
                    incremental: incremental
                });
                
                this.hideProgress();
                this.updateStatus(`Scraping completed: ${result.chartsFound || 0} charts found`);
                
                // Reload data to show new charts
                await this.loadInitialData();
                
            } else {
                // Fall back to simulation for offline mode
                await this.simulateScraping(source, maxPages, incremental);
                this.hideProgress();
                this.updateStatus('Scraping completed successfully (simulated)');
                this.renderCharts();
                this.updateStats();
            }
            
        } catch (error) {
            console.error('Scraping failed:', error);
            this.hideProgress();
            this.updateStatus('Scraping failed: ' + (error.message || 'Unknown error'));
        }
    }

    // Simulate scraping process (replace with actual backend integration)
    async simulateScraping(source, maxPages, incremental) {
        // Generate sample data for demonstration with proper title-artist matching
        const sampleCharts = [];
        const chartData = [
            { title: 'Sparkle', artist: 'YOASOBI' },
            { title: 'Connect', artist: 'ClariS' },
            { title: 'Divine Intervention', artist: 'fhána' },
            { title: 'CALLING', artist: '樋口楓' },
            { title: 'Twilight', artist: 'shallm' },
            { title: '愛愛愛愛愛', artist: 'PEDRO' },
            { title: 'Racing into the Night', artist: 'YOASOBI' },
            { title: 'irony', artist: 'ClariS' },
            { title: 'Que Sera Sera', artist: 'fhána' },
            { title: '天球、彗星は夜を跨いで', artist: '樋口楓' },
            { title: 'Beautiful Days', artist: 'shallm' },
            { title: 'Friday Night', artist: 'PEDRO' },
            { title: 'Gunjou', artist: 'YOASOBI' },
            { title: 'nexus', artist: 'ClariS' },
            { title: 'Wonder Caravan!', artist: 'fhána' },
            { title: 'シル・ヴ・プレジデント', artist: '樋口楓' },
            { title: 'Deep Blue', artist: 'shallm' },
            { title: 'Sunday', artist: 'PEDRO' }
        ];
        
        for (let i = 0; i < maxPages * 25; i++) {
            const chartInfo = chartData[i % chartData.length];
            const chart = {
                id: `chart_${Date.now()}_${i}`,
                title: chartInfo.title,
                artist: chartInfo.artist,
                bpm: (120 + Math.floor(Math.random() * 100)).toString(),
                difficulties: [
                    Math.round((Math.random() * 4 + 1) * 10) / 10,
                    Math.round((Math.random() * 4 + 3) * 10) / 10,
                    Math.round((Math.random() * 4 + 5) * 10) / 10,
                    Math.round((Math.random() * 4 + 7) * 10) / 10
                ],
                source: source,
                downloadUrl: `https://drive.google.com/file/d/sample_${i}/view`,
                tags: [],
                previewImageUrl: `https://picsum.photos/300/200?random=${i}`,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            sampleCharts.push(chart);
            
            // Update progress
            const progress = ((i + 1) / (maxPages * 25)) * 100;
            this.updateProgress(progress);
            
            // Simulate delay
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        if (incremental) {
            // Filter out existing charts and validate new ones
            const existingIds = new Set(this.charts.map(c => c.id));
            const newCharts = sampleCharts.filter(c => {
                if (existingIds.has(c.id)) return false;
                
                const validation = this.validateChart(c);
                if (!validation.isValid) {
                    console.warn(`Skipping invalid chart: ${c.title} by ${c.artist}`, validation.issues);
                    return false;
                }
                return true;
            });
            this.charts.push(...newCharts);
        } else {
            // Validate all charts before replacing
            const validCharts = sampleCharts.filter(c => {
                const validation = this.validateChart(c);
                if (!validation.isValid) {
                    console.warn(`Skipping invalid chart: ${c.title} by ${c.artist}`, validation.issues);
                    return false;
                }
                return true;
            });
            this.charts = validCharts;
        }
        
        this.filteredCharts = [...this.charts];
        this.saveToLocalStorage();
        this.populateArtistFilter();
    }

    // Import database from file
    importDatabase() {
        document.getElementById('importFile').click();
    }

    // Handle file import
    async handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        this.showProgress('Importing database...', 0);
        
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // Validate data structure
            if (Array.isArray(data)) {
                this.charts = data;
            } else if (data.charts && Array.isArray(data.charts)) {
                this.charts = data.charts;
            } else {
                throw new Error('Invalid file format');
            }
            
            this.filteredCharts = [...this.charts];
            this.saveToLocalStorage();
            this.populateArtistFilter();
            this.renderCharts();
            this.updateStats();
            this.hideProgress();
            this.updateStatus(`Imported ${this.charts.length} charts successfully`);
            
        } catch (error) {
            console.error('Import failed:', error);
            this.hideProgress();
            this.updateStatus('Import failed: ' + error.message);
        }
        
        // Reset file input
        event.target.value = '';
    }

    // Search functionality
    handleSearch(query) {
        this.searchQuery = query.toLowerCase();
        this.applyFilters();
    }

    // Apply all filters
    applyFilters() {
        let filtered = [...this.charts];
        
        // Search filter
        if (this.searchQuery) {
            filtered = filtered.filter(chart => 
                chart.title.toLowerCase().includes(this.searchQuery) ||
                chart.artist.toLowerCase().includes(this.searchQuery)
            );
        }
        
        // Artist filter
        const artistFilter = document.getElementById('artistFilter').value;
        if (artistFilter) {
            filtered = filtered.filter(chart => chart.artist === artistFilter);
        }
        
        // BPM filter
        const bpmMin = document.getElementById('bpmMin').value;
        const bpmMax = document.getElementById('bpmMax').value;
        if (bpmMin) {
            filtered = filtered.filter(chart => parseInt(chart.bpm) >= parseInt(bpmMin));
        }
        if (bpmMax) {
            filtered = filtered.filter(chart => parseInt(chart.bpm) <= parseInt(bpmMax));
        }
        
        // Difficulty filter
        const diffMin = document.getElementById('diffMin').value;
        const diffMax = document.getElementById('diffMax').value;
        if (diffMin) {
            filtered = filtered.filter(chart => Math.max(...chart.difficulties) >= parseFloat(diffMin));
        }
        if (diffMax) {
            filtered = filtered.filter(chart => Math.min(...chart.difficulties) <= parseFloat(diffMax));
        }
        
        this.filteredCharts = filtered;
        this.currentPage = 1;
        this.renderCharts();
        this.updateStats();
    }

    // Clear all filters
    clearFilters() {
        document.getElementById('searchInput').value = '';
        document.getElementById('artistFilter').value = '';
        document.getElementById('bpmMin').value = '';
        document.getElementById('bpmMax').value = '';
        document.getElementById('diffMin').value = '';
        document.getElementById('diffMax').value = '';
        
        this.searchQuery = '';
        this.filteredCharts = [...this.charts];
        this.currentPage = 1;
        this.renderCharts();
        this.updateStats();
    }

    // Populate artist filter dropdown
    populateArtistFilter() {
        const artists = [...new Set(this.charts.map(chart => chart.artist))].sort();
        const select = document.getElementById('artistFilter');
        
        // Clear existing options except "All Artists"
        select.innerHTML = '<option value="">All Artists</option>';
        
        artists.forEach(artist => {
            const option = document.createElement('option');
            option.value = artist;
            option.textContent = artist;
            select.appendChild(option);
        });
    }

    // Set view mode (grid or list)
    setViewMode(mode) {
        this.viewMode = mode;
        
        // Update button states
        document.getElementById('gridViewBtn').classList.toggle('active', mode === 'grid');
        document.getElementById('listViewBtn').classList.toggle('active', mode === 'list');
        
        this.renderCharts();
    }

    // Set sort criteria
    setSortBy(sortBy) {
        this.sortBy = sortBy;
        this.sortCharts();
        this.renderCharts();
    }

    // Toggle sort order
    toggleSortOrder() {
        this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        const icon = document.querySelector('#sortOrderBtn i');
        icon.className = this.sortOrder === 'asc' ? 'fas fa-sort-amount-down' : 'fas fa-sort-amount-up';
        this.sortCharts();
        this.renderCharts();
    }

    // Sort charts
    sortCharts() {
        this.filteredCharts.sort((a, b) => {
            let aVal, bVal;
            
            switch (this.sortBy) {
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
            
            if (aVal < bVal) return this.sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return this.sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // Toggle select all
    toggleSelectAll(checked) {
        if (checked) {
            const currentPageCharts = this.getCurrentPageCharts();
            currentPageCharts.forEach(chart => this.selectedCharts.add(chart.id));
        } else {
            this.selectedCharts.clear();
        }
        
        this.renderCharts();
        this.updateStats();
        this.updateDownloadButton();
        this.updateSelectedSongsPanel();
    }

    // Toggle chart selection
    toggleChartSelection(chartId) {
        if (this.selectedCharts.has(chartId)) {
            this.selectedCharts.delete(chartId);
        } else {
            this.selectedCharts.add(chartId);
        }
        
        this.updateStats();
        this.updateDownloadButton();
        this.updateSelectAllCheckbox();
        this.updateSelectedSongsPanel();
    }

    // Update select all checkbox state
    updateSelectAllCheckbox() {
        const currentPageCharts = this.getCurrentPageCharts();
        const selectedOnPage = currentPageCharts.filter(chart => this.selectedCharts.has(chart.id)).length;
        const selectAllCheckbox = document.getElementById('selectAll');
        
        if (selectedOnPage === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
        } else if (selectedOnPage === currentPageCharts.length) {
            selectAllCheckbox.checked = true;
            selectAllCheckbox.indeterminate = false;
        } else {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = true;
        }
    }

    // Get charts for current page
    getCurrentPageCharts() {
        const startIndex = (this.currentPage - 1) * this.chartsPerPage;
        const endIndex = startIndex + this.chartsPerPage;
        return this.filteredCharts.slice(startIndex, endIndex);
    }

    // Render charts based on current view mode
    renderCharts() {
        if (this.filteredCharts.length === 0) {
            this.showEmptyState();
            return;
        }
        
        this.hideEmptyState();
        this.sortCharts();
        
        if (this.viewMode === 'grid') {
            this.renderGridView();
        } else {
            this.renderListView();
        }
        
        this.renderPagination();
        this.updateSelectAllCheckbox();
    }

    // Render grid view
    renderGridView() {
        const container = document.getElementById('chartsGrid');
        const listContainer = document.getElementById('chartsList');
        
        this.toggleElement('chartsGrid', true);
        this.toggleElement('chartsList', false);
        
        const currentPageCharts = this.getCurrentPageCharts();
        container.innerHTML = '';
        
        currentPageCharts.forEach(chart => {
            const cardElement = this.createChartCard(chart);
            container.appendChild(cardElement);
        });
    }

    // Render list view
    renderListView() {
        const container = document.getElementById('chartsList');
        const gridContainer = document.getElementById('chartsGrid');
        
        this.toggleElement('chartsList', true);
        this.toggleElement('chartsGrid', false);
        
        const currentPageCharts = this.getCurrentPageCharts();
        container.innerHTML = '';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'list-header';
        header.innerHTML = `
            <div></div>
            <div>Image</div>
            <div>Title</div>
            <div class="hide-mobile">Artist</div>
            <div class="hide-mobile">BPM</div>
            <div>Difficulty</div>
        `;
        container.appendChild(header);
        
        // Create items
        currentPageCharts.forEach(chart => {
            const itemElement = this.createListItem(chart);
            container.appendChild(itemElement);
        });
    }

    // Create chart card for grid view
    createChartCard(chart) {
        const card = document.createElement('div');
        card.className = `chart-card ${this.selectedCharts.has(chart.id) ? 'selected' : ''}`;
        card.dataset.chartId = chart.id;
        
        card.innerHTML = `
            <div class="chart-checkbox">
                <label class="checkbox-label">
                    <input type="checkbox" ${this.selectedCharts.has(chart.id) ? 'checked' : ''}>
                    <span class="checkmark"></span>
                </label>
            </div>
                        <img src="${chart.imageUrl || chart.previewImageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y0ZjRmNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4='}" alt="${chart.title}" class="chart-image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y0ZjRmNCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4='">"
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
        `;
        
        // Add event listeners
        const checkbox = card.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            this.toggleChartSelection(chart.id);
            card.classList.toggle('selected', this.selectedCharts.has(chart.id));
        });
        
        card.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                this.toggleChartSelection(chart.id);
                checkbox.checked = this.selectedCharts.has(chart.id);
                card.classList.toggle('selected', this.selectedCharts.has(chart.id));
            }
        });
        
        return card;
    }

    // Create list item for list view
    createListItem(chart) {
        const item = document.createElement('div');
        item.className = `list-item ${this.selectedCharts.has(chart.id) ? 'selected' : ''}`;
        item.dataset.chartId = chart.id;
        
        item.innerHTML = `
            <label class="checkbox-label">
                <input type="checkbox" ${this.selectedCharts.has(chart.id) ? 'checked' : ''}>
                <span class="checkmark"></span>
            </label>
                        <img src="${chart.imageUrl || chart.previewImageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZjRmNGY0Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='}" alt="${chart.title}" class="list-image" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZjRmNGY0Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='">"
            <div class="list-title" title="${chart.title}">${chart.title}</div>
            <div class="list-artist hide-mobile" title="${chart.artist}">${chart.artist}</div>
            <div class="hide-mobile">${chart.bpm} BPM</div>
            <div>${chart.difficulties.join(' / ')}</div>
        `;
        
        // Add event listeners
        const checkbox = item.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            this.toggleChartSelection(chart.id);
            item.classList.toggle('selected', this.selectedCharts.has(chart.id));
        });
        
        item.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                this.toggleChartSelection(chart.id);
                checkbox.checked = this.selectedCharts.has(chart.id);
                item.classList.toggle('selected', this.selectedCharts.has(chart.id));
            }
        });
        
        return item;
    }

    // Render pagination
    renderPagination() {
        const totalPages = Math.ceil(this.filteredCharts.length / this.chartsPerPage);
        const pagination = document.getElementById('pagination');
        
        if (totalPages <= 1) {
            this.toggleElement('pagination', false);
            return;
        }
        
        this.toggleElement('pagination', true);
        
        document.getElementById('currentPage').textContent = this.currentPage;
        document.getElementById('totalPages').textContent = totalPages;
        document.getElementById('prevPageBtn').disabled = this.currentPage === 1;
        document.getElementById('nextPageBtn').disabled = this.currentPage === totalPages;
    }

    // Navigate to page
    goToPage(page) {
        const totalPages = Math.ceil(this.filteredCharts.length / this.chartsPerPage);
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.renderCharts();
    }

    // Start download process
    async startDownload() {
        if (this.selectedCharts.size === 0) return;
        
        const selectedChartObjects = this.charts.filter(chart => this.selectedCharts.has(chart.id));
        
        this.showDownloadModal();
        this.updateDownloadProgress(0, selectedChartObjects.length);
        
        try {
            // Get download options
            const options = {
                chartIds: Array.from(this.selectedCharts),
                downloadDir: document.getElementById('downloadDir').value || './downloads',
                maxConcurrency: 3,
                autoUnzip: document.getElementById('autoUnzip').checked,
                organizeSongFolders: document.getElementById('organizeFolders').checked,
                deleteZipAfterExtraction: document.getElementById('deleteZip').checked
            };
            
            if (this.isOnline) {
                // Use real backend API for downloading
                this.addDownloadLogEntry(`Starting download of ${selectedChartObjects.length} charts...`, 'info');
                const result = await this.apiClient.startDownload(options);
                
                // Process results
                let successful = 0;
                let failed = 0;
                
                if (result.results) {
                    for (const downloadResult of result.results) {
                        if (downloadResult.success) {
                            this.addDownloadLogEntry(`✓ Downloaded: ${downloadResult.title} - ${downloadResult.artist}`, 'success');
                            successful++;
                        } else {
                            this.addDownloadLogEntry(`✗ Failed: ${downloadResult.title} - ${downloadResult.error || 'Unknown error'}`, 'error');
                            failed++;
                        }
                        this.updateDownloadProgress(successful + failed, selectedChartObjects.length);
                    }
                }
                
                this.addDownloadLogEntry(`Download complete: ${successful} successful, ${failed} failed`, successful > 0 ? 'success' : 'error');
                
            } else {
                // Fallback to simulation for offline mode
                this.addDownloadLogEntry('Backend not available, simulating download...', 'info');
                await this.simulateDownload(selectedChartObjects, options);
            }
            
        } catch (error) {
            console.error('Download failed:', error);
            this.addDownloadLogEntry('Download failed: ' + error.message, 'error');
        }
    }

    // Simulate download process (replace with actual backend integration)
    async simulateDownload(charts, options) {
        let completed = 0;
        
        for (const chart of charts) {
            this.addDownloadLogEntry(`Starting download: ${chart.title} - ${chart.artist}`, 'info');
            
            // Simulate download time
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
            
            // Simulate success/failure
            const success = Math.random() > 0.2; // 80% success rate
            
            if (success) {
                this.addDownloadLogEntry(`✓ Downloaded: ${chart.title}`, 'success');
            } else {
                this.addDownloadLogEntry(`✗ Failed: ${chart.title} - Network error`, 'error');
            }
            
            completed++;
            this.updateDownloadProgress(completed, charts.length);
        }
        
        this.addDownloadLogEntry(`Download complete: ${completed}/${charts.length} charts`, 'success');
    }

    // Update download progress
    updateDownloadProgress(completed, total) {
        const percentage = (completed / total) * 100;
        document.getElementById('downloadProgressFill').style.width = `${percentage}%`;
        document.querySelector('#downloadModal .progress-value').textContent = `${completed}/${total}`;
        document.querySelector('#downloadModal .progress-label').textContent = 
            completed === total ? 'Download Complete' : 'Downloading...';
    }

    // Add download log entry
    addDownloadLogEntry(message, type = 'info') {
        const log = document.getElementById('downloadLog');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }

    // Show/hide download modal
    showDownloadModal() {
        document.getElementById('downloadModal').classList.remove('hidden');
        document.getElementById('downloadLog').innerHTML = '';
    }

    hideDownloadModal() {
        document.getElementById('downloadModal').classList.add('hidden');
    }

    // Cancel download
    cancelDownload() {
        // Implement download cancellation logic
        this.hideDownloadModal();
        this.updateStatus('Download cancelled');
    }

    // Select download directory (would need file system access)
    selectDownloadDirectory() {
        // For web implementation, this would need to use File System Access API
        // For now, just allow manual input
        const current = document.getElementById('downloadDir').value || './downloads';
        const newDir = prompt('Enter download directory:', current);
        if (newDir) {
            document.getElementById('downloadDir').value = newDir;
        }
    }

    // Update download button state
    updateDownloadButton() {
        const button = document.getElementById('downloadSelectedBtn');
        button.disabled = this.selectedCharts.size === 0;
        button.innerHTML = this.selectedCharts.size === 0 
            ? '<i class="fas fa-download"></i> Download Selected'
            : `<i class="fas fa-download"></i> Download ${this.selectedCharts.size} Charts`;
    }

    // Clear all selected charts
    clearAllSelected() {
        this.selectedCharts.clear();
        this.renderCharts();
        this.updateStats();
        this.updateDownloadButton();
        this.updateSelectedSongsPanel();
        this.updateSelectAllCheckbox();
    }

    // Update the selected songs panel
    updateSelectedSongsPanel() {
        const panel = document.getElementById('selectedSongsPanel');
        const countElement = document.getElementById('selectedSongsCount');
        const listElement = document.getElementById('selectedSongsList');
        const clearAllBtn = document.getElementById('clearAllSelectedBtn');
        
        countElement.textContent = this.selectedCharts.size;
        clearAllBtn.disabled = this.selectedCharts.size === 0;
        
        if (this.selectedCharts.size === 0) {
            listElement.innerHTML = `
                <div class="no-selection-message">
                    <i class="fas fa-music"></i>
                    <p>No songs selected</p>
                    <p class="text-muted">Select charts from the grid to see them here</p>
                </div>
            `;
        } else {
            const selectedChartObjects = this.charts.filter(chart => this.selectedCharts.has(chart.id));
            listElement.innerHTML = selectedChartObjects.map(chart => `
                <div class="selected-song-item" data-chart-id="${chart.id}">
                    <img src="${chart.imageUrl || chart.previewImageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI4IiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm88L3RleHQ+PC9zdmc+'}" 
                         alt="${chart.title}" 
                         class="selected-song-image"
                         onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI4IiBmaWxsPSIjOWNhM2FmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+Tm88L3RleHQ+PC9zdmc+'">
                    <div class="selected-song-info">
                        <div class="selected-song-title" title="${chart.title}">${chart.title}</div>
                        <div class="selected-song-artist" title="${chart.artist}">${chart.artist}</div>
                    </div>
                    <button class="selected-song-remove" onclick="window.dtxManager.removeSongFromSelection('${chart.id}')" title="Remove from selection">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
        }
    }

    // Remove a specific song from selection
    removeSongFromSelection(chartId) {
        this.selectedCharts.delete(chartId);
        this.renderCharts();
        this.updateStats();
        this.updateDownloadButton();
        this.updateSelectedSongsPanel();
        this.updateSelectAllCheckbox();
    }

    // Update statistics
    updateStats() {
        document.getElementById('totalCharts').textContent = this.filteredCharts.length;
        document.getElementById('selectedCount').textContent = this.selectedCharts.size;
    }

    // Show/hide loading state
    showLoading() {
        this.isLoading = true;
        this.showOnly('loadingSpinner', ['emptyState', 'chartsGrid', 'chartsList']);
    }

    hideLoading() {
        this.isLoading = false;
        this.toggleElement('loadingSpinner', false);
    }

    // Show/hide empty state
    showEmptyState() {
        this.showOnly('emptyState', ['chartsGrid', 'chartsList', 'pagination']);
    }

    hideEmptyState() {
        this.toggleElement('emptyState', false);
    }

    // Show/hide progress indicator
    showProgress(message, percentage) {
        this.updateStatus(message);
        this.toggleElement('progressContainer', true);
        this.updateProgress(percentage);
    }

    hideProgress() {
        this.toggleElement('progressContainer', false);
    }

    updateProgress(percentage) {
        document.getElementById('progressFill').style.width = `${percentage}%`;
        document.getElementById('progressText').textContent = `${Math.round(percentage)}%`;
    }

    // Update status message
    updateStatus(message) {
        document.getElementById('statusMessage').textContent = message;
    }

    // Save to localStorage
    saveToLocalStorage() {
        try {
            localStorage.setItem('dtx_charts', JSON.stringify(this.charts));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }

    // Handle keyboard shortcuts
    handleKeyboardShortcuts(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'a':
                    event.preventDefault();
                    document.getElementById('selectAll').checked = true;
                    this.toggleSelectAll(true);
                    break;
                case 'f':
                    event.preventDefault();
                    document.getElementById('searchInput').focus();
                    break;
                case 'd':
                    event.preventDefault();
                    if (this.selectedCharts.size > 0) {
                        this.startDownload();
                    }
                    break;
            }
        }
        
        if (event.key === 'Escape') {
            this.hideScrapeModal();
            this.hideDownloadModal();
        }
    }

    // Clear all data (localStorage and memory)
    clearAllData() {
        if (confirm('Are you sure you want to clear all chart data? This cannot be undone.')) {
            try {
                // Clear memory
                this.charts = [];
                this.filteredCharts = [];
                this.selectedCharts.clear();
                
                // Clear localStorage
                localStorage.removeItem('dtx_charts');
                
                // Reset UI
                this.populateArtistFilter();
                this.showEmptyState();
                this.updateStats();
                this.updateDownloadButton();
                
                this.updateStatus('All data cleared successfully');
                console.log('✅ All chart data cleared');
                
            } catch (error) {
                console.error('Error clearing data:', error);
                this.updateStatus('Error clearing data');
            }
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dtxManager = new DTXDownloadManager();
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DTXDownloadManager;
}
