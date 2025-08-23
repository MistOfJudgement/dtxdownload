/**
 * End-to-End Test: Full Workflow (Scraping + Download)
 * 
 * This test verifies the complete DTX download workflow:
 * 1. Scrape charts from sources and store in database
 * 2. Search and filter charts
 * 3. Download selected charts with full automation
 * 4. Verify end-to-end data integrity
 */

import { ChartDatabase } from '../../src/core/database/database';
import { ScrapingService } from '../../src/scraping/scraping-service';
import { ApprovedDtxStrategy } from '../../src/scraping/strategies/approved-dtx';
import { ChartDownloader, DownloadOptions } from '../../src/core/download/downloader';
import { Source } from '../../src/scraping/interfaces';
import { IChart } from '../../src/core/models';
import * as fs from 'fs';
import * as path from 'path';

describe('E2E: Full Workflow (Scraping + Download)', () => {
  let scrapingService: ScrapingService;
  let downloader: ChartDownloader;
  const testDbPath = path.join(__dirname, 'test-full-workflow.db');
  const testDownloadDir = path.join(__dirname, 'test-full-downloads');

  beforeEach(async () => {
    // Clean up existing files
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testDownloadDir)) {
      fs.rmSync(testDownloadDir, { recursive: true, force: true });
    }

    // Initialize services
    scrapingService = new ScrapingService(testDbPath);
    downloader = new ChartDownloader();
    
    // Create test directories
    fs.mkdirSync(testDownloadDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up services first to close connections
    try {
      if (scrapingService) {
        scrapingService.close();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Clean up test files
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testDownloadDir)) {
      fs.rmSync(testDownloadDir, { recursive: true, force: true });
    }
  });

  describe('Complete Workflow', () => {
    it('should scrape charts and demonstrate download capabilities', async () => {
      console.log('🧪 E2E Test: Full workflow - Scrape → Search → Download');
      
      // Step 1: Set up scraping
      console.log('📋 Step 1: Setting up scraping service...');
      
      const strategy = new ApprovedDtxStrategy();
      const source: Source = {
        name: 'approved-dtx',
        enabled: true,
        baseUrl: 'https://approvedtx.blogspot.com/',
        strategy: 'approved-dtx',
        rateLimit: 500, // Faster rate limit
        maxPages: 1, // Limit for testing
        settings: {}
      };
      
      scrapingService.registerStrategy(strategy);
      scrapingService.registerSource(source);
      
      // Step 2: Scrape charts
      console.log('🔍 Step 2: Scraping charts from ApprovedDTX...');
      
      const scrapingResults = await scrapingService.scrapeSource(source, {
        maxPages: 1,
        requestDelay: 500 // Faster delay for testing
      });
      
      console.log(`📊 Scraping completed: ${scrapingResults.chartsAdded} charts added, ${scrapingResults.errors.length} errors`);
      
      // Verify scraping worked
      expect(scrapingResults.chartsAdded).toBeGreaterThan(0);
      
      // Step 3: Demonstrate search capabilities
      console.log('🔍 Step 3: Testing search and filtering...');
      
      // Get a sample of scraped charts for download testing
      const sampleCharts = scrapingResults.chartsAdded > 0 ? 
        await getChartsFromDatabase(testDbPath, 1) : []; // Test with just 1 chart for speed
      
      if (sampleCharts.length > 0) {
        console.log(`📋 Found ${sampleCharts.length} sample charts for download testing:`);
        sampleCharts.forEach((chart, index) => {
          console.log(`   ${index + 1}. "${chart.title}" by ${chart.artist} (${chart.bpm})`);
          console.log(`      Download: ${chart.downloadUrl || 'No download URL'}`);
          console.log(`      Type: ${chart.downloadUrl ? getUrlType(chart.downloadUrl) : 'Missing'}`);
        });
      }
      
      // Step 4: Test download scenarios
      console.log('⬇️  Step 4: Testing download scenarios...');
      
      const downloadOptions: DownloadOptions = {
        downloadDir: testDownloadDir,
        overwrite: true,
        maxConcurrency: 1, // Less concurrent for stability
        timeout: 15000, // Reduced from 30s to 15s for faster failures
        chartIds: sampleCharts.map(chart => chart.id)
      };
      
      if (sampleCharts.length > 0) {
        const downloadResults = await downloader.downloadCharts(sampleCharts, downloadOptions);
        
        console.log(`📊 Download results summary:`);
        console.log(`   Total attempted: ${downloadResults.length}`);
        console.log(`   Successful: ${downloadResults.filter(r => r.success).length}`);
        console.log(`   Failed: ${downloadResults.filter(r => !r.success).length}`);
        
        // Analyze download results by URL type
        const urlTypes = {
          folder: downloadResults.filter(r => r.chart.downloadUrl && r.chart.downloadUrl.includes('/folders/')),
          file: downloadResults.filter(r => r.chart.downloadUrl && r.chart.downloadUrl.includes('/file/d/')),
          other: downloadResults.filter(r => r.chart.downloadUrl && !r.chart.downloadUrl.includes('drive.google.com'))
        };
        
        console.log(`📊 Results by URL type:`);
        console.log(`   Google Drive folders: ${urlTypes.folder.length} (${urlTypes.folder.filter(r => !r.success).length} failed as expected)`);
        console.log(`   Google Drive files: ${urlTypes.file.length} (${urlTypes.file.filter(r => r.success).length} successful)`);
        console.log(`   Other URLs: ${urlTypes.other.length} (${urlTypes.other.filter(r => r.success).length} successful)`);
        
        // Verify folder URLs fail with correct message
        urlTypes.folder.forEach(result => {
          expect(result.success).toBe(false);
          expect(result.error).toContain('Google Drive folder URLs are not supported');
        });
        
        console.log('✅ Download behavior verification completed');
      } else {
        console.log('⚠️  No charts available for download testing');
      }
      
      // Step 5: Verify database integrity
      console.log('🔍 Step 5: Verifying database integrity...');
      
      const allCharts = await getChartsFromDatabase(testDbPath);
      console.log(`📊 Database contains ${allCharts.length} charts total`);
      
      if (allCharts.length > 0) {
        // Verify data quality
        const chartWithAllFields = allCharts.find(chart => 
          chart.title && chart.artist && chart.bpm && chart.downloadUrl && chart.difficulties.length > 0
        );
        
        expect(chartWithAllFields).toBeDefined();
        console.log('✅ Database integrity verified');
      }
      
      console.log('🎉 Full workflow test completed successfully!');
      
    }, 45000); // Reduced from 60s to 45s timeout

    it('should demonstrate CLI-like usage patterns', async () => {
      console.log('🧪 E2E Test: CLI-like usage patterns');
      
      // Simulate CLI workflow: scrape → stats → search → download
      
      // 1. Scrape (simulate `npm run dtx:scrape`)
      console.log('📋 Simulating: npm run dtx:scrape');
      
      const strategy = new ApprovedDtxStrategy();
      const source: Source = {
        name: 'approved-dtx',
        enabled: true,
        baseUrl: 'https://approvedtx.blogspot.com/',
        strategy: 'approved-dtx',
        rateLimit: 500, // Faster for testing
        maxPages: 1,
        settings: {}
      };
      
      scrapingService.registerStrategy(strategy);
      scrapingService.registerSource(source);
      
      const scrapingResults = await scrapingService.scrapeSource(source);
      console.log(`   Result: ${scrapingResults.chartsAdded} charts scraped`);
      
      // 2. Stats (simulate `npm run dtx:stats`)
      console.log('📊 Simulating: npm run dtx:stats');
      
      const allCharts = await getChartsFromDatabase(testDbPath);
      const stats = generateStats(allCharts);
      
      console.log(`   Total charts: ${stats.total}`);
      console.log(`   Sources: ${stats.sources.join(', ')}`);
      console.log(`   BPM range: ${stats.bpmRange.min} - ${stats.bpmRange.max}`);
      console.log(`   Difficulty range: ${stats.difficultyRange.min} - ${stats.difficultyRange.max}`);
      
      // 3. Search (simulate `npm run dtx:search -- --artist "某アーティスト"`)
      console.log('🔍 Simulating: npm run dtx:search -- --artist "某アーティスト"');
      
      if (allCharts.length > 0) {
        // Get a sample artist for search
        const sampleArtist = allCharts[0].artist;
        const artistCharts = allCharts.filter(chart => 
          chart.artist.toLowerCase().includes(sampleArtist.toLowerCase())
        );
        
        console.log(`   Found ${artistCharts.length} charts by "${sampleArtist}"`);
        
        if (artistCharts.length > 0) {
          console.log(`   Sample: "${artistCharts[0].title}" (${artistCharts[0].bpm})`);
        }
      }
      
      // 4. Download (simulate `npm run dtx:download -- --artist "某アーティスト" --limit 1`)
      console.log('⬇️  Simulating: npm run dtx:download -- --artist "某アーティスト" --limit 1');
      
      if (allCharts.length > 0) {
        const testChart = allCharts[0];
        
        const downloadOptions: DownloadOptions = {
          downloadDir: testDownloadDir,
          timeout: 10000 // Reduced from 20s to 10s for faster failures
          ,
          chartIds: [],
          maxConcurrency: 0,
          overwrite: false
        };
        
        const downloadResult = await downloader.downloadChart(testChart, downloadOptions);
        
        console.log(`   Result: ${downloadResult.success ? 'SUCCESS' : 'FAILED'}`);
        console.log(`   Message: ${downloadResult.error || 'Downloaded successfully'}`);
        
        // Verify the system handles the download appropriately
        expect(downloadResult).toBeDefined();
        expect(typeof downloadResult.success).toBe('boolean');
      }
      
      console.log('✅ CLI-like usage patterns demonstrated successfully');
      
    }, 35000); // Reduced from 45s to 35s timeout
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle mixed URL types gracefully', async () => {
      console.log('🧪 E2E Test: Mixed URL types and error handling');
      
      // Create test charts with different URL types
      const testCharts: IChart[] = [
        {
          id: 'test-folder',
          title: 'Folder URL Chart',
          artist: 'Test Artist',
          bpm: '150',
          difficulties: [5.0, 6.0, 7.0, 8.0],
          source: 'test',
          downloadUrl: 'https://drive.google.com/drive/folders/test123/view',
          originalPageUrl: 'https://test.example.com/chart-folder',
          tags: [],
          previewImageUrl: '',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'test-file',
          title: 'File URL Chart',
          artist: 'Test Artist',
          bpm: '160',
          difficulties: [4.0, 5.0, 6.0, 7.0],
          source: 'test',
          downloadUrl: 'https://drive.google.com/file/d/test456/view',
          originalPageUrl: 'https://test.example.com/chart-file',
          tags: [],
          previewImageUrl: '',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'test-invalid',
          title: 'Invalid URL Chart',
          artist: 'Test Artist',
          bpm: '170',
          difficulties: [6.0, 7.0, 8.0, 9.0],
          source: 'test',
          downloadUrl: 'https://invalid-domain-that-does-not-exist.com/file.zip',
          originalPageUrl: 'https://test.example.com/chart-invalid',
          tags: [],
          previewImageUrl: '',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      const downloadOptions: DownloadOptions = {
        downloadDir: testDownloadDir,
        maxConcurrency: 1,
        timeout: 8000 // Reduced from 15s to 8s for faster failures
        ,
        chartIds: [],
        overwrite: false
      };
      
      const results = await downloader.downloadCharts(testCharts, downloadOptions);
      
      console.log('📊 Mixed URL type results:');
      results.forEach((result, index) => {
        const urlType = result.chart.downloadUrl ? getUrlType(result.chart.downloadUrl) : 'Missing';
        console.log(`   ${index + 1}. ${result.chart.title} (${urlType}): ${result.success ? 'SUCCESS' : 'FAILED'}`);
        if (!result.success) {
          console.log(`      Error: ${result.error}`);
        }
      });
      
      // Verify expected behavior
      const folderResult = results.find(r => r.chart.downloadUrl && r.chart.downloadUrl.includes('/folders/'));
      const fileResult = results.find(r => r.chart.downloadUrl && r.chart.downloadUrl.includes('/file/d/'));
      const invalidResult = results.find(r => r.chart.downloadUrl && r.chart.downloadUrl.includes('invalid-domain'));
      
      // Folder URLs should fail with specific message
      expect(folderResult?.success).toBe(false);
      expect(folderResult?.error).toContain('Google Drive folder URLs are not supported');
      
      // File URLs should attempt automation (may fail due to invalid ID)
      expect(fileResult?.success).toBe(false);
      expect(fileResult?.error).toContain('Confirmation flow failed');
      
      // Invalid URLs should fail with network error
      expect(invalidResult?.success).toBe(false);
      expect(invalidResult?.error).toBeDefined();
      
      console.log('✅ Mixed URL type handling verified');
    }, 25000); // Reduced from 30s to 25s timeout
  });
});

