/**
 * Shared API models for DTX Download Manager
 * These interfaces define the contract between the GUI and API server
 */

// Import core chart interface for type manipulation
import type { IChart } from '../src/core/models';

// Request Models
export interface DownloadRequest {
  chartIds: string[];
  downloadDir: string;
  maxConcurrency: number;
  overwrite: boolean;
  timeout: number;
}

export interface ScrapeRequest {
  sourceName?: string;
  maxPages?: number;
  requestDelay?: number;
  incremental?: boolean;
  resumeFromOlder?: boolean;
}

/**
 * Chart query interface derived from IChart using type manipulation
 * This ensures the API query stays in sync with the core chart model
 */
type FilterableChartFields = Pick<IChart, 'title' | 'artist' | 'source' | 'bpm' | 'tags'>;
type SortableChartFields = keyof Pick<IChart, 'title' | 'artist' | 'bpm' | 'createdAt' | 'updatedAt'>;

export interface ChartQuery extends Partial<FilterableChartFields> {
  /** General search query across multiple fields */
  query?: string;
  
  /** Partial title match */
  titleContains?: string;
  
  /** Minimum BPM */
  minBpm?: number;
  
  /** Maximum BPM */
  maxBpm?: number;
  
  /** Minimum difficulty */
  minDifficulty?: number;
  
  /** Maximum difficulty */
  maxDifficulty?: number;
  
  /** Multiple sources filter */
  sources?: string[];
  
  /** Sort field - derived from IChart keys */
  sortBy?: SortableChartFields;
  
  /** Sort order */
  sortOrder?: 'asc' | 'desc';
  
  /** Pagination offset */
  offset?: number;
  
  /** Pagination limit */
  limit?: number;
}

// Response Models
export interface ApiResponse<T = any> {
  success?: boolean;
  error?: string;
  message?: string;
  data?: T;
  deletedCount?: number;
}

/**
 * Chart response interface derived from IChart using type manipulation
 * This ensures the API response stays in sync with the core chart model
 */
export interface ChartResponse extends Omit<IChart, 'createdAt' | 'updatedAt'> {
  /** Optional image URL (alias for previewImageUrl) */
  imageUrl?: string;
  
  /** ISO date strings for JSON serialization */
  createdAt?: string;
  updatedAt?: string;
}

export interface ChartsListResponse {
  charts: ChartResponse[];
  totalCount: number;
  hasMore: boolean;
}

export interface DownloadResult {
  chartId: string;
  title: string;
  artist: string;
  success: boolean;
  error?: string;
  filePath?: string;
  fileSize?: number;
  downloadTime?: number;
}

export interface DownloadResponse {
  downloadId: string;
  message: string;
  successful: number;
  failed: number;
  total: number;
  results: DownloadResult[];
}

export interface ProgressUpdate {
  downloadId: string;
  state: any;
  progress: any;
  timestamp: string;
}

export interface ScrapeResult {
  sourceName: string;
  chartsFound: number;
  chartsAdded: number;
  chartsDuplicated: number;
  errors: string[];
  duration: number;
  message?: string;
}

export interface SourceInfo {
  name: string;
  baseUrl: string;
  enabled: boolean;
  strategy: string;
  rateLimit: number;
  maxPages: number;
}

export interface SourcesResponse {
  sources: SourceInfo[];
}

export interface StatsResponse {
  totalCharts: number;
  chartsBySource: Record<string, number>;
  sources: number;
  enabledSources: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
}
