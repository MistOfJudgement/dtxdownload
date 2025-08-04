# API Design and Interface Specifications

## Core Domain Interfaces

### Repository Interfaces

```typescript
// Core repository pattern
interface IRepository<T, ID> {
  save(entity: T): Promise<T>;
  findById(id: ID): Promise<T | null>;
  findAll(): Promise<T[]>;
  delete(id: ID): Promise<void>;
  exists(id: ID): Promise<boolean>;
}

// Chart repository with specialized queries
interface IChartRepository extends IRepository<Chart, ChartId> {
  findByTitle(title: string): Promise<Chart[]>;
  findByArtist(artist: string): Promise<Chart[]>;
  findByDifficultyRange(min: number, max: number): Promise<Chart[]>;
  findByBpmRange(min: number, max: number): Promise<Chart[]>;
  findBySource(sourceName: string): Promise<Chart[]>;
  search(criteria: ChartSearchCriteria): Promise<ChartSearchResult>;
  findDuplicates(chart: Chart): Promise<Chart[]>;
}

// Download repository for tracking downloads
interface IDownloadRepository extends IRepository<Download, DownloadId> {
  findByStatus(status: DownloadStatus): Promise<Download[]>;
  findByChart(chartId: ChartId): Promise<Download[]>;
  findActive(): Promise<Download[]>;
  updateProgress(id: DownloadId, progress: number): Promise<void>;
  updateStatus(id: DownloadId, status: DownloadStatus): Promise<void>;
}
```

### Service Interfaces

```typescript
// Scraping service interface
interface IScrapingService {
  scrapeSource(source: Source): Promise<ScrapingResult>;
  getAllSupportedSources(): Source[];
  validateSource(source: Source): Promise<boolean>;
}

// Download service interface
interface IDownloadService {
  downloadChart(chart: Chart): Promise<Download>;
  downloadCharts(charts: Chart[]): Promise<DownloadBatch>;
  getDownloadProgress(downloadId: DownloadId): Promise<DownloadProgress>;
  cancelDownload(downloadId: DownloadId): Promise<void>;
  retryDownload(downloadId: DownloadId): Promise<Download>;
}

// Chart management service
interface IChartService {
  addChart(chart: Chart): Promise<Chart>;
  updateChart(chart: Chart): Promise<Chart>;
  deleteChart(chartId: ChartId): Promise<void>;
  searchCharts(criteria: ChartSearchCriteria): Promise<ChartSearchResult>;
  validateChart(chart: Chart): Promise<ValidationResult>;
  detectDuplicates(chart: Chart): Promise<Chart[]>;
}
```

### Strategy Pattern Interfaces

```typescript
// Scraping strategy for different sources
interface IScrapingStrategy {
  readonly name: string;
  readonly baseUrl: string;
  canHandle(url: string): boolean;
  scrapeCharts(source: Source): Promise<Chart[]>;
  extractChartFromElement(element: any): Promise<Chart | null>;
  getNextPageUrl(currentUrl: string, html: string): Promise<string | null>;
}

// Download provider for different cloud services
interface IDownloadProvider {
  readonly name: string;
  readonly supportedDomains: string[];
  canHandle(url: string): boolean;
  getDirectDownloadUrl(url: string): Promise<string>;
  download(url: string, filePath: string): Promise<DownloadResult>;
  supportsResume(): boolean;
  getFileInfo(url: string): Promise<FileInfo>;
}
```

## Data Transfer Objects (DTOs)

### Request DTOs

```typescript
// Chart search request
interface ChartSearchRequest {
  query?: string;
  artist?: string;
  titleContains?: string;
  minDifficulty?: number;
  maxDifficulty?: number;
  minBpm?: number;
  maxBpm?: number;
  sources?: string[];
  limit?: number;
  offset?: number;
  sortBy?: ChartSortField;
  sortOrder?: SortOrder;
}

// Download request
interface DownloadRequest {
  chartIds: string[];
  concurrency?: number;
  destination?: string;
  skipExisting?: boolean;
}

// Source configuration request
interface SourceConfigRequest {
  name: string;
  baseUrl: string;
  strategyName: string;
  settings: Record<string, any>;
  enabled: boolean;
  rateLimit?: number;
}
```

