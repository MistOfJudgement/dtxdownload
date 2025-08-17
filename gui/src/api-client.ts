/**
 * API Client for connecting GUI to backend
 */

import {
  DownloadRequest,
  ChartQuery,
  ScrapeRequest,
  ChartsListResponse,
  ChartResponse,
  DownloadResponse,
  ScrapeResult,
  SourcesResponse,
  StatsResponse,
  HealthResponse,
  ApiResponse
} from '@shared/models';

interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
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
            
            return await response.json() as T;
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    // Chart operations
    async getCharts(params: ChartQuery = {}): Promise<ChartsListResponse> {
        const queryString = new URLSearchParams(
            Object.entries(params).reduce((acc, [key, value]) => {
                if (value !== undefined) {
                    acc[key] = String(value);
                }
                return acc;
            }, {} as Record<string, string>)
        ).toString();
        const endpoint = `/api/charts${queryString ? `?${queryString}` : ''}`;
        return this.request<ChartsListResponse>(endpoint);
    }

    async getChart(id: string): Promise<ChartResponse> {
        return this.request<ChartResponse>(`/api/charts/${id}`);
    }

    async createChart(chart: Partial<ChartResponse>): Promise<ChartResponse> {
        return this.request<ChartResponse>('/api/charts', {
            method: 'POST',
            body: JSON.stringify(chart)
        });
    }

    async deleteChart(id: string): Promise<ApiResponse> {
        return this.request<ApiResponse>(`/api/charts/${id}`, {
            method: 'DELETE'
        });
    }

    async clearAllCharts(): Promise<ApiResponse> {
        return this.request<ApiResponse>('/api/charts', {
            method: 'DELETE'
        });
    }

    async getStats(): Promise<StatsResponse> {
        return this.request<StatsResponse>('/api/stats');
    }

    // Scraping operations
    async startScraping(scrapeRequest: ScrapeRequest): Promise<ScrapeResult> {
        return this.request<ScrapeResult>('/api/scrape', {
            method: 'POST',
            body: JSON.stringify(scrapeRequest)
        });
    }

    async getSources(): Promise<SourcesResponse> {
        return this.request<SourcesResponse>('/api/sources');
    }

    // Download operations
    async startDownload(downloadRequest: DownloadRequest): Promise<DownloadResponse> {
        return this.request<DownloadResponse>('/api/downloads', {
            method: 'POST',
            body: JSON.stringify(downloadRequest)
        });
    }

    async getDownloadStatus(downloadId: string): Promise<DownloadResponse> {
        return this.request<DownloadResponse>(`/api/downloads/${downloadId}`);
    }

    async cancelDownload(downloadId: string): Promise<ApiResponse> {
        return this.request<ApiResponse>(`/api/downloads/${downloadId}`, {
            method: 'DELETE'
        });
    }

    // Health check
    async checkHealth(): Promise<HealthResponse> {
        return this.request<HealthResponse>('/api/health');
    }
}
