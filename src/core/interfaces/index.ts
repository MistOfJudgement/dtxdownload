import { IChart, IChartFilters, IScrapeOptions, IDownloadItem, ProgressCallback } from '../models';

/**
 * Abstract interface for chart sources (websites, APIs, etc.)
 */
export interface IChartSource {
  /** Unique name for this source */
  readonly name: string;
  
  /** Base URL of the source */
  readonly baseUrl: string;
  
  /** Whether this source is currently available */
  readonly isAvailable: boolean;
  
  /**
   * Scrape charts from this source
   * Returns an async iterator for streaming results
   */
  scrapeCharts(options?: IScrapeOptions): AsyncIterableIterator<IChart>;
  
  /**
   * Validate that a chart from this source is still valid
   */
  validateChart(chart: IChart): Promise<boolean>;
  
  /**
   * Get metadata about this source
   */
  getMetadata(): Promise<ISourceMetadata>;
}

/**
 * Repository interface for chart persistence
 */
export interface IChartRepository {
  /**
   * Save a chart to storage
   */
  save(chart: IChart): Promise<void>;
  
  /**
   * Save multiple charts in a batch
   */
  saveBatch(charts: IChart[]): Promise<void>;
  
  /**
   * Find a chart by ID
   */
  findById(id: string): Promise<IChart | null>;
  
  /**
   * Find charts matching filters
   */
  findByFilters(filters: IChartFilters): Promise<IChart[]>;
  
  /**
   * Count total charts
   */
  count(filters?: Partial<IChartFilters>): Promise<number>;
  
  /**
   * Check if a chart exists
   */
  exists(id: string): Promise<boolean>;
  
  /**
   * Delete a chart
   */
  delete(id: string): Promise<void>;
  
  /**
   * Get all unique sources
   */
  getSources(): Promise<string[]>;
}

/**
 * Download provider interface for different cloud services
 */
export interface IDownloadProvider {
  /** Name of this provider */
  readonly name: string;
  
  /** Domains this provider can handle */
  readonly supportedDomains: string[];
  
  /**
   * Check if this provider can handle the given URL
   */
  canHandle(url: string): boolean;
  
  /**
   * Download a file from the given URL
   */
  download(url: string, destination: string, progress?: ProgressCallback): Promise<void>;
  
  /**
   * Get direct download URL if available
   */
  getDirectUrl?(url: string): Promise<string>;
  
  /**
   * Validate that a URL is still accessible
   */
  validateUrl(url: string): Promise<boolean>;
}

/**
 * Download queue manager interface
 */
export interface IDownloadQueue {
  /**
   * Add an item to the download queue
   */
  enqueue(chart: IChart, destination: string): Promise<string>;
  
  /**
   * Get queue status
   */
  getStatus(): Promise<IQueueStatus>;
  
  /**
   * Get all items in queue
   */
  getItems(): Promise<IDownloadItem[]>;
  
  /**
   * Cancel a download
   */
  cancel(itemId: string): Promise<void>;
  
  /**
   * Retry a failed download
   */
  retry(itemId: string): Promise<void>;
  
  /**
   * Clear completed/failed items
   */
  clear(): Promise<void>;
  
  /**
   * Start processing the queue
   */
  start(): Promise<void>;
  
  /**
   * Stop processing the queue
   */
  stop(): Promise<void>;
}

/**
 * Configuration service interface
 */
export interface IConfigService {
  /**
   * Get a configuration value
   */
  get<T>(key: string, defaultValue?: T): T;
  
  /**
   * Set a configuration value
   */
  set(key: string, value: unknown): Promise<void>;
  
  /**
   * Get all configuration
   */
  getAll(): Record<string, unknown>;
  
  /**
   * Validate configuration
   */
  validate(): Promise<IConfigValidation>;
}

/**
 * Logging interface
 */
export interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, error?: Error, ...args: unknown[]): void;
}

// Supporting interfaces

export interface ISourceMetadata {
  name: string;
  description: string;
  totalCharts?: number;
  lastUpdated?: Date;
  tags: string[];
}

export interface IQueueStatus {
  pending: number;
  downloading: number;
  completed: number;
  failed: number;
  totalSize?: number;
  downloadedSize?: number;
  averageSpeed?: number;
  eta?: number;
}

export interface IConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
