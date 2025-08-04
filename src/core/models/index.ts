/**
 * Core domain model for a DTX chart
 */
export interface IChart {
  /** Unique identifier for the chart */
  id: string;
  
  /** Song title */
  title: string;
  
  /** Artist name */
  artist: string;
  
  /** BPM information (can include ranges like "120-140") */
  bpm: string;
  
  /** Array of difficulty ratings */
  difficulties: number[];
  
  /** Source identifier (e.g., "approved-dtx") */
  source: string;
  
  /** URL to download the chart */
  downloadUrl: string;
  
  /** Optional preview image URL */
  previewImageUrl?: string;
  
  /** Tags for categorization */
  tags: string[];
  
  /** When the chart was first discovered */
  createdAt: Date;
  
  /** When the chart was last updated */
  updatedAt: Date;
}

/**
 * Filters for querying charts
 */
export interface IChartFilters {
  /** Filter by title (partial match) */
  title?: string;
  
  /** Filter by artist (partial match) */
  artist?: string;
  
  /** Filter by source */
  source?: string;
  
  /** Filter by minimum difficulty */
  minDifficulty?: number;
  
  /** Filter by maximum difficulty */
  maxDifficulty?: number;
  
  /** Filter by tags */
  tags?: string[];
  
  /** Pagination offset */
  offset?: number;
  
  /** Pagination limit */
  limit?: number;
}

/**
 * Options for querying charts from database
 */
export interface ChartQueryOptions {
  /** Filter by source */
  source?: string;
  
  /** Filter by artist (partial match) */
  artist?: string;
  
  /** Filter by title (partial match) */
  title?: string;
  
  /** Filter by minimum BPM */
  minBpm?: number;
  
  /** Filter by maximum BPM */
  maxBpm?: number;
  
  /** Filter by tags */
  tags?: string[];
  
  /** Sort field */
  sortBy?: 'title' | 'artist' | 'bpm' | 'createdAt' | 'updatedAt';
  
  /** Sort order */
  sortOrder?: 'ASC' | 'DESC';
  
  /** Pagination offset */
  offset?: number;
  
  /** Pagination limit */
  limit?: number;
}

/**
 * Options for scraping operations
 */
export interface IScrapeOptions {
  /** Maximum number of pages to scrape */
  maxPages?: number;
  
  /** Delay between requests (ms) */
  delay?: number;
  
  /** Whether to skip already existing charts */
  skipExisting?: boolean;
  
  /** Custom headers for requests */
  headers?: Record<string, string>;
}

/**
 * Progress callback for downloads
 */
export type ProgressCallback = (progress: IDownloadProgress) => void;

/**
 * Download progress information
 */
export interface IDownloadProgress {
  /** Current bytes downloaded */
  downloaded: number;
  
  /** Total bytes to download (if known) */
  total?: number;
  
  /** Download speed in bytes/second */
  speed?: number;
  
  /** Estimated time remaining in seconds */
  eta?: number;
  
  /** Current status */
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  
  /** Error message if failed */
  error?: string;
}

/**
 * Download queue item
 */
export interface IDownloadItem {
  /** Unique identifier */
  id: string;
  
  /** Chart being downloaded */
  chart: IChart;
  
  /** Destination path */
  destination: string;
  
  /** Current progress */
  progress: IDownloadProgress;
  
  /** Retry count */
  retries: number;
  
  /** When the download was queued */
  queuedAt: Date;
  
  /** When the download started */
  startedAt?: Date;
  
  /** When the download completed */
  completedAt?: Date;
}