### Response DTOs

```typescript
// Chart search response
interface ChartSearchResponse {
  charts: ChartDTO[];
  totalCount: number;
  hasMore: boolean;
  searchTime: number;
}

// Chart data transfer object
interface ChartDTO {
  id: string;
  title: string;
  artist: string;
  bpm: string;
  difficulties: number[];
  downloadUrl: string;
  imageUrl?: string;
  source: string;
  createdAt: string;
  fileSize?: number;
  tags?: string[];
}

// Download progress response
interface DownloadProgressResponse {
  downloadId: string;
  chartId: string;
  status: DownloadStatus;
  progress: number;
  speed?: number;
  estimatedTimeRemaining?: number;
  error?: string;
  startTime: string;
  endTime?: string;
}

// Scraping result response
interface ScrapingResultResponse {
  sourceName: string;
  chartsFound: number;
  chartsAdded: number;
  chartsDuplicated: number;
  errors: string[];
  duration: number;
  nextScrapeTime?: string;
}
```

## REST API Endpoints

### Chart Management

```typescript
// GET /api/charts - Search and list charts
GET /api/charts?query=string&artist=string&limit=number&offset=number
Response: ChartSearchResponse

// GET /api/charts/:id - Get specific chart
GET /api/charts/550e8400-e29b-41d4-a716-446655440000
Response: ChartDTO

// POST /api/charts - Add new chart manually
POST /api/charts
Body: CreateChartRequest
Response: ChartDTO

// PUT /api/charts/:id - Update chart
PUT /api/charts/550e8400-e29b-41d4-a716-446655440000
Body: UpdateChartRequest
Response: ChartDTO

// DELETE /api/charts/:id - Delete chart
DELETE /api/charts/550e8400-e29b-41d4-a716-446655440000
Response: 204 No Content
```

### Download Management

```typescript
// POST /api/downloads - Start new download
POST /api/downloads
Body: DownloadRequest
Response: DownloadBatchResponse

// GET /api/downloads - List downloads
GET /api/downloads?status=string&limit=number
Response: DownloadListResponse

// GET /api/downloads/:id - Get download details
GET /api/downloads/550e8400-e29b-41d4-a716-446655440000
Response: DownloadProgressResponse

// DELETE /api/downloads/:id - Cancel download
DELETE /api/downloads/550e8400-e29b-41d4-a716-446655440000
Response: 204 No Content

// POST /api/downloads/:id/retry - Retry failed download
POST /api/downloads/550e8400-e29b-41d4-a716-446655440000/retry
Response: DownloadProgressResponse
```

### Source Management

```typescript
// GET /api/sources - List all sources
GET /api/sources
Response: SourceListResponse

// POST /api/sources/:name/scrape - Trigger scraping
POST /api/sources/approved-dtx/scrape
Body: ScrapeRequest
Response: ScrapingResultResponse

// GET /api/sources/:name/status - Get source status
GET /api/sources/approved-dtx/status
Response: SourceStatusResponse

// PUT /api/sources/:name/config - Update source config
PUT /api/sources/approved-dtx/config
Body: SourceConfigRequest
Response: SourceConfigResponse
```

### System Management

```typescript
// GET /api/system/stats - System statistics
GET /api/system/stats
Response: SystemStatsResponse

// GET /api/system/health - Health check
GET /api/system/health
Response: HealthCheckResponse

// POST /api/system/cleanup - Cleanup orphaned files
POST /api/system/cleanup
Response: CleanupResultResponse
```

## WebSocket Events

### Real-time Updates

```typescript
// Download progress updates
interface DownloadProgressEvent {
  type: 'download_progress';
  downloadId: string;
  chartId: string;
  progress: number;
  status: DownloadStatus;
  speed?: number;
  eta?: number;
}

// Scraping progress updates
interface ScrapingProgressEvent {
  type: 'scraping_progress';
  sourceName: string;
  currentPage: number;
  totalPages?: number;
  chartsFound: number;
  status: ScrapingStatus;
}

// System notifications
interface SystemNotificationEvent {
  type: 'system_notification';
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
  details?: any;
}
```

