#!/usr/bin/env node

/**
 * CLI tool for DTX Download
 */

import { Command } from 'commander';
import { ScrapingService, ApprovedDtxStrategy, Source } from './scraping';
import * as fs from 'fs';

// Type definitions for command options
interface ScrapeOptions {
  source?: string;
  pages: string;
  output: string;
  dryRun?: boolean;
}

const program = new Command();

// Default configuration
const DEFAULT_CONFIG = {
  sources: [
    {
      name: 'approved-dtx',
      enabled: true,
      baseUrl: 'http://approvedtx.blogspot.com/',
      strategy: 'approved-dtx',
      rateLimit: 2000, // 2 seconds between requests
      maxPages: 10,
      settings: {
        scrapeInterval: 24 * 60 * 60 * 1000 // 24 hours
      }
    }
  ],
  output: {
    directory: './scraped-data',
    format: 'json'
  }
};

async function initializeScrapingService(): Promise<ScrapingService> {
  const service = new ScrapingService();
  
  // Register strategies
  service.registerStrategy(new ApprovedDtxStrategy());
  
  // Register sources
  DEFAULT_CONFIG.sources.forEach(source => {
    service.registerSource(source as Source);
  });
  
  return service;
}

async function ensureOutputDirectory(outputDir: string): Promise<void> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

program
  .name('dtx-download')
  .description('CLI tool for downloading DTXMania charts')
  .version('1.0.0');

program
  .command('scrape')
  .description('Scrape charts from all enabled sources')
  .option('-s, --source <name>', 'Scrape from specific source only')
  .option('-p, --pages <number>', 'Maximum pages to scrape', '10')
  .option('-o, --output <directory>', 'Output directory', './scraped-data')
  .option('--dry-run', 'Show what would be scraped without actually scraping')
  .action(async (options: ScrapeOptions) => {
    try {
      console.log('🎵 DTX Download - Starting scrape operation...\n');
      
      const service = await initializeScrapingService();
      const outputDir = options.output;
      const maxPages = parseInt(options.pages);
      
      if (!options.dryRun) {
        await ensureOutputDirectory(outputDir);
      }
      
      if (options.source) {
        // Scrape specific source
        const sources = service.getAllSupportedSources();
        const targetSource = sources.find(s => s.name === options.source);
        
        if (!targetSource) {
          console.error(`❌ Source '${options.source}' not found`);
          console.log('Available sources:', sources.map(s => s.name).join(', '));
          process.exit(1);
        }
        
        if (options.dryRun) {
          console.log(`🔍 [DRY RUN] Would scrape from: ${targetSource.name}`);
          console.log(`📄 Max pages: ${maxPages}`);
          console.log(`📁 Output: ${outputDir}`);
          return;
        }
        
        console.log(`🔍 Scraping from: ${targetSource.name}`);
        const result = await service.scrapeSource(targetSource, { maxPages });
        
        console.log(`\n✅ Scraping completed for ${targetSource.name}:`);
        console.log(`   📊 Charts found: ${result.chartsFound}`);
        console.log(`   ➕ Charts added: ${result.chartsAdded}`);
        console.log(`   🔄 Duplicates: ${result.chartsDuplicated}`);
        console.log(`   ⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
        
        if (result.errors.length > 0) {
          console.log(`   ⚠️  Errors: ${result.errors.length}`);
          result.errors.forEach(error => console.log(`      - ${error}`));
        }
        
      } else {
        // Scrape all sources
        if (options.dryRun) {
          const sources = service.getEnabledSources();
          console.log(`🔍 [DRY RUN] Would scrape from ${sources.length} sources:`);
          sources.forEach(source => {
            console.log(`   - ${source.name} (${source.baseUrl})`);
          });
          console.log(`📄 Max pages per source: ${maxPages}`);
          console.log(`📁 Output: ${outputDir}`);
          return;
        }
        
        console.log('🔍 Scraping from all enabled sources...');
        const results = await service.scrapeAllSources({ maxPages });
        
        console.log('\n✅ Scraping completed for all sources:');
        let totalCharts = 0;
        let totalAdded = 0;
        let totalDuplicates = 0;
        let totalErrors = 0;
        
        results.forEach(result => {
          console.log(`\n📋 ${result.sourceName}:`);
          console.log(`   📊 Charts found: ${result.chartsFound}`);
          console.log(`   ➕ Charts added: ${result.chartsAdded}`);
          console.log(`   🔄 Duplicates: ${result.chartsDuplicated}`);
          console.log(`   ⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
          
          if (result.errors.length > 0) {
            console.log(`   ⚠️  Errors: ${result.errors.length}`);
            result.errors.forEach(error => console.log(`      - ${error}`));
          }
          
          totalCharts += result.chartsFound;
          totalAdded += result.chartsAdded;
          totalDuplicates += result.chartsDuplicated;
          totalErrors += result.errors.length;
        });
        
        console.log('\n📊 Summary:');
        console.log(`   📊 Total charts found: ${totalCharts}`);
        console.log(`   ➕ Total charts added: ${totalAdded}`);
        console.log(`   🔄 Total duplicates: ${totalDuplicates}`);
        console.log(`   ⚠️  Total errors: ${totalErrors}`);
      }
      
      // Close database connection
      service.close();
      
    } catch (error) {
      console.error('❌ Scraping failed:', error);
      process.exit(1);
    }
  });

