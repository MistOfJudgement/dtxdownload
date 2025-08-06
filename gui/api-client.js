/**
 * API Client for connecting GUI to backend
 */

class DTXAPIClient {
    constructor(baseUrl = 'http://localhost:3001') {
        this.baseUrl = baseUrl;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                throw new Error(`API Error: ${response.status} ${response.statusText}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    // Chart operations
    async getCharts(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = `/api/charts${queryString ? `?${queryString}` : ''}`;
        return this.request(endpoint);
    }

    async getChart(id) {
        return this.request(`/api/charts/${id}`);
    }

    async createChart(chart) {
        return this.request('/api/charts', {
            method: 'POST',
            body: JSON.stringify(chart)
        });
    }

    async deleteChart(id) {
        return this.request(`/api/charts/${id}`, {
            method: 'DELETE'
        });
    }

    async getStats() {
        return this.request('/api/charts/stats');
    }

    // Scraping operations
    async startScraping(scrapeRequest) {
        return this.request('/api/scrape', {
            method: 'POST',
            body: JSON.stringify(scrapeRequest)
        });
    }

    async getSources() {
        return this.request('/api/scrape/sources');
    }

    // Download operations
    async startDownload(downloadRequest) {
        return this.request('/api/downloads', {
            method: 'POST',
            body: JSON.stringify(downloadRequest)
        });
    }

    async getDownloadStatus(downloadId) {
        return this.request(`/api/downloads/${downloadId}`);
    }

    async cancelDownload(downloadId) {
        return this.request(`/api/downloads/${downloadId}`, {
            method: 'DELETE'
        });
    }

    // Health check
    async checkHealth() {
        return this.request('/api/health');
    }
}