## Configuration Schema

### Application Configuration

```typescript
interface AppConfig {
  server: {
    port: number;
    host: string;
    cors: {
      enabled: boolean;
      origins: string[];
    };
  };
  
  database: {
    type: 'sqlite';
    path: string;
    poolSize: number;
    migrations: {
      auto: boolean;
      directory: string;
    };
  };
  
  downloads: {
    directory: string;
    concurrency: number;
    timeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  
  scraping: {
    userAgent: string;
    requestDelay: number;
    maxConcurrency: number;
    respectRobotsTxt: boolean;
  };
  
  logging: {
    level: string;
    format: string;
    file?: string;
  };
}

interface SourceConfig {
  name: string;
  enabled: boolean;
  baseUrl: string;
  strategy: string;
  rateLimit: number;
  maxPages?: number;
  customHeaders?: Record<string, string>;
  settings: Record<string, any>;
}
```

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    traceId: string;
  };
}

// Example error responses
interface ValidationErrorResponse extends ErrorResponse {
  error: {
    code: 'VALIDATION_ERROR';
    message: string;
    details: {
      field: string;
      value: any;
      constraint: string;
    }[];
  };
}

interface NotFoundErrorResponse extends ErrorResponse {
  error: {
    code: 'NOT_FOUND';
    message: string;
    details: {
      resource: string;
      id: string;
    };
  };
}
```

### HTTP Status Codes

```typescript
// Success responses
200 - OK (successful GET, PUT)
201 - Created (successful POST)
204 - No Content (successful DELETE)

// Client error responses
400 - Bad Request (validation errors, malformed request)
401 - Unauthorized (authentication required)
403 - Forbidden (insufficient permissions)
404 - Not Found (resource doesn't exist)
409 - Conflict (resource already exists, constraint violation)
422 - Unprocessable Entity (semantic validation errors)
429 - Too Many Requests (rate limiting)

// Server error responses
500 - Internal Server Error (unexpected server error)
502 - Bad Gateway (upstream service error)
503 - Service Unavailable (temporary service outage)
504 - Gateway Timeout (upstream service timeout)
```

## Authentication and Authorization

### API Key Authentication

```typescript
// Header-based API key
Authorization: Bearer <api-key>

// Query parameter (fallback)
GET /api/charts?api_key=<api-key>
```

### Permission Levels

```typescript
enum Permission {
  READ_CHARTS = 'charts:read',
  WRITE_CHARTS = 'charts:write',
  DELETE_CHARTS = 'charts:delete',
  MANAGE_DOWNLOADS = 'downloads:manage',
  MANAGE_SOURCES = 'sources:manage',
  SYSTEM_ADMIN = 'system:admin'
}

interface ApiKey {
  id: string;
  name: string;
  permissions: Permission[];
  createdAt: string;
  expiresAt?: string;
  lastUsed?: string;
}
```

## Pagination and Filtering

### Pagination Parameters

```typescript
interface PaginationParams {
  limit: number; // Default: 50, Max: 1000
  offset: number; // Default: 0
  cursor?: string; // For cursor-based pagination
}

interface PaginationMeta {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  nextCursor?: string;
}
```

### Filter Operators

```typescript
interface FilterOperator {
  eq: any; // Equals
  ne: any; // Not equals
  gt: any; // Greater than
  gte: any; // Greater than or equal
  lt: any; // Less than
  lte: any; // Less than or equal
  in: any[]; // In array
  nin: any[]; // Not in array
  contains: string; // String contains
  startsWith: string; // String starts with
  endsWith: string; // String ends with
}

// Example usage
GET /api/charts?filter[difficulty][gte]=5.0&filter[difficulty][lte]=8.0
GET /api/charts?filter[artist][contains]=SOUND HOLIC
```
