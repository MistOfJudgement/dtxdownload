#!/usr/bin/env node

/**
 * CLI tool for DTX Download
 */

import { Command } from 'commander';
import { ScrapingService, ApprovedDtxStrategy, Source } from './scraping';
import { DownloadService } from './core/download/download-service';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DownloadRequest } from '@shared/models';
import { DownloadOptions } from './core/download/downloader';

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
  .description('Show detailed database status and statistics')
  .option('--verbose', 'Show detailed breakdown by source')
  .action(async (options: any) => {
    try {
      const service = await initializeScrapingService();
      const db = service.getDatabase();
      
      console.log('📊 DTX Database Status\n');
      
      // Get basic stats
      const allCharts = await db.queryCharts({});
      const totalCharts = allCharts.length;
      
      if (totalCharts === 0) {
        console.log('❌ Database is empty. Run scraping to populate it.');
        service.close();
        return;
      }
      
      console.log(`� Total Charts: ${totalCharts}`);
      
      // Get charts by source
      const sourceStats = await db.getChartCountBySource();
      console.log('\n📋 Charts by Source:');
      Object.entries(sourceStats)
        .sort(([,a], [,b]) => b - a)
        .forEach(([source, count]) => {
          const percentage = ((count / totalCharts) * 100).toFixed(1);
          console.log(`   ${source}: ${count} charts (${percentage}%)`);
        });
      
      // BPM analysis
      const bpmRanges = {
        'Slow (< 120 BPM)': 0,
        'Medium (120-160 BPM)': 0,
        'Fast (160-200 BPM)': 0,
        'Very Fast (> 200 BPM)': 0,
        'Unknown': 0
      };
      
      allCharts.forEach(chart => {
        const bpm = parseInt(chart.bpm);
        if (isNaN(bpm)) {
          bpmRanges['Unknown']++;
        } else if (bpm < 120) {
          bpmRanges['Slow (< 120 BPM)']++;
        } else if (bpm <= 160) {
          bpmRanges['Medium (120-160 BPM)']++;
        } else if (bpm <= 200) {
          bpmRanges['Fast (160-200 BPM)']++;
        } else {
          bpmRanges['Very Fast (> 200 BPM)']++;
        }
      });
      
      console.log('\n🎵 BPM Distribution:');
      Object.entries(bpmRanges).forEach(([range, count]) => {
        if (count > 0) {
          const percentage = ((count / totalCharts) * 100).toFixed(1);
          console.log(`   ${range}: ${count} charts (${percentage}%)`);
        }
      });
      
      // Difficulty analysis
      const difficultyStats = {
        'Beginner (< 3.0)': 0,
        'Easy (3.0-5.0)': 0,
        'Medium (5.0-7.0)': 0,
        'Hard (7.0-8.5)': 0,
        'Expert (> 8.5)': 0
      };
      
      allCharts.forEach(chart => {
        const maxDiff = Math.max(...chart.difficulties);
        if (maxDiff < 3.0) {
          difficultyStats['Beginner (< 3.0)']++;
        } else if (maxDiff < 5.0) {
          difficultyStats['Easy (3.0-5.0)']++;
        } else if (maxDiff < 7.0) {
          difficultyStats['Medium (5.0-7.0)']++;
        } else if (maxDiff < 8.5) {
          difficultyStats['Hard (7.0-8.5)']++;
        } else {
          difficultyStats['Expert (> 8.5)']++;
        }
      });
      
      console.log('\n🎯 Difficulty Distribution (by highest difficulty):');
      Object.entries(difficultyStats).forEach(([range, count]) => {
        if (count > 0) {
          const percentage = ((count / totalCharts) * 100).toFixed(1);
          console.log(`   ${range}: ${count} charts (${percentage}%)`);
        }
      });
      
      // Download URL analysis
      const urlTypes = {
        'Google Drive Folders': 0,
        'Google Drive Files': 0,
        'Direct Links': 0,
        'Blog Posts': 0,
        'Other': 0
      };
      
      allCharts.forEach(chart => {
        const url = chart.downloadUrl;
        if (url.includes('drive.google.com/drive/folders/')) {
          urlTypes['Google Drive Folders']++;
        } else if (url.includes('drive.google.com/file/d/') || url.includes('drive.google.com/uc?')) {
          urlTypes['Google Drive Files']++;
        } else if (url.includes('blogspot.com')) {
          urlTypes['Blog Posts']++;
        } else if (url.includes('http')) {
          urlTypes['Direct Links']++;
        } else {
          urlTypes['Other']++;
        }
      });
      
      console.log('\n🔗 Download URL Types:');
      Object.entries(urlTypes).forEach(([type, count]) => {
        if (count > 0) {
          const percentage = ((count / totalCharts) * 100).toFixed(1);
          console.log(`   ${type}: ${count} charts (${percentage}%)`);
        }
      });
      
      // Recent additions
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const recentCharts = allCharts.filter(chart => chart.createdAt > oneDayAgo).length;
      const weeklyCharts = allCharts.filter(chart => chart.createdAt > oneWeekAgo).length;
      
      console.log('\n📈 Recent Activity:');
      console.log(`   Added in last 24h: ${recentCharts} charts`);
      console.log(`   Added in last week: ${weeklyCharts} charts`);
      
      // Top artists
      const artistCounts = new Map<string, number>();
      allCharts.forEach(chart => {
        const artist = chart.artist;
        artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
      });
      
      const topArtists = Array.from(artistCounts.entries())
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
      
      console.log('\n🎤 Top Artists:');
      topArtists.forEach(([artist, count], index) => {
        console.log(`   ${index + 1}. ${artist}: ${count} charts`);
      });
      
      if (options.verbose) {
        console.log('\n📊 Detailed Source Breakdown:');
        for (const [source, count] of Object.entries(sourceStats)) {
          console.log(`\n📂 ${source} (${count} charts):`);
          
          const sourceCharts = allCharts.filter(c => c.source === source);
          
          // BPM range for this source
          const sourceBpms = sourceCharts.map(c => parseInt(c.bpm)).filter(bpm => !isNaN(bpm));
          if (sourceBpms.length > 0) {
            const minBpm = Math.min(...sourceBpms);
            const maxBpm = Math.max(...sourceBpms);
            const avgBpm = Math.round(sourceBpms.reduce((a, b) => a + b, 0) / sourceBpms.length);
            console.log(`   BPM Range: ${minBpm}-${maxBpm} (avg: ${avgBpm})`);
          }
          
          // Difficulty range for this source
          const sourceDiffs = sourceCharts.flatMap(c => c.difficulties).filter(d => d > 0);
          if (sourceDiffs.length > 0) {
            const minDiff = Math.min(...sourceDiffs).toFixed(1);
            const maxDiff = Math.max(...sourceDiffs).toFixed(1);
            const avgDiff = (sourceDiffs.reduce((a, b) => a + b, 0) / sourceDiffs.length).toFixed(1);
            console.log(`   Difficulty Range: ${minDiff}-${maxDiff} (avg: ${avgDiff})`);
          }
          
          // Recent charts from this source
          const recentFromSource = sourceCharts.filter(c => c.createdAt > oneWeekAgo).length;
          if (recentFromSource > 0) {
            console.log(`   Added this week: ${recentFromSource} charts`);
          }
        }
      }
      
      console.log('\n💡 Tips:');
      console.log('   • Use --verbose for detailed source breakdown');
      console.log('   • Run "search" to find specific charts');
      console.log('   • Run "download-estimate" to plan downloads');
      
      service.close();
      
    } catch (error) {
      console.error('❌ Status check failed:', error);
      process.exit(1);
    }
  });