program
  .command('list-sources')
  .description('List all available sources')
  .action(async () => {
    const service = await initializeScrapingService();
    const sources = service.getAllSupportedSources();
    
    console.log('📋 Available sources:\n');
    sources.forEach(source => {
      const status = source.enabled ? '✅ Enabled' : '❌ Disabled';
      console.log(`${source.name}`);
      console.log(`   Status: ${status}`);
      console.log(`   URL: ${source.baseUrl}`);
      console.log(`   Strategy: ${source.strategy}`);
      console.log(`   Rate limit: ${source.rateLimit}ms`);
      console.log(`   Max pages: ${source.maxPages || 'unlimited'}`);
      console.log('');
    });
  });

program
  .command('test-source')
  .description('Test if a source is accessible')
  .argument('<source>', 'Source name to test')
  .action(async (sourceName: string) => {
    try {
      const service = await initializeScrapingService();
      const sources = service.getAllSupportedSources();
      const source = sources.find(s => s.name === sourceName);
      
      if (!source) {
        console.error(`❌ Source '${sourceName}' not found`);
        console.log('Available sources:', sources.map(s => s.name).join(', '));
        process.exit(1);
      }
      
      console.log(`🔍 Testing source: ${source.name}`);
      console.log(`📡 URL: ${source.baseUrl}`);
      
      const isValid = await service.validateSource(source);
      
      if (isValid) {
        console.log('✅ Source is accessible and valid');
      } else {
        console.log('❌ Source validation failed');
        process.exit(1);
      }
      
    } catch (error) {
      console.error('❌ Test failed:', error);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show database statistics')
  .action(async () => {
    try {
      const service = await initializeScrapingService();
      const db = service.getDatabase();
      
      console.log('📊 Database Statistics:\n');
      
      const totalCharts = await db.getTotalChartCount();
      console.log(`📈 Total charts: ${totalCharts}`);
      
      const chartsBySource = await db.getChartCountBySource();
      console.log('\n📋 Charts by source:');
      for (const [source, count] of Object.entries(chartsBySource)) {
        console.log(`   ${source}: ${count} charts`);
      }
      
      service.close();
      
    } catch (error) {
      console.error('❌ Failed to get statistics:', error);
      process.exit(1);
    }
  });

program
  .command('search')
  .description('Search for charts in the database')
  .option('-t, --title <title>', 'Search by title')
  .option('-a, --artist <artist>', 'Search by artist')
  .option('-s, --source <source>', 'Filter by source')
  .option('--min-bpm <bpm>', 'Minimum BPM')
  .option('--max-bpm <bpm>', 'Maximum BPM')
  .option('-l, --limit <number>', 'Limit results', '20')
  .action(async (options: any) => {
    try {
      const service = await initializeScrapingService();
      const db = service.getDatabase();
      
      const searchOptions: any = {
        limit: parseInt(options.limit)
      };
      
      if (options.title) searchOptions.title = options.title;
      if (options.artist) searchOptions.artist = options.artist;
      if (options.source) searchOptions.source = options.source;
      if (options.minBpm) searchOptions.minBpm = parseInt(options.minBpm);
      if (options.maxBpm) searchOptions.maxBpm = parseInt(options.maxBpm);
      
      const charts = await db.queryCharts(searchOptions);
      
      console.log(`🔍 Found ${charts.length} charts:\n`);
      
      charts.forEach((chart, index) => {
        console.log(`${index + 1}. ${chart.title}`);
        console.log(`   Artist: ${chart.artist}`);
        console.log(`   BPM: ${chart.bpm}`);
        console.log(`   Source: ${chart.source}`);
        console.log(`   Difficulties: ${chart.difficulties.join('/')}`);
        if (chart.previewImageUrl) {
          console.log(`   Preview: ${chart.previewImageUrl}`);
        }
        console.log(`   Download: ${chart.downloadUrl}`);
        console.log('');
      });
      
      service.close();
      
    } catch (error) {
      console.error('❌ Search failed:', error);
      process.exit(1);
    }
  });

program
  .command('export')
  .description('Export charts to JSON file')
  .option('-o, --output <file>', 'Output file', 'charts.json')
  .option('-s, --source <source>', 'Export only from specific source')
  .action(async (options: any) => {
    try {
      const service = await initializeScrapingService();
      const db = service.getDatabase();
      
      const searchOptions: any = {};
      if (options.source) {
        searchOptions.source = options.source;
      }
      
      const charts = await db.queryCharts(searchOptions);
      
      fs.writeFileSync(options.output, JSON.stringify(charts, null, 2));
      console.log(`✅ Exported ${charts.length} charts to ${options.output}`);
      
      service.close();
      
    } catch (error) {
      console.error('❌ Export failed:', error);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    console.log('⚙️  Current configuration:\n');
    console.log(JSON.stringify(DEFAULT_CONFIG, null, 2));
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
