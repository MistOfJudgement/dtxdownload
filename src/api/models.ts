/**
 * Shared API models for DTX Download Manager
 * These interfaces define the contract between the GUI and API server
 */

// Import shared models to avoid duplication
import type { ChartResponse } from '../../shared/models';
export { 
  ChartQuery, 
  ApiResponse 
} from '../../shared/models';

// Request Models
export interface DownloadRequest {
  chartIds: string[];
  downloadDir?: string;
  maxConcurrency?: number;
  organizeSongFolders?: boolean;
  autoUnzip?: boolean;
  deleteZipAfterExtraction?: boolean;
  overwrite?: boolean;
}

export interface ScrapeRequest {
  sourceName?: string;
  maxPages?: number;
  requestDelay?: number;
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