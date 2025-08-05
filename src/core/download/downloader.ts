/**
 * Download service for DTX charts from various sources
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import * as cheerio from 'cheerio';
import { IChart, IDownloadProgress, ProgressCallback } from '../models';

export interface DownloadOptions {
  /** Directory to save downloads */
  downloadDir: string;
  
  /** Whether to create subdirectories by source */
  organizeBySource?: boolean;
  
  /** Whether to overwrite existing files */
  overwrite?: boolean;
  
  /** Maximum concurrent downloads */
  maxConcurrency?: number;
  
  /** Progress callback */
  onProgress?: ProgressCallback;
  
  /** Timeout in milliseconds */
  timeout?: number;
}

export interface DownloadResult {
  chart: IChart;
  success: boolean;
  filePath?: string;
  error?: string;
  fileSize?: number;
  downloadTime?: number;
}

export class ChartDownloader {
  private readonly userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
  private activeDownloads = new Set<string>();

  /**
   * Download a single chart
   */
  async downloadChart(chart: IChart, options: DownloadOptions): Promise<DownloadResult> {
    const startTime = Date.now();
    
    try {
      // Prevent duplicate downloads
      if (this.activeDownloads.has(chart.id)) {
        throw new Error('Download already in progress');
      }
      
      this.activeDownloads.add(chart.id);
      
      // Determine file path
      const filePath = this.getFilePath(chart, options);
      
      // Check if this is a Google Drive folder URL (batch download)
      if (this.isGoogleDriveFolderUrl(chart.downloadUrl)) {
        return {
          chart,
          success: true,
          error: `Folder URL: ${chart.downloadUrl}`,
          fileSize: 0,
          downloadTime: Date.now() - startTime
        };
      }
      
      // Check if file exists and we shouldn't overwrite
      if (fs.existsSync(filePath) && !options.overwrite) {
        return {
          chart,
          success: true,
          filePath,
          error: 'File already exists (skipped)',
          fileSize: fs.statSync(filePath).size,
          downloadTime: 0
        };
      }
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Download the file
      let downloadUrl = chart.downloadUrl;
      
      // Handle Google Drive links
      if (this.isGoogleDriveUrl(downloadUrl)) {
        downloadUrl = await this.resolveGoogleDriveUrl(downloadUrl);
      }
      
      const fileSize = await this.downloadFile(downloadUrl, filePath, options, chart);
      const downloadTime = Date.now() - startTime;
      
      return {
        chart,
        success: true,
        filePath,
        fileSize,
        downloadTime
      };
      
    } catch (error) {
      return {
        chart,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        downloadTime: Date.now() - startTime
      };
    } finally {
      this.activeDownloads.delete(chart.id);
    }
  }

