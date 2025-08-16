/**
 * API Client for connecting GUI to backend
 */

interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
}

interface APIResponse<T = any> {
    data?: T;
    error?: string;
    message?: string;
}

export class DTXAPIClient {
    private baseUrl: string;

    constructor(baseUrl: string = 'http://localhost:3001') {
        this.baseUrl = baseUrl;
    }

    async request<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
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
    async getCharts(params: Record<string, any> = {}): Promise<any> {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = `/api/charts${queryString ? `?${queryString}` : ''}`;
        return this.request(endpoint);
    }

    async getChart(id: string): Promise<any> {
        return this.request(`/api/charts/${id}`);
    }

    async createChart(chart: any): Promise<any> {
        return this.request('/api/charts', {
            method: 'POST',
            body: JSON.stringify(chart)
        });
    }

    async deleteChart(id: string): Promise<any> {
        return this.request(`/api/charts/${id}`, {
            method: 'DELETE'
        });
    }

    async getStats(): Promise<any> {
        return this.request('/api/charts/stats');
    }

    // Scraping operations
    async startScraping(scrapeRequest: any): Promise<any> {
        return this.request('/api/scrape', {
            method: 'POST',
            body: JSON.stringify(scrapeRequest)
        });
    }

    async getSources(): Promise<any> {
        return this.request('/api/scrape/sources');
    }

    // Download operations
    async startDownload(downloadRequest: any): Promise<any> {
        return this.request('/api/downloads', {
            method: 'POST',
            body: JSON.stringify(downloadRequest)
        });
    }

    async getDownloadStatus(downloadId: string): Promise<any> {
        return this.request(`/api/downloads/${downloadId}`);
    }

    async cancelDownload(downloadId: string): Promise<any> {
        return this.request(`/api/downloads/${downloadId}`, {
            method: 'DELETE'
        });
    }

    // Health check
    async checkHealth(): Promise<any> {
        return this.request('/api/health');
    }
}
