/**
 * Download service for managing chart downloads
 */

import { ChartDownloader, DownloadOptions, DownloadResult } from './downloader';
import { ChartDatabase } from '../database/database';
import { IChart, IDownloadProgress } from '../models';
import * as fs from 'fs';

export interface DownloadServiceOptions {
  downloadDir: string;
  organizeBySource?: boolean;
  maxConcurrency?: number;
  overwrite?: boolean;
  timeout?: number;
}

export interface DownloadStats {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  totalSize: number;
  averageSpeed: number;
  totalTime: number;
}

export class DownloadService {
  private downloader: ChartDownloader;
  private database: ChartDatabase;

  constructor(database: ChartDatabase) {
    this.downloader = new ChartDownloader();
    this.database = database;
  }

  async downloadChartsByQuery(
    query: {
      source?: string;
      artist?: string;
      title?: string;
      minBpm?: number;
      maxBpm?: number;
      limit?: number;
    },
    options: DownloadServiceOptions
  ): Promise<DownloadResult[]> {
    
    console.log('🔍 Querying charts for download...');
    const charts = await this.database.queryCharts({
      ...query,
      limit: query.limit || 100
    });

    if (charts.length === 0) {
      console.log('❌ No charts found matching query');
      return [];
    }

    console.log(`📦 Found ${charts.length} charts to download`);
    return this.downloadCharts(charts, options);
  }

  async downloadChartsById(
    chartIds: string[],
    options: DownloadServiceOptions
  ): Promise<DownloadResult[]> {
    
    console.log('🔍 Loading charts by ID...');
    const charts: IChart[] = [];
    
    for (const id of chartIds) {
      const chart = await this.database.getChart(id);
      if (chart) {
        charts.push(chart);
      } else {
        console.warn(`⚠️  Chart not found: ${id}`);
      }
    }

    if (charts.length === 0) {
      console.log('❌ No valid charts found');
      return [];
    }

    console.log(`📦 Found ${charts.length} charts to download`);
    return this.downloadCharts(charts, options);
  }

  private async downloadCharts(
    charts: IChart[],
    options: DownloadServiceOptions
  ): Promise<DownloadResult[]> {
    
    const startTime = Date.now();
    
    const onProgress = (_progress: IDownloadProgress) => {
      // Progress tracking placeholder
    };

    const downloadOptions: DownloadOptions = {
      downloadDir: options.downloadDir,
      organizeBySource: options.organizeBySource || true,
      overwrite: options.overwrite || false,
      maxConcurrency: options.maxConcurrency || 3,
      timeout: options.timeout || 30000,
      onProgress
    };

    if (!fs.existsSync(options.downloadDir)) {
      fs.mkdirSync(options.downloadDir, { recursive: true });
      console.log(`📁 Created download directory: ${options.downloadDir}`);
    }

    console.log(`🚀 Starting download of ${charts.length} charts...`);
    
    const folderUrls = charts.filter(c => c.downloadUrl.includes('drive.google.com/drive/folders/')).length;
    if (folderUrls > 0) {
      console.log(`📁 Note: ${folderUrls} charts point to Google Drive folders (will provide folder links)`);
    }

    const results = await this.downloader.downloadCharts(charts, downloadOptions);
    const stats = this.calculateStats(results, startTime);
    this.printResults(stats, results);

    return results;
  }

  private calculateStats(results: DownloadResult[], startTime: number): DownloadStats {
    const successful = results.filter(r => r.success && !r.error?.includes('already exists'));
    const failed = results.filter(r => !r.success);
    const skipped = results.filter(r => r.success && r.error?.includes('already exists'));
    
    const totalSize = successful.reduce((sum, r) => sum + (r.fileSize || 0), 0);
    const totalTime = Date.now() - startTime;
    const downloadTime = successful.reduce((sum, r) => sum + (r.downloadTime || 0), 0);
    const averageSpeed = downloadTime > 0 ? totalSize / (downloadTime / 1000) : 0;

    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      skipped: skipped.length,
      totalSize,
      averageSpeed,
      totalTime
    };
  }

  private printResults(stats: DownloadStats, results: DownloadResult[]): void {
    console.log('\n📊 Download Results:');
    console.log(`✅ Successful: ${stats.successful}`);
    console.log(`⏭️  Skipped: ${stats.skipped}`);
    console.log(`❌ Failed: ${stats.failed}`);
    console.log(`📊 Total: ${stats.total}`);

    const folderResults = results.filter(r => r.success && r.error?.includes('Folder URL:'));
    if (folderResults.length > 0) {
      console.log('\n📁 Batch Folders (manual download required):');
      const uniqueFolders = new Map<string, DownloadResult[]>();
      
      folderResults.forEach(result => {
        const folderUrl = result.error?.replace('Folder URL: ', '') || '';
        if (!uniqueFolders.has(folderUrl)) {
          uniqueFolders.set(folderUrl, []);
        }
        uniqueFolders.get(folderUrl)!.push(result);
      });
      
      uniqueFolders.forEach((charts, folderUrl) => {
        console.log(`\n🗂️  ${folderUrl}`);
        console.log(`   📦 Contains ${charts.length} charts:`);
        charts.forEach(result => {
          console.log(`      - ${result.chart.title} by ${result.chart.artist}`);
        });
        console.log('   📋 Instructions:');
        console.log('      1. Open the folder URL above');
        console.log('      2. Find and download the specific chart files');
        console.log('      3. Charts are typically named like "#1185 Chart Title.zip"');
      });
    }

    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      console.log('\n❌ Failed downloads:');
      failed.forEach(result => {
        console.log(`  - ${result.chart.title} - ${result.chart.artist}: ${result.error}`);
      });
    }
  }

  getActiveDownloadCount(): number {
    return this.downloader.getActiveDownloadCount();
  }

  estimateDownloadSize(charts: IChart[]): { estimated: number; note: string } {
    const averageSize = 10 * 1024 * 1024; // 10MB average
    const estimated = charts.length * averageSize;
    
    return {
      estimated,
      note: `Estimated based on ${charts.length} charts × 10MB average (DTX charts typically range from 5-15MB)`
    };
  }

  async checkDiskSpace(_directory: string): Promise<{ free: number; total: number }> {
    return { free: 1000000000, total: 10000000000 }; // Placeholder values
  }
}