  /**
   * Download multiple charts with concurrency control
   */
  async downloadCharts(charts: IChart[], options: DownloadOptions): Promise<DownloadResult[]> {
    const maxConcurrency = options.maxConcurrency || 3;
    const results: DownloadResult[] = [];
    
    // Process charts in batches
    for (let i = 0; i < charts.length; i += maxConcurrency) {
      const batch = charts.slice(i, i + maxConcurrency);
      const batchPromises = batch.map(chart => this.downloadChart(chart, options));
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Extract results from Promise.allSettled
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Handle failed downloads
          const chart = batch[results.length % batch.length];
          results.push({
            chart,
            success: false,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason)
          });
        }
      }
      
      // Small delay between batches to be respectful
      if (i + maxConcurrency < charts.length) {
        await this.delay(1000);
      }
    }
    
    return results;
  }

  /**
   * Check if URL is a Google Drive folder
   */
  private isGoogleDriveFolderUrl(url: string): boolean {
    return url.includes('drive.google.com/drive/folders/');
  }

  /**
   * Check if URL is a Google Drive link
   */
  private isGoogleDriveUrl(url: string): boolean {
    return url.includes('drive.google.com');
  }

  /**
   * Resolve Google Drive URL to direct download link
   */
  private async resolveGoogleDriveUrl(url: string): Promise<string> {
    try {
      // Extract file ID from various Google Drive URL formats
      let fileId = this.extractGoogleDriveFileId(url);
      if (!fileId) {
        throw new Error('Could not extract Google Drive file ID');
      }
      
      // Try direct download URL first
      let downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      
      // Check if this is a large file that requires confirmation
      const response = await this.httpGet(downloadUrl);
      
      if (response.includes('virus scan warning') || response.includes('download_warning')) {
        // Handle virus scan warning for large files
        downloadUrl = await this.handleGoogleDriveVirusWarning(response);
      }
      
      return downloadUrl;
      
    } catch (error) {
      console.warn(`Failed to resolve Google Drive URL ${url}:`, error);
      // Fallback to original URL
      return url;
    }
  }

  /**
   * Extract Google Drive file ID from URL
   */
  private extractGoogleDriveFileId(url: string): string | null {
    // Handle various Google Drive URL formats
    const patterns = [
      /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,  // /file/d/ID/view
      /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/, // uc?export=download&id=ID
      /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/, // open?id=ID
      /([a-zA-Z0-9_-]{25,})/  // Generic long ID pattern
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Handle Google Drive virus warning for large files
   */
  private async handleGoogleDriveVirusWarning(html: string): Promise<string> {
    const $ = cheerio.load(html);
    
    // Look for the confirmation form
    const form = $('form#download-form');
    if (form.length === 0) {
      throw new Error('Could not find download confirmation form');
    }
    
    const action = form.attr('action');
    if (!action) {
      throw new Error('Could not find form action URL');
    }
    
    // Extract form data
    const formData: Record<string, string> = {};
    form.find('input[name]').each((_, input) => {
      const name = $(input).attr('name');
      const value = $(input).attr('value');
      if (name && value) {
        formData[name] = value;
      }
    });
    
    // Build download URL with confirmation
    const params = new URLSearchParams(formData);
    return `${action}?${params.toString()}`;
  }

  /**
   * Download file from URL to local path
   */
  private async downloadFile(
    url: string, 
    filePath: string, 
    options: DownloadOptions, 
    chart: IChart
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const timeout = options.timeout || 30000;
      let totalBytes = 0;
      let downloadedBytes = 0;
      
      const request = (url.startsWith('https:') ? https : http).get(url, {
        headers: {
          'User-Agent': this.userAgent
        },
        timeout
      }, (response) => {
        
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location;
          if (redirectUrl) {
            console.log(`Following redirect: ${redirectUrl}`);
            this.downloadFile(redirectUrl, filePath, options, chart)
              .then(resolve)
              .catch(reject);
            return;
          }
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        // Get content length if available
        const contentLength = response.headers['content-length'];
        if (contentLength) {
          totalBytes = parseInt(contentLength, 10);
        }
        
        // Create write stream
        const writeStream = fs.createWriteStream(filePath);
        
        // Track progress
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          
          if (options.onProgress) {
            const progress: IDownloadProgress = {
              downloaded: downloadedBytes,
              ...(totalBytes ? { total: totalBytes } : {}),
              speed: downloadedBytes / ((Date.now() - Date.now()) / 1000) || 0,
              status: 'downloading'
            };
            
            options.onProgress(progress);
          }
        });
        
        // Pipe response to file
        response.pipe(writeStream);
        
        writeStream.on('finish', () => {
          writeStream.close();
          resolve(downloadedBytes);
        });
        
        writeStream.on('error', (error) => {
          writeStream.destroy();
          fs.unlink(filePath, () => {}); // Clean up partial file
          reject(error);
        });
        
      });
      
      request.on('timeout', () => {
        request.destroy();
        reject(new Error(`Download timeout after ${timeout}ms`));
      });
      
      request.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Make HTTP GET request
   */
  private async httpGet(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = (url.startsWith('https:') ? https : http).get(url, {
        headers: {
          'User-Agent': this.userAgent
        }
      }, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          resolve(data);
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Get file path for chart download
   */
  private getFilePath(chart: IChart, options: DownloadOptions): string {
    let filename = this.sanitizeFilename(`${chart.title} - ${chart.artist}`);
    
    // Add extension if not present
    if (!filename.toLowerCase().endsWith('.zip')) {
      filename += '.zip';
    }
    
    let dir = options.downloadDir;
    
    // Organize by source if requested
    if (options.organizeBySource) {
      dir = path.join(dir, chart.source);
    }
    
    return path.join(dir, filename);
  }

  /**
   * Sanitize filename for filesystem
   */
  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')  // Replace invalid characters
      .replace(/\s+/g, ' ')          // Normalize spaces
      .trim()                        // Remove leading/trailing spaces
      .substring(0, 200);            // Limit length
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get active download count
   */
  getActiveDownloadCount(): number {
    return this.activeDownloads.size;
  }

  /**
   * Cancel all active downloads
   */
  cancelAllDownloads(): void {
    this.activeDownloads.clear();
  }
}
