/**
 * Base application error
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = this.constructor.name;
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Chart-related errors
 */
export class ChartNotFoundError extends AppError {
  readonly code = 'CHART_NOT_FOUND';
  
  constructor(chartId: string) {
    super(`Chart not found: ${chartId}`);
  }
}

export class ChartValidationError extends AppError {
  readonly code = 'CHART_VALIDATION_ERROR';
  
  constructor(message: string, public readonly field?: string) {
    super(`Chart validation failed: ${message}`);
  }
}

/**
 * Source-related errors
 */
export class SourceUnavailableError extends AppError {
  readonly code = 'SOURCE_UNAVAILABLE';
  
  constructor(sourceName: string) {
    super(`Source is unavailable: ${sourceName}`);
  }
}

export class ScrapingError extends AppError {
  readonly code = 'SCRAPING_ERROR';
  
  constructor(sourceName: string, cause?: Error) {
    super(`Failed to scrape from source: ${sourceName}`, cause);
  }
}

/**
 * Download-related errors
 */
export class DownloadProviderNotFoundError extends AppError {
  readonly code = 'DOWNLOAD_PROVIDER_NOT_FOUND';
  
  constructor(url: string) {
    super(`No download provider found for URL: ${url}`);
  }
}

export class DownloadFailedError extends AppError {
  readonly code = 'DOWNLOAD_FAILED';
  
  constructor(url: string, cause?: Error) {
    super(`Download failed for URL: ${url}`, cause);
  }
}

export class DownloadTimeoutError extends AppError {
  readonly code = 'DOWNLOAD_TIMEOUT';
  
  constructor(url: string, timeout: number) {
    super(`Download timed out after ${timeout}ms for URL: ${url}`);
  }
}

/**
 * Storage-related errors
 */
export class StorageConnectionError extends AppError {
  readonly code = 'STORAGE_CONNECTION_ERROR';
  
  constructor(cause?: Error) {
    super('Failed to connect to storage', cause);
  }
}

/**
 * Configuration errors
 */
export class ConfigurationError extends AppError {
  readonly code = 'CONFIGURATION_ERROR';
  
  constructor(key: string, message: string) {
    super(`Configuration error for '${key}': ${message}`);
  }
}

/**
 * Network errors
 */
export class RateLimitError extends AppError {
  readonly code = 'RATE_LIMIT_ERROR';
  
  constructor(retryAfter?: number) {
    super(`Rate limit exceeded${retryAfter ? `, retry after ${retryAfter}s` : ''}`);
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Extract error message safely
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Extract error code safely
 */
export function getErrorCode(error: unknown): string {
  if (isAppError(error)) {
    return error.code;
  }
  return 'UNKNOWN_ERROR';
}
