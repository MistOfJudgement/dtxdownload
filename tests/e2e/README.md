# End-to-End Tests

This directory contains comprehensive end-to-end tests for the DTX download system.

## Test Structure

### 1. Database Scraping (`database-scraping.e2e.test.ts`)
Tests the complete scraping workflow:
- ✅ Scrape charts from ApprovedDTX source
- ✅ Store charts in database with proper data integrity
- ✅ Handle incremental scraping and duplicate detection
- ✅ Database search and filtering operations
- ✅ Error handling for network issues

### 2. Download and Unzip (`download-unzip.e2e.test.ts`)
Tests the download automation system:
- ✅ Google Drive folder URL handling (clean error messages)
- ✅ Individual Google Drive file URL automation attempts
- ✅ Direct HTTP downloads
- ✅ Automatic unzipping and song folder organization
- ✅ Download options and configuration
- ✅ Concurrent download management

### 3. Full Workflow (`full-workflow.e2e.test.ts`)
Tests the complete end-to-end workflow:
- ✅ Scrape → Search → Download pipeline
- ✅ CLI-like usage patterns
- ✅ Mixed URL type handling
- ✅ Error handling across the entire system
- ✅ Data integrity throughout the workflow

## Running Tests

### All E2E Tests
```bash
npm run test:e2e
```

### Individual Test Suites
```bash
# Database scraping only
npm run test:e2e:scraping

# Download and unzip only
npm run test:e2e:download

# Full workflow only
npm run test:e2e:full
```

### Test Options
```bash
# Watch mode for development
npm run test:watch

# With coverage report
npm run test:coverage

# Unit tests only
npm run test:unit
```

## Test Configuration

### Timeouts
- Default: 30 seconds
- Network operations: 60-120 seconds
- Full workflow: 120 seconds

### Test Data
- Uses real ApprovedDTX source (limited pages for testing)
- Creates temporary databases and download directories
- Automatically cleans up test files

### Network Considerations
E2E tests make actual network requests to:
- ApprovedDTX website for scraping
- Test HTTP endpoints for download verification
- Google Drive (for URL format testing)

Tests are designed to handle network failures gracefully and won't fail due to temporary connectivity issues.

## Test Coverage

### Scenarios Covered
1. **Scraping**
   - ✅ Successful chart scraping
   - ✅ Duplicate detection
   - ✅ Data validation
   - ✅ Error handling

2. **Downloads**
   - ✅ Google Drive folder URLs (expected failure)
   - ✅ Google Drive file URLs (automation attempt)
   - ✅ Direct HTTP downloads
   - ✅ Concurrent downloads

3. **File Processing**
   - ✅ Automatic unzipping
   - ✅ Song folder organization
   - ✅ File cleanup options
   - ✅ Metadata generation

4. **Error Handling**
   - ✅ Network errors
   - ✅ Invalid URLs
   - ✅ Mixed URL types
   - ✅ Database errors

## Development

### Adding New Tests
1. Create test files with `.e2e.test.ts` extension
2. Use the existing test structure as a template
3. Include proper cleanup in `afterEach` blocks
4. Add descriptive console logging for test progress

### Test Utilities
- `createTestZipFile()` - Creates sample ZIP files
- `getChartsFromDatabase()` - Retrieves charts from test database
- `generateStats()` - Generates statistics from chart data
- `getUrlType()` - Identifies URL types for testing

### Best Practices
1. Always clean up test files and databases
2. Use realistic test data when possible
3. Handle network failures gracefully
4. Include progress logging for long-running tests
5. Test both success and failure scenarios

## Continuous Integration

These tests are designed to run in CI environments:
- Handle network timeouts gracefully
- Clean up all temporary files
- Provide clear failure messages
- Skip tests that require specific network conditions

## Expected Results

### Typical E2E Test Run
```
🧪 E2E Test: Starting ApprovedDTX scraping...
📊 Scraped 15 charts, 0 duplicated, 0 errors
✅ Successfully scraped 15 charts

🧪 E2E Test: Testing Google Drive folder URL handling...
📊 Download result: FAILED
📝 Message: Google Drive folder URLs are not supported for automatic download
✅ Google Drive folder URL handling working correctly

🧪 E2E Test: Full workflow - Scrape → Search → Download
📋 Step 1: Setting up scraping service...
🔍 Step 2: Scraping charts from ApprovedDTX...
📊 Scraping completed: 12 charts added, 0 errors
🔍 Step 3: Testing search and filtering...
⬇️  Step 4: Testing download scenarios...
📊 Download results summary:
   Total attempted: 3
   Successful: 0
   Failed: 3
📊 Results by URL type:
   Google Drive folders: 3 (3 failed as expected)
   Google Drive files: 0 (0 successful)
   Other URLs: 0 (0 successful)
✅ Download behavior verification completed
🎉 Full workflow test completed successfully!
```

The system correctly identifies that most ApprovedDTX charts use Google Drive folder URLs, which require manual download, while maintaining full automation capabilities for individual file URLs.
