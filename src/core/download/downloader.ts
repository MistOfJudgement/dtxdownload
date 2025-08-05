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
        // Try to automatically download from the folder
        try {
          const downloadResult = await this.downloadFromGoogleDriveFolder(chart, options);
          return downloadResult;
        } catch (error) {
          // Fall back to folder URL message if automation fails
          return {
            chart,
            success: false,
            error: `Automated download failed: ${error instanceof Error ? error.message : String(error)}. Manual download required from: ${chart.downloadUrl}`,
            fileSize: 0,
            downloadTime: Date.now() - startTime
          };
        }
      }

      // Check if this is an individual Google Drive file URL
      if (this.isGoogleDriveFileUrl(chart.downloadUrl)) {
        try {
          const downloadResult = await this.downloadFromGoogleDriveFile(chart, options);
          return downloadResult;
        } catch (error) {
          return {
            chart,
            success: false,
            error: `Google Drive file download failed: ${error instanceof Error ? error.message : String(error)}`,
            fileSize: 0,
            downloadTime: Date.now() - startTime
          };
        }
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
  /**
   * Handle Google Drive folder downloads with automated browser opening and guidance
   */
  private async downloadFromGoogleDriveFolder(chart: IChart, options: DownloadOptions): Promise<DownloadResult> {
    try {
      // Extract chart number from chart ID for better guidance
      const chartNumberMatch = chart.id.match(/(\d+)$/);
      const chartNumber = chartNumberMatch ? chartNumberMatch[1] : 'unknown';
      
      // Create the expected file path
      const filePath = this.getFilePath(chart, options);
      const dir = path.dirname(filePath);
      
      // Ensure directory exists
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      console.log(`🎯 Chart #${chartNumber}: "${chart.title}" by ${chart.artist}`);
      console.log(`📁 Opening Google Drive folder: ${chart.downloadUrl}`);
      console.log(`💡 Look for: "#${chartNumber} ${chart.title}.zip" or "#${chartNumber}.zip"`);
      console.log(`📂 Save to: ${filePath}`);
      
      // Try to open the URL in the user's default browser
      await this.openInBrowser(chart.downloadUrl);
      
      // Return a result indicating manual download is needed
      return {
        chart,
        success: false,
        error: `Manual download required:
1. ✅ Opened: ${chart.downloadUrl}
2. 🔍 Find: "#${chartNumber} ${chart.title}.zip" (or similar)
3. ⬇️  Download and save to: ${filePath}
4. 🎮 Chart will be ready for DTXMania!`,
        downloadTime: 0
      };
      
    } catch (error) {
      throw error;
    }
  }

  /**
   * Open URL in the user's default browser
   */
  private async openInBrowser(url: string): Promise<void> {
    try {
      const { spawn } = require('child_process');
      const os = require('os');
      
      let command: string;
      const args: string[] = [url];
      
      switch (os.platform()) {
        case 'darwin': // macOS
          command = 'open';
          break;
        case 'win32': // Windows
          command = 'start';
          args.unshift('');
          break;
        default: // Linux and others
          command = 'xdg-open';
          break;
      }
      
      const child = spawn(command, args, {
        detached: true,
        stdio: 'ignore'
      });
      
      child.unref();
      console.log(`🌐 Opened ${url} in default browser`);
      
    } catch (error) {
      console.log(`⚠️  Could not open browser automatically. Please open: ${url}`);
    }
  }

  private isGoogleDriveFolderUrl(url: string): boolean {
    return url.includes('drive.google.com/drive/folders/');
  }

  private isGoogleDriveFileUrl(url: string): boolean {
    return url.includes('drive.google.com/file/d/') || 
           url.includes('drive.google.com/open?id=') ||
           url.includes('drive.google.com/uc?id=') ||
           url.includes('drive.usercontent.google.com/uc?');
  }

  /**
   * Download individual Google Drive file with full automation
   */
  private async downloadFromGoogleDriveFile(chart: IChart, options: DownloadOptions): Promise<DownloadResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🎯 Downloading: "${chart.title}" by ${chart.artist}`);
      console.log(`🔗 Google Drive URL: ${chart.downloadUrl}`);
      
      // Create file path
      const filePath = this.getFilePath(chart, options);
      const dir = path.dirname(filePath);
      
      // Ensure directory exists
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Extract file ID from various Google Drive URL formats
      const fileId = this.extractGoogleDriveFileId(chart.downloadUrl);
      if (!fileId) {
        throw new Error('Could not extract Google Drive file ID from URL');
      }
      
      console.log(`📁 File ID: ${fileId}`);
      
      // Use the direct download URL pattern: drive.usercontent.google.com (this will likely need confirmation)
      const directDownloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
      console.log(`🔗 Trying initial download: ${directDownloadUrl}`);
      const downloadResult = await this.attemptGoogleDriveDownload(directDownloadUrl, filePath, chart, startTime);
      
      if (downloadResult.success) {
        // Try to unzip if it's a ZIP file
        if (filePath.endsWith('.zip')) {
          await this.attemptUnzip(filePath, dir);
        }
        
        return downloadResult;
      }
      
      // If direct download failed, try the confirm download flow
      console.log(`⚠️  Direct download failed, trying confirmation flow...`);
      return await this.handleGoogleDriveConfirmFlow(fileId, filePath, chart, startTime);
      
    } catch (error) {
      return {
        chart,
        success: false,
        error: `Google Drive download failed: ${error instanceof Error ? error.message : String(error)}`,
        fileSize: 0,
        downloadTime: Date.now() - startTime
      };
    }
  }

  /**
   * Extract Google Drive file ID from various URL formats
   */
  private extractGoogleDriveFileId(url: string): string | null {
    // Format: https://drive.google.com/file/d/FILE_ID/view
    let match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    
    // Format: https://drive.google.com/open?id=FILE_ID
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    
    // Format: https://drive.google.com/uc?id=FILE_ID
    match = url.match(/uc\?.*id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    
    return null;
  }

  /**
   * Attempt direct Google Drive download
   */
  private async attemptGoogleDriveDownload(url: string, filePath: string, chart: IChart, startTime: number): Promise<DownloadResult> {
    return new Promise((resolve) => {
      const request = https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }, (response) => {
        // Check if we're being redirected to a confirmation page
        if (response.statusCode === 302 || response.statusCode === 301) {
          const location = response.headers.location;
          if (location?.includes('confirm')) {
            resolve({
              chart,
              success: false,
              error: 'Confirmation required',
              fileSize: 0,
              downloadTime: Date.now() - startTime
            });
            return;
          }
        }
        
        if (response.statusCode !== 200) {
          resolve({
            chart,
            success: false,
            error: `HTTP ${response.statusCode}`,
            fileSize: 0,
            downloadTime: Date.now() - startTime
          });
          return;
        }
        
        // Check content type
        const contentType = response.headers['content-type'];
        if (contentType?.includes('text/html')) {
          // This means we got an HTML page (likely confirmation) instead of the file
          resolve({
            chart,
            success: false,
            error: 'Received HTML instead of file',
            fileSize: 0,
            downloadTime: Date.now() - startTime
          });
          return;
        }
        
        const fileStream = fs.createWriteStream(filePath);
        let downloadedBytes = 0;
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
        });
        
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`✅ Downloaded: ${path.basename(filePath)} (${downloadedBytes} bytes)`);
          resolve({
            chart,
            success: true,
            filePath,
            fileSize: downloadedBytes,
            downloadTime: Date.now() - startTime
          });
        });
        
        fileStream.on('error', (error) => {
          fs.unlink(filePath, () => {}); // Clean up partial file
          resolve({
            chart,
            success: false,
            error: `File write error: ${error.message}`,
            fileSize: 0,
            downloadTime: Date.now() - startTime
          });
        });
      });
      
      request.on('error', (error) => {
        resolve({
          chart,
          success: false,
          error: `Request error: ${error.message}`,
          fileSize: 0,
          downloadTime: Date.now() - startTime
        });
      });
      
      request.setTimeout(30000, () => {
        request.destroy();
        resolve({
          chart,
          success: false,
          error: 'Download timeout',
          fileSize: 0,
          downloadTime: Date.now() - startTime
        });
      });
    });
  }

  /**
   * Handle Google Drive confirmation flow for large files
   */
  private async handleGoogleDriveConfirmFlow(fileId: string, filePath: string, chart: IChart, startTime: number): Promise<DownloadResult> {
    try {
      console.log(`🔄 Handling Google Drive confirmation flow...`);
      
      // First, get the confirmation page to extract UUID
      const confirmUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
      const confirmPageResponse = await this.fetchWithUserAgent(confirmUrl);
      
      if (!confirmPageResponse.ok) {
        throw new Error(`Failed to fetch confirmation page: ${confirmPageResponse.status}`);
      }
      
      const confirmPageHtml = await confirmPageResponse.text();
      const $ = cheerio.load(confirmPageHtml);
      
      // Extract the UUID from the hidden form input
      const uuidInput = $('input[name="uuid"]');
      const uuid = uuidInput.attr('value');
      
      if (!uuid) {
        throw new Error('Could not find UUID in confirmation page');
      }
      
      console.log(`🔑 Found UUID: ${uuid}`);
      
      // Construct the direct download URL with UUID
      const downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t&uuid=${uuid}`;
      console.log(`🔗 Direct download URL: ${downloadUrl}`);
      
      // Now attempt the actual download
      return await this.attemptGoogleDriveDownload(downloadUrl, filePath, chart, startTime);
      
    } catch (error) {
      return {
        chart,
        success: false,
        error: `Confirmation flow failed: ${error instanceof Error ? error.message : String(error)}`,
        fileSize: 0,
        downloadTime: Date.now() - startTime
      };
    }
  }

  /**
   * Fetch with proper User-Agent header
   */
  private async fetchWithUserAgent(url: string): Promise<any> {
    const fetch = require('node-fetch');
    return fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
  }

  /**
   * Attempt to unzip a downloaded file
   */
  private async attemptUnzip(zipPath: string, extractDir: string): Promise<void> {
    try {
      console.log(`📦 Attempting to unzip: ${path.basename(zipPath)}`);
      
      const { spawn } = require('child_process');
      const os = require('os');
      
      return new Promise((resolve) => {
        let command: string;
        let args: string[];
        
        if (os.platform() === 'win32') {
          // Windows: try PowerShell first, then fall back to manual
          command = 'powershell';
          args = ['-Command', `Expand-Archive -Path "${zipPath}" -DestinationPath "${extractDir}" -Force`];
        } else {
          // Unix-like systems: use unzip
          command = 'unzip';
          args = ['-o', zipPath, '-d', extractDir];
        }
        
        const child = spawn(command, args, { stdio: 'pipe' });
        
        child.on('close', (code: number) => {
          if (code === 0) {
            console.log(`✅ Unzipped: ${path.basename(zipPath)}`);
            resolve();
          } else {
            console.log(`⚠️  Unzip failed (code ${code}). File saved as ZIP: ${zipPath}`);
            resolve(); // Don't fail the download if unzip fails
          }
        });
        
        child.on('error', (error: Error) => {
          console.log(`⚠️  Unzip error: ${error.message}. File saved as ZIP: ${zipPath}`);
          resolve(); // Don't fail the download if unzip fails
        });
      });
      
    } catch (error) {
      console.log(`⚠️  Unzip failed: ${error instanceof Error ? error.message : String(error)}. File saved as ZIP: ${zipPath}`);
      // Don't throw - unzip failure shouldn't fail the download
    }
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
