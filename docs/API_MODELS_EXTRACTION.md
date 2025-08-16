# API Models Extraction and Standardization

## Overview
This document describes the extraction and standardization of API models to resolve mismatches between the GUI options and server commands in the DTX Download Manager.

## Problem Statement
The GUI and API server were using different request/response formats, leading to:
- Inconsistent field naming (`organizeIntoFolders` vs `organizeSongFolders`)
- Different request structures (legacy GUI format vs new API format)
- Type safety issues and potential runtime errors
- Difficulty maintaining backward compatibility

## Solution

### 1. Created Shared API Models (`src/api/models.ts`)

#### Request Models:
- **`DownloadRequest`**: Standard API request format with consistent naming
- **`LegacyDownloadRequest`**: Legacy GUI format for backward compatibility
- **`ScrapeRequest`**: For scraping operations
- **`ChartQuery`**: For chart search/filtering

#### Response Models:
- **`DownloadResponse`**: Standardized download operation results
- **`ChartsListResponse`**: Chart listing with pagination
- **`ScrapeResult`**: Scraping operation results
- **`SourcesResponse`**: Available chart sources
- **`StatsResponse`**: System statistics
- **`ProgressUpdate`**: Real-time progress updates

### 2. Updated API Server (`src/api/simple-server.ts`)

#### Request Format Detection and Conversion:
```typescript
// Check if it's the legacy GUI format
if (requestBody.destination && requestBody.options) {
  // Convert legacy format to new format
  const legacyRequest = requestBody as LegacyDownloadRequest;
  downloadOptions = {
    chartIds: legacyRequest.chartIds,
    downloadDir: legacyRequest.destination,
    maxConcurrency: legacyRequest.concurrency || 3,
    organizeSongFolders: legacyRequest.options.organizeIntoFolders,
    deleteZipAfterExtraction: legacyRequest.options.deleteZipAfterExtraction,
    overwrite: !legacyRequest.skipExisting
  };
} else {
  // Use new format directly
  downloadOptions = { /* ... */ };
}
```

#### Key Mapping Rules:
- `destination` → `downloadDir`
- `concurrency` → `maxConcurrency`
- `options.organizeIntoFolders` → `organizeSongFolders`
- `skipExisting` → `!overwrite` (inverted logic)

### 3. Comprehensive Test Coverage

#### Model Tests (`tests/api/models.test.ts`):
- ✅ Request/response structure validation
- ✅ Optional property handling
- ✅ Type safety verification
- ✅ Edge case coverage

#### Server Logic Tests (`tests/api/server.test.ts`):
- ✅ Legacy to new format conversion
- ✅ Request format detection
- ✅ Default value application
- ✅ Validation logic

#### GUI Compatibility Tests (`tests/api/gui-compatibility.test.ts`):
- ✅ GUI request creation patterns
- ✅ Checkbox state mapping
- ✅ API client integration
- ✅ Storage service compatibility
- ✅ Form validation patterns

## Benefits

### 1. **Type Safety**
- Full TypeScript support for all API interactions
- Compile-time validation of request/response structures
- IntelliSense support for developers

### 2. **Backward Compatibility**
- Existing GUI continues to work without changes
- Smooth migration path to new format
- No breaking changes for users

### 3. **Consistency**
- Standardized field naming across all components
- Clear separation between legacy and modern formats
- Unified approach to optional properties

### 4. **Maintainability**
- Single source of truth for API contracts
- Easy to add new fields or modify existing ones
- Clear documentation through TypeScript interfaces

### 5. **Testing Coverage**
- 25 comprehensive tests covering all scenarios
- Validation of both format conversion and business logic
- GUI compatibility verification

## Usage Examples

### New API Format:
```typescript
const downloadRequest: DownloadRequest = {
  chartIds: ['chart1', 'chart2'],
  downloadDir: './downloads',
  maxConcurrency: 3,
  organizeSongFolders: true,
  deleteZipAfterExtraction: false,
  overwrite: false
};
```

### Legacy GUI Format (still supported):
```typescript
const legacyRequest: LegacyDownloadRequest = {
  chartIds: ['chart1', 'chart2'],
  destination: './downloads',
  concurrency: 3,
  skipExisting: true,
  options: {
    organizeIntoFolders: true,
    deleteZipAfterExtraction: false
  }
};
```

## Migration Path

### Immediate Benefits:
- Server now handles both formats seamlessly
- Type safety for all new development
- Comprehensive test coverage

### Future Improvements:
- Update GUI to use new format gradually
- Add validation middleware using the models
- Implement API versioning if needed

## Files Modified/Created:

### New Files:
- `src/api/models.ts` - Shared API models
- `tests/api/models.test.ts` - Model structure tests
- `tests/api/server.test.ts` - Server logic tests
- `tests/api/gui-compatibility.test.ts` - GUI compatibility tests

### Modified Files:
- `src/api/simple-server.ts` - Updated to handle both formats and use typed responses

## Test Results:
```
Test Suites: 3 passed, 3 total
Tests:       25 passed, 25 total
Snapshots:   0 total
Time:        2.54s
```

All tests pass, confirming that:
- ✅ API models are correctly structured
- ✅ Server handles both request formats
- ✅ Backward compatibility is maintained
- ✅ Type safety is enforced
- ✅ GUI integration patterns work correctly