program
  .command('search')
  .description('Search for charts in the database')
  .argument('[query]', 'Search query (searches title and artist)')
  .option('-t, --title <title>', 'Search by title')
  .option('-a, --artist <artist>', 'Search by artist')
  .option('-s, --source <source>', 'Filter by source')
  .option('--min-bpm <bpm>', 'Minimum BPM')
  .option('--max-bpm <bpm>', 'Maximum BPM')
  .option('-l, --limit <number>', 'Limit results', '20')
  .action(async (query: string | undefined, options: any) => {
    try {
      const service = await initializeScrapingService();
      const db = service.getDatabase();
      
      const searchOptions: any = {
        limit: parseInt(options.limit)
      };
      
      // If a query is provided, search both title and artist
      if (query) {
        // We'll search for charts where either title OR artist contains the query
        const allCharts = await db.queryCharts({});
        const filteredCharts = allCharts.filter(chart => 
          chart.title.toLowerCase().includes(query.toLowerCase()) ||
          chart.artist.toLowerCase().includes(query.toLowerCase())
        );
        
        console.log(`🔍 Found ${filteredCharts.length} charts matching "${query}":\n`);
        
        const limitedCharts = filteredCharts.slice(0, parseInt(options.limit));
        
        limitedCharts.forEach((chart, index) => {
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
        return;
      }
      
      // Handle specific options
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
  .command('download')
  .description('Download charts by query (requires at least one filter)')
  .option('-s, --source <source>', 'Download charts from specific source (REQUIRED or use other filters)')
  .option('-a, --artist <artist>', 'Download charts by artist (partial match)')
  .option('-t, --title <title>', 'Download charts by title (partial match)')
  .option('--min-bpm <bpm>', 'Minimum BPM filter', (value) => parseInt(value))
  .option('--max-bpm <bpm>', 'Maximum BPM filter', (value) => parseInt(value))
  .option('-l, --limit <count>', 'Limit number of downloads (max 50)', (value) => parseInt(value))
  .option('-d, --dir <directory>', 'Download directory', path.join(os.homedir(), 'Downloads', 'DTX'))
  .option('--overwrite', 'Overwrite existing files')
  .option('-c, --concurrent <count>', 'Max concurrent downloads', (value) => parseInt(value), 3)
  .option('--timeout <ms>', 'Download timeout in milliseconds', (value) => parseInt(value), 30000)
  .option('--no-organize', 'Don\'t organize downloads by source')
  .option('--no-unzip', 'Don\'t automatically unzip downloaded files')
  .option('--keep-zip', 'Keep ZIP files after extraction')
  .option('--no-song-folders', 'Don\'t organize extracted files into song folders')
  .action(async (options: any) => {
    try {
      // Require at least one filter to prevent downloading everything
      const hasFilter = options.source || options.artist || options.title || 
                       options.minBpm || options.maxBpm || options.limit;
      
      if (!hasFilter) {
        console.error('❌ Error: At least one filter is required to prevent downloading all charts.');
        console.error('Use --source, --artist, --title, --min-bpm, --max-bpm, or --limit');
        console.error('Example: dtx-download download --artist "Dream Theater" --limit 10');
        process.exit(1);
      }
      
      // Enforce reasonable limits
      if (options.limit && options.limit > 50) {
        console.error('❌ Error: Maximum limit is 50 charts per download command');
        console.error('Use multiple smaller downloads or be more specific with filters');
        process.exit(1);
      }
      
      const service = await initializeScrapingService();
      const db = service.getDatabase();
      const downloadService = new DownloadService(db);
      
      // Build query options
      const query: any = {};
      if (options.source) query.source = options.source;
      if (options.artist) query.artist = options.artist;
      if (options.title) query.title = options.title;
      if (options.minBpm) query.minBpm = options.minBpm;
      if (options.maxBpm) query.maxBpm = options.maxBpm;
      if (options.limit) query.limit = Math.min(options.limit, 50);
      
      // Download options
      const downloadOptions:DownloadRequest = {
        downloadDir: options.dir,
        overwrite: options.overwrite || false,
        maxConcurrency: options.concurrent,
        timeout: options.timeout,
        chartIds: []
      };
      
      console.log('🎵 DTX Chart Downloader (Query Mode)');
      console.log(`📁 Download directory: ${downloadOptions.downloadDir}`);
      console.log('🔍 Applied filters:');
      if (query.source) console.log(`   Source: ${query.source}`);
      if (query.artist) console.log(`   Artist: ${query.artist}`);
      if (query.title) console.log(`   Title: ${query.title}`);
      if (query.minBpm) console.log(`   Min BPM: ${query.minBpm}`);
      if (query.maxBpm) console.log(`   Max BPM: ${query.maxBpm}`);
      if (query.limit) console.log(`   Limit: ${query.limit}`);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(downloadOptions.downloadDir)) {
        fs.mkdirSync(downloadOptions.downloadDir, { recursive: true });
      }
      
      // Check available disk space
      try {
        const stats = await downloadService.checkDiskSpace(downloadOptions.downloadDir);
        console.log(`💾 Available space: ${formatBytes(stats.free)}`);
      } catch (error) {
        console.warn('⚠️  Could not check disk space');
      }
      
      // Start download
      await downloadService.downloadChartsByQuery(query, downloadOptions);
      
      service.close();
      
    } catch (error) {
      console.error('❌ Download failed:', error);
      process.exit(1);
    }
  });

program
  .command('download-by-id')
  .description('Download specific charts by ID (max 20 charts)')
  .argument('<ids...>', 'Chart IDs to download (max 20)')
  .option('-d, --dir <directory>', 'Download directory', path.join(os.homedir(), 'Downloads', 'DTX'))
  .option('--overwrite', 'Overwrite existing files')
  .option('-c, --concurrent <count>', 'Max concurrent downloads', (value) => parseInt(value), 3)
  .option('--timeout <ms>', 'Download timeout in milliseconds', (value) => parseInt(value), 30000)
  .option('--no-organize', 'Don\'t organize downloads by source')
  .option('--no-unzip', 'Don\'t automatically unzip downloaded files')
  .option('--keep-zip', 'Keep ZIP files after extraction')
  .option('--no-song-folders', 'Don\'t organize extracted files into song folders')
  .option('--confirm', 'Confirm download without prompting')
  .action(async (ids: string[], options: any) => {
    try {
      // Limit the number of charts that can be downloaded by ID
      if (ids.length > 20) {
        console.error('❌ Error: Maximum 20 charts can be downloaded by ID at once');
        console.error('Use the query-based download for larger batches');
        process.exit(1);
      }
      
      const service = await initializeScrapingService();
      const db = service.getDatabase();
      const downloadService = new DownloadService(db);
      
      // Verify that all IDs exist in database
      console.log('🔍 Verifying chart IDs...');
      const validCharts: string[] = [];
      const invalidCharts: string[] = [];
      
      for (const id of ids) {
        const chart = await db.getChart(id);
        if (chart) {
          validCharts.push(id);
        } else {
          invalidCharts.push(id);
        }
      }
      
      if (invalidCharts.length > 0) {
        console.warn(`⚠️  Invalid chart IDs found: ${invalidCharts.join(', ')}`);
      }
      
      if (validCharts.length === 0) {
        console.error('❌ No valid chart IDs found');
        process.exit(1);
      }
      
      // Show what will be downloaded and ask for confirmation
      if (!options.confirm) {
        console.log(`\n📦 Ready to download ${validCharts.length} charts:`);
        for (const id of validCharts) {
          const chart = await db.getChart(id);
          if (chart) {
            console.log(`   - ${chart.title} - ${chart.artist} (${chart.source})`);
          }
        }
        
        // In a real CLI, you'd prompt for confirmation here
        // For now, require the --confirm flag
        console.log('\n❓ Use --confirm flag to proceed with download');
        process.exit(0);
      }

      const downloadOptions: DownloadOptions = {
        downloadDir: options.dir,
        overwrite: options.overwrite || false,
        maxConcurrency: options.concurrent,
        timeout: options.timeout,
        chartIds: validCharts
      };

      
      console.log('🎵 DTX Chart Downloader (ID Mode)');
      console.log(`📁 Download directory: ${downloadOptions.downloadDir}`);
      console.log(`🎯 Downloading ${validCharts.length} specific charts`);
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(downloadOptions.downloadDir)) {
        fs.mkdirSync(downloadOptions.downloadDir, { recursive: true });
      }
      
      await downloadService.downloadChartsById(validCharts, downloadOptions);
      
      service.close();
      
    } catch (error) {
      console.error('❌ Download failed:', error);
      process.exit(1);
    }
  });

program
  .command('download-estimate')
  .description('Estimate download size for a query')
  .option('-s, --source <source>', 'Filter by source')
  .option('-a, --artist <artist>', 'Filter by artist (partial match)')
  .option('-t, --title <title>', 'Filter by title (partial match)')
  .option('--min-bpm <bpm>', 'Minimum BPM filter', (value) => parseInt(value))
  .option('--max-bpm <bpm>', 'Maximum BPM filter', (value) => parseInt(value))
  .option('-l, --limit <count>', 'Limit number of charts', (value) => parseInt(value))
  .action(async (options: any) => {
    try {
      const service = await initializeScrapingService();
      const db = service.getDatabase();
      const downloadService = new DownloadService(db);
      
      // Build query options
      const query: any = {};
      if (options.source) query.source = options.source;
      if (options.artist) query.artist = options.artist;
      if (options.title) query.title = options.title;
      if (options.minBpm) query.minBpm = options.minBpm;
      if (options.maxBpm) query.maxBpm = options.maxBpm;
      if (options.limit) query.limit = options.limit;
      
      console.log('📊 Download Size Estimation');
      
      const charts = await db.queryCharts(query);
      const estimate = downloadService.estimateDownloadSize(charts);
      
      console.log(`📦 Charts matching query: ${charts.length}`);
      console.log(`💾 Estimated download size: ${formatBytes(estimate.estimated)}`);
      console.log(`ℹ️  ${estimate.note}`);
      
      service.close();
      
    } catch (error) {
      console.error('❌ Estimation failed:', error);
      process.exit(1);
    }
  });

program
  .command('browse')
  .description('Open Google Drive folders for manual chart download')
  .option('-s, --source <source>', 'Browse charts from specific source')
  .option('-a, --artist <artist>', 'Browse charts by artist (partial match)')
  .option('-t, --title <title>', 'Browse charts by title (partial match)')
  .option('--min-bpm <bpm>', 'Minimum BPM filter', (value) => parseInt(value))
  .option('--max-bpm <bpm>', 'Maximum BPM filter', (value) => parseInt(value))
  .option('-l, --limit <count>', 'Limit number of results', (value) => parseInt(value))
  .action(async (options: any) => {
    try {
      const service = await initializeScrapingService();
      const db = service.getDatabase();
      
      // Build query options
      const query: any = {};
      if (options.source) query.source = options.source;
      if (options.artist) query.artist = options.artist;
      if (options.title) query.title = options.title;
      if (options.minBpm) query.minBpm = options.minBpm;
      if (options.maxBpm) query.maxBpm = options.maxBpm;
      if (options.limit) query.limit = options.limit;
      
      console.log('🌐 DTX Chart Browser');
      
      const charts = await db.queryCharts(query);
      
      if (charts.length === 0) {
        console.log('❌ No charts found matching query');
        service.close();
        return;
      }
      
      // Group charts by their download URLs (folder URLs)
      const folderGroups = new Map<string, typeof charts>();
      
      charts.forEach(chart => {
        const url = chart.downloadUrl;
        if (!folderGroups.has(url)) {
          folderGroups.set(url, []);
        }
        folderGroups.get(url)!.push(chart);
      });
      
      console.log(`📦 Found ${charts.length} charts in ${folderGroups.size} folders:\n`);
      
      folderGroups.forEach((folderCharts, folderUrl) => {
        if (folderUrl.includes('drive.google.com/drive/folders/')) {
          console.log(`📁 Google Drive Folder (${folderCharts.length} charts):`);
          console.log(`   🔗 ${folderUrl}`);
          console.log(`   📋 Charts in this folder:`);
          folderCharts.slice(0, 5).forEach(chart => {
            console.log(`      - #${chart.id.split('-').pop()} ${chart.title} by ${chart.artist}`);
          });
          if (folderCharts.length > 5) {
            console.log(`      ... and ${folderCharts.length - 5} more charts`);
          }
          console.log('');
        } else {
          console.log(`🔗 Individual Downloads (${folderCharts.length} charts):`);
          folderCharts.slice(0, 3).forEach(chart => {
            console.log(`   - ${chart.title} by ${chart.artist}`);
            console.log(`     🔗 ${chart.downloadUrl}`);
          });
          if (folderCharts.length > 3) {
            console.log(`   ... and ${folderCharts.length - 3} more charts`);
          }
          console.log('');
        }
      });
      
      console.log('💡 Tip: Use the download command to automatically handle direct downloads');
      console.log('   For Google Drive folders, you\'ll need to manually download specific charts');
      
      service.close();
      
    } catch (error) {
      console.error('❌ Browse failed:', error);
      process.exit(1);
    }
  });

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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
