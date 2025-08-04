/**
 * Core scraping interfaces and types
 */

import { IChart } from '../core/models';

export interface IScrapingStrategy {
  readonly name: string;
  readonly baseUrl: string;
  canHandle(url: string): boolean;
  scrapeCharts(source: Source, options?: ScrapingOptions): Promise<IChart[]>;
  extractChartFromElement(element: any): Promise<IChart | null>;
  getNextPageUrl(currentUrl: string, html: string): Promise<string | null>;
}

export interface IScrapingService {
  scrapeSource(source: Source): Promise<ScrapingResult>;
  getAllSupportedSources(): Source[];
  validateSource(source: Source): Promise<boolean>;
  registerStrategy(strategy: IScrapingStrategy): void;
}

export interface ScrapingResult {
  sourceName: string;
  chartsFound: number;
  chartsAdded: number;
  chartsDuplicated: number;
  errors: string[];
  duration: number;
  nextScrapeTime?: Date;
}

export interface Source {
  name: string;
  enabled: boolean;
  baseUrl: string;
  strategy: string;
  rateLimit: number;
  maxPages?: number;
  customHeaders?: Record<string, string>;
  settings: Record<string, any>;
}

export interface ScrapingProgress {
  sourceName: string;
  currentPage: number;
  totalPages?: number;
  chartsFound: number;
  status: ScrapingStatus;
  startTime: Date;
  estimatedCompletion?: Date;
}

export enum ScrapingStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface ScrapingOptions {
  maxPages?: number;
  respectRobotsTxt?: boolean;
  requestDelay?: number;
  userAgent?: string;
  skipExisting?: boolean;
  onProgress?: (progress: ScrapingProgress) => void;
}
