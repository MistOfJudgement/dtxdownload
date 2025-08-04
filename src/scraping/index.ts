/**
 * Scraping module exports
 */

// Interfaces
export * from './interfaces';

// Services
export { ScrapingService } from './scraping-service';

// Base classes
export { BaseScrapingStrategy } from './base-strategy';

// HTTP client
export { HttpClient } from './http-client';
export type { HttpResponse, HttpClientOptions, RateLimitConfig } from './http-client';

// Strategies
export { ApprovedDtxStrategy } from './strategies/approved-dtx';

// Types
export type {
  ScrapingResult,
  Source,
  ScrapingProgress,
  ScrapingOptions
} from './interfaces';
