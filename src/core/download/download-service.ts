/**
 * Download service for managing chart downloads
 */

import { ChartDownloader, DownloadOptions, DownloadResult } from './downloader';
import { ChartDatabase } from '../database/database';
import { IChart, IDownloadProgress } from '../models';
import * as fs from 'fs';
import { DownloadRequest } from '@shared/models';

export interface DownloadStats {
  total: number;
  successful: number;
  failed: number;
  skipped: number;
  totalSize: number;
  averageSpeed: number;
  totalTime: number;
}

export interface ProgressState {
  downloadId: string;
  totalCharts: number;
  completedCharts: number;
  currentChart: string;
  overallProgress: number;
}

export interface DownloadOperation {
  downloadId: string;
  results: DownloadResult[];
}

export type ProgressCallback = (downloadId: string, state: ProgressState, progress: IDownloadProgress) => void;

export class DownloadService {
  private downloader: ChartDownloader;
  private database: ChartDatabase;
  private progressCallback?: ProgressCallback;

  constructor(database: ChartDatabase) {
    this.database = database;
    this.downloader = new ChartDownloader();
  }

  setProgressCallback(callback: ProgressCallback) {
    this.progressCallback = callback;
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
    options: DownloadRequest
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
    const operation = await this.downloadChartsWithId(charts, options);
    return operation.results;
  }

  async downloadChartsById(
    chartIds: string[],
    options: DownloadRequest
  ): Promise<DownloadOperation> {
    
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
      const downloadId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      return { downloadId, results: [] };
    }

    console.log(`📦 Found ${charts.length} charts to download`);
    const operation = await this.downloadChartsWithId(charts, options);
    return operation;
  }

  private async downloadChartsWithId(
    charts: IChart[],
    options: DownloadRequest
  ): Promise<DownloadOperation> {
    
    const startTime = Date.now();
    const downloadId = `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Progress tracking for real-time updates
    const progressState = {
      downloadId,
      totalCharts: charts.length,
      completedCharts: 0,
      currentChart: '',
      overallProgress: 0
    };
    
    const onProgress = (progress: IDownloadProgress) => {
      // Update progress state for SSE
      if (this.progressCallback) {
        this.progressCallback(downloadId, progressState, progress);
      }
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

    // Enhanced download options with completion tracking
    const enhancedDownloadOptions: DownloadOptions = {
      ...options,
      onProgress: (progress: IDownloadProgress) => {
        onProgress(progress);
      },
      onChartComplete: (chart: IChart, result: DownloadResult) => {
        progressState.completedCharts++;
        progressState.overallProgress = (progressState.completedCharts / progressState.totalCharts) * 100;
        progressState.currentChart = `${chart.title} - ${chart.artist}`;
        
        if (this.progressCallback) {
          this.progressCallback(downloadId, progressState, {
            downloaded: progressState.completedCharts,
            total: progressState.totalCharts,
            status: result.success ? 'completed' : 'failed'
          });
        }
      }
    };

    const results = await this.downloader.downloadCharts(charts, enhancedDownloadOptions);
    const stats = this.calculateStats(results, startTime);
    this.printResults(stats, results);

    return { downloadId, results };
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
