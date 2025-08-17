/**
 * End-to-End Test: Database Scraping
 * 
 * This test verifies that the scraping system can successfully:
 * 1. Scrape charts from the ApprovedDTX source
 * 2. Store them in the database
 * 3. Verify data integrity and completeness
 */

import { ScrapingService } from '../../src/scraping/scraping-service';
import { ApprovedDtxStrategy } from '../../src/scraping/strategies/approved-dtx';
import { Source } from '../../src/scraping/interfaces';
import * as fs from 'fs';
import * as path from 'path';

describe('E2E: Database Scraping', () => {
  let scrapingService: ScrapingService;
  const testDbPath = path.join(__dirname, 'test-scraping.db');

  beforeEach(async () => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Initialize scraping service with test database
    scrapingService = new ScrapingService(testDbPath);
  });

  afterEach(async () => {
    // Clean up services first
    try {
      if (scrapingService) {
        scrapingService.close();
      }
    } catch (error) {
      // Ignore cleanup errors
    }
    
    // Clean up test database with retry for Windows file locking
    const maxRetries = 3;
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (fs.existsSync(testDbPath)) {
          fs.unlinkSync(testDbPath);
          break; // Success, exit the loop
        }
      } catch (error: any) {
        if (i === maxRetries - 1) {
          // Last attempt, log the error but don't fail the test
          console.warn(`⚠️ Unable to delete test database: ${error.message}`);
        } else {
          // Wait a bit and retry
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }
  });

  describe('ApprovedDTX Scraping', () => {
    it('should scrape charts and store them in database', async () => {
      console.log('🧪 E2E Test: Starting ApprovedDTX scraping...');
      
      const strategy = new ApprovedDtxStrategy();
      const source: Source = {
        name: 'approved-dtx',
        enabled: true,
        baseUrl: 'https://approvedtx.blogspot.com/',
        strategy: 'approved-dtx',
        rateLimit: 500, // Faster for testing
        maxPages: 1, // Single page for speed
        settings: {}
      };
      
      // Register the strategy and source
      scrapingService.registerStrategy(strategy);
      scrapingService.registerSource(source);
      
      // Perform scraping
      const results = await scrapingService.scrapeSource(source, { 
        maxPages: 1,
        requestDelay: 500 // Faster delay
      });
      
      console.log(`📊 Scraped ${results.chartsAdded} charts, ${results.chartsDuplicated} duplicated, ${results.errors.length} errors`);
      
      // Verify results
      expect(results.chartsAdded).toBeGreaterThan(0);
      expect(results.errors.length).toBeLessThanOrEqual(5); // Allow for some network errors
      
      console.log(`✅ Successfully scraped ${results.chartsAdded} charts`);
      
    }, 25000); // Reduced from 30s to 25s timeout

    it('should handle incremental scraping (duplicate detection)', async () => {
      console.log('🧪 E2E Test: Testing incremental scraping...');
      
      const strategy = new ApprovedDtxStrategy();
      const source: Source = {
        name: 'approved-dtx',
        enabled: true,
        baseUrl: 'https://approvedtx.blogspot.com/',
        strategy: 'approved-dtx',
        rateLimit: 500, // Faster for testing
        maxPages: 1, // Single page for testing
        settings: {}
      };
      
      scrapingService.registerStrategy(strategy);
      scrapingService.registerSource(source);
      
      // First scrape
      const firstResults = await scrapingService.scrapeSource(source, { 
        maxPages: 1,
        requestDelay: 500 // Faster delay
      });
      
      console.log(`📊 First scrape: ${firstResults.chartsAdded} charts added`);
      
      // Second scrape (should detect duplicates)
      const secondResults = await scrapingService.scrapeSource(source, { 
        maxPages: 1,
        requestDelay: 500 // Faster delay
      });
      
      console.log(`📊 Second scrape: ${secondResults.chartsAdded} new, ${secondResults.chartsDuplicated} duplicates`);
      
      // Verify incremental behavior
      expect(firstResults.chartsAdded).toBeGreaterThan(0);
      expect(secondResults.chartsDuplicated).toBeGreaterThan(0);
      expect(secondResults.chartsAdded).toBeLessThanOrEqual(firstResults.chartsAdded);
      
    }, 40000); // Reduced from 45s to 40s timeout for double scraping
  });

  describe('Error Handling', () => {
    it('should handle invalid sources gracefully', async () => {
      console.log('🧪 E2E Test: Testing error handling...');
      
      const strategy = new ApprovedDtxStrategy();
      const invalidSource: Source = {
        name: 'test-invalid',
        enabled: true,
        baseUrl: 'https://invalid-url-that-does-not-exist.com',
        strategy: 'approved-dtx',
        rateLimit: 500, // Faster for testing  
        maxPages: 1,
        settings: {}
      };
      
      scrapingService.registerStrategy(strategy);
      scrapingService.registerSource(invalidSource);
      
      try {
        const results = await scrapingService.scrapeSource(invalidSource, { 
          maxPages: 1,
          requestDelay: 250 // Very fast for error case
        });
        
        console.log(`📊 Error test results: ${results.chartsAdded} added, ${results.errors.length} errors`);
        
        // Should handle errors gracefully
        expect(results.chartsAdded).toBe(0);
        expect(results.errors.length).toBeGreaterThan(0);
        
      } catch (error) {
        // Network errors are expected for invalid URLs
        expect(error).toBeDefined();
        console.log(`✅ Error handled correctly: ${error instanceof Error ? error.message : String(error)}`);
      }
      
    }, 10000); // Reduced from 12s to 10s timeout for error test
  });
});