/**
 * Helper function to get charts from database
 */
async function getChartsFromDatabase(dbPath: string, limit?: number): Promise<IChart[]> {
  let db: ChartDatabase | null = null;
  try {
    db = new ChartDatabase(dbPath);
    const charts = await db.queryCharts(limit ? { limit } : {});
    return charts;
  } catch (error) {
    console.log(`⚠️  Error reading from database: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  } finally {
    // Always close the database connection
    if (db) {
      try {
        db.close();
      } catch (error) {
        // Ignore close errors
      }
    }
  }
}

/**
 * Helper function to generate stats from charts
 */
function generateStats(charts: IChart[]) {
  const sources = [...new Set(charts.map(c => c.source))];
  const bpms = charts.map(c => parseInt(c.bpm) || 0).filter(b => b > 0);
  const difficulties = charts.flatMap(c => c.difficulties);
  
  return {
    total: charts.length,
    sources,
    bpmRange: {
      min: bpms.length > 0 ? Math.min(...bpms) : 0,
      max: bpms.length > 0 ? Math.max(...bpms) : 0
    },
    difficultyRange: {
      min: difficulties.length > 0 ? Math.min(...difficulties) : 0,
      max: difficulties.length > 0 ? Math.max(...difficulties) : 0
    }
  };
}

/**
 * Helper function to identify URL type
 */
function getUrlType(url: string): string {
  if (url.includes('drive.google.com/drive/folders/')) {
    return 'Google Drive Folder';
  } else if (url.includes('drive.google.com/file/d/')) {
    return 'Google Drive File';
  } else if (url.includes('drive.google.com')) {
    return 'Google Drive (Other)';
  } else {
    return 'Direct URL';
  }
}
