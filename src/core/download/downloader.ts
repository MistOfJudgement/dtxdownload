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

  /** Whether to automatically unzip downloaded files */
  autoUnzip?: boolean;

  /** Whether to delete ZIP files after successful extraction */
  deleteZipAfterExtraction?: boolean;

  /** Whether to organize extracted files into song folders */
  organizeSongFolders?: boolean;

  /** Whether to create chart-info.txt files (default: false for cleaner organization) */
  createChartInfo?: boolean;

  /** Chart completion callback */
  onChartComplete?: (chart: IChart, result: DownloadResult) => void;
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
      
      // Check if this is a Google Drive folder URL (not supported for automation)
      if (this.isGoogleDriveFolderUrl(chart.downloadUrl)) {
        return {
          chart,
          success: false,
          error: `Google Drive folder URLs are not supported for automatic download. Individual file URLs are required.`,
          fileSize: 0,
          downloadTime: Date.now() - startTime
        };
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
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const chart = batch[j];
        
        if (result.status === 'fulfilled') {
          results.push(result.value);
          // Call completion callback if provided
          if (options.onChartComplete) {
            options.onChartComplete(chart, result.value);
          }
        } else {
          // Handle failed downloads
          const failedResult: DownloadResult = {
            chart,
            success: false,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason)
          };
          results.push(failedResult);
          // Call completion callback for failed downloads too
          if (options.onChartComplete) {
            options.onChartComplete(chart, failedResult);
          }
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
        // Try to unzip if it's a ZIP file and auto-unzip is enabled
        console.log(`🔍 Checking unzip conditions:`);
        console.log(`   File path: ${filePath}`);
        console.log(`   Ends with .zip: ${filePath.endsWith('.zip')}`);
        console.log(`   Auto-unzip enabled: ${options.autoUnzip !== false}`);
        
        if (filePath.endsWith('.zip') && (options.autoUnzip !== false)) {
          console.log(`📦 Starting unzip process...`);
          await this.attemptUnzip(filePath, chart, options);
        } else {
          console.log(`⏭️  Skipping unzip`);
        }
        
        return downloadResult;
      }
      
      // If direct download failed, try the confirm download flow
      console.log(`⚠️  Direct download failed, trying confirmation flow...`);
      const confirmDownloadResult = await this.handleGoogleDriveConfirmFlow(fileId, filePath, chart, startTime);
      
      if (confirmDownloadResult.success) {
        // Try to unzip if it's a ZIP file and auto-unzip is enabled
        console.log(`🔍 Checking unzip conditions (confirmation flow):`);
        console.log(`   File path: ${filePath}`);
        console.log(`   Ends with .zip: ${filePath.endsWith('.zip')}`);
        console.log(`   Auto-unzip enabled: ${options.autoUnzip !== false}`);
        
        if (filePath.endsWith('.zip') && (options.autoUnzip !== false)) {
          console.log(`📦 Starting unzip process...`);
          await this.attemptUnzip(filePath, chart, options);
        } else {
          console.log(`⏭️  Skipping unzip`);
        }
      }
      
      return confirmDownloadResult;
      
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
        // Helper function to cleanup and resolve
        const cleanupAndResolve = (result: DownloadResult) => {
          response.destroy(); // Ensure response is destroyed
          request.destroy(); // Ensure request is destroyed
          resolve(result);
        };

        // Check if we're being redirected to a confirmation page
        if (response.statusCode === 302 || response.statusCode === 301) {
          const location = response.headers.location;
          if (location?.includes('confirm')) {
            cleanupAndResolve({
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
          cleanupAndResolve({
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
          cleanupAndResolve({
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
          cleanupAndResolve({
            chart,
            success: true,
            filePath,
            fileSize: downloadedBytes,
            downloadTime: Date.now() - startTime
          });
        });
        
        fileStream.on('error', (error) => {
          fs.unlink(filePath, () => {}); // Clean up partial file
          cleanupAndResolve({
            chart,
            success: false,
            error: `File write error: ${error.message}`,
            fileSize: 0,
            downloadTime: Date.now() - startTime
          });
        });
      });
      
      request.on('error', (error) => {
        request.destroy(); // Ensure request is destroyed
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
   * Attempt to unzip a downloaded file with smart folder organization
   */
  private async attemptUnzip(zipPath: string, chart: IChart, options: DownloadOptions): Promise<void> {
    try {
      console.log(`📦 Attempting to unzip: ${path.basename(zipPath)}`);
      
      // Create a temporary extraction directory first
      const zipDir = path.dirname(zipPath);
      const tempExtractDir = path.join(zipDir, 'temp_extract_' + Date.now());
      
      // Ensure the temporary directory exists
      if (!fs.existsSync(tempExtractDir)) {
        fs.mkdirSync(tempExtractDir, { recursive: true });
      }
      
      console.log(`📂 Extracting to temporary location: ${tempExtractDir}`);
      
      const { spawn } = require('child_process');
      const os = require('os');
      
      return new Promise((resolve) => {
        let command: string;
        let args: string[];
        
        if (os.platform() === 'win32') {
          // Windows: try PowerShell first
          command = 'powershell';
          args = ['-Command', `Expand-Archive -Path "${zipPath}" -DestinationPath "${tempExtractDir}" -Force`];
        } else {
          // Unix-like systems: use unzip
          command = 'unzip';
          args = ['-o', zipPath, '-d', tempExtractDir];
        }
        
        const child = spawn(command, args, { stdio: 'pipe' });
        
        console.log(`🛠️  Executing: ${command} ${args.join(' ')}`);
        
        let stdout = '';
        let stderr = '';
        
        child.stdout?.on('data', (data: Buffer) => {
          stdout += data.toString();
        });
        
        child.stderr?.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
        
        child.on('close', (code: number) => {
          console.log(`📋 Unzip command output (code ${code}):`);
          if (stdout) console.log(`   stdout: ${stdout.trim()}`);
          if (stderr) console.log(`   stderr: ${stderr.trim()}`);
          
          if (code === 0) {
            // Unzip successful, now organize the files
            this.organizeExtractedFiles(tempExtractDir, zipDir, chart, options);
            
            // Clean up temp directory
            try {
              fs.rmSync(tempExtractDir, { recursive: true, force: true });
            } catch (cleanupError) {
              console.warn(`⚠️  Could not clean up temp directory: ${cleanupError}`);
            }
            
            // Try to clean up the ZIP file after successful extraction
            if (options.deleteZipAfterExtraction !== false) {
              this.cleanupZipFile(zipPath);
            }
            
            resolve();
          } else {
            console.log(`⚠️  Unzip failed (code ${code}). ZIP file preserved: ${zipPath}`);
            // Clean up temp directory on failure too
            try {
              fs.rmSync(tempExtractDir, { recursive: true, force: true });
            } catch (cleanupError) {
              console.warn(`⚠️  Could not clean up temp directory: ${cleanupError}`);
            }
            resolve(); // Don't fail the download if unzip fails
          }
        });
        
        child.on('error', (error: Error) => {
          console.log(`⚠️  Unzip error: ${error.message}. ZIP file preserved: ${zipPath}`);
          // Clean up temp directory on error
          try {
            fs.rmSync(tempExtractDir, { recursive: true, force: true });
          } catch (cleanupError) {
            console.warn(`⚠️  Could not clean up temp directory: ${cleanupError}`);
          }
          resolve(); // Don't fail the download if unzip fails
        });
      });
      
    } catch (error) {
      console.log(`⚠️  Unzip failed: ${error instanceof Error ? error.message : String(error)}. ZIP file preserved: ${zipPath}`);
      // Don't throw - unzip failure shouldn't fail the download
    }
  }

  /**
   * Clean up ZIP file after successful extraction
   */
  private cleanupZipFile(zipPath: string): void {
    try {
      fs.unlinkSync(zipPath);
      console.log(`🗑️  Cleaned up ZIP file: ${path.basename(zipPath)}`);
    } catch (error) {
      console.log(`⚠️  Could not delete ZIP file: ${zipPath}`);
    }
  }

  /**
   * Smart organization of extracted files
   */
  private organizeExtractedFiles(tempDir: string, targetDir: string, chart: IChart, options: DownloadOptions): void {
    try {
      console.log(`🎵 Organizing extracted files...`);
      
      // Check what was extracted
      const extractedItems = fs.readdirSync(tempDir, { withFileTypes: true });
      
      let finalDestination: string;
      
      // Smart folder detection: if ZIP already contains a single folder, use that
      if (extractedItems.length === 1 && extractedItems[0].isDirectory()) {
        const singleFolder = extractedItems[0];
        const singleFolderPath = path.join(tempDir, singleFolder.name);
        
        // Check if this folder contains DTX files (indicates it's a song folder)
        const folderContents = fs.readdirSync(singleFolderPath);
        const hasDtxFiles = folderContents.some(file => file.toLowerCase().endsWith('.dtx'));
        
        if (hasDtxFiles) {
          // ZIP already contains a proper song folder, use it directly
          console.log(`📁 Using existing folder structure: ${singleFolder.name}`);
          finalDestination = path.join(targetDir, 'songs', singleFolder.name);
          
          // Move the entire folder
          if (!fs.existsSync(path.dirname(finalDestination))) {
            fs.mkdirSync(path.dirname(finalDestination), { recursive: true });
          }
          fs.renameSync(singleFolderPath, finalDestination);
        } else {
          // Folder doesn't contain DTX files, create a proper song folder
          this.createSongFolder(tempDir, targetDir, chart, options);
          return;
        }
      } else {
        // Multiple files or folders, create a song folder to contain them
        this.createSongFolder(tempDir, targetDir, chart, options);
        return;
      }
      
      console.log(`✅ Organized to: ${path.basename(finalDestination)}`);
      
    } catch (error) {
      console.log(`⚠️  Could not organize files: ${error instanceof Error ? error.message : String(error)}`);
      // Fallback: create a song folder anyway
      this.createSongFolder(tempDir, targetDir, chart, options);
    }
  }

  /**
   * Create a song folder and move all extracted content into it
   */
  private createSongFolder(tempDir: string, targetDir: string, chart: IChart, options: DownloadOptions): void {
    try {
      // Create a song folder based on chart information
      const songFolderName = this.sanitizeFilename(`${chart.title} - ${chart.artist}`);
      const songFolder = path.join(targetDir, 'songs', songFolderName);
      
      // Ensure the song folder exists
      if (!fs.existsSync(songFolder)) {
        fs.mkdirSync(songFolder, { recursive: true });
      }
      
      // Move all contents from temp directory to song folder
      const items = fs.readdirSync(tempDir);
      for (const item of items) {
        const srcPath = path.join(tempDir, item);
        const destPath = path.join(songFolder, item);
        fs.renameSync(srcPath, destPath);
      }
      
      // Optionally create chart info (disabled by default for cleaner organization)
      if (options.createChartInfo === true) {
        this.createChartInfoFile(songFolder, chart);
      }
      
      console.log(`✅ Created song folder: ${songFolderName}`);
      
    } catch (error) {
      console.log(`⚠️  Could not create song folder: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create chart info file (optional)
   */
  private createChartInfoFile(songFolder: string, chart: IChart): void {
    try {
      // Look for DTX files and other important files
      const files = fs.readdirSync(songFolder, { withFileTypes: true });
      let dtxFiles = 0;
      let audioFiles = 0;
      let imageFiles = 0;
      
      for (const file of files) {
        if (file.isFile()) {
          const extension = path.extname(file.name).toLowerCase();
          
          if (extension === '.dtx') {
            dtxFiles++;
          } else if (['.wav', '.mp3', '.ogg', '.flac'].includes(extension)) {
            audioFiles++;
          } else if (['.jpg', '.jpeg', '.png', '.bmp', '.gif'].includes(extension)) {
            imageFiles++;
          }
        }
      }
      
      console.log(`📊 Found in song folder: ${dtxFiles} DTX files, ${audioFiles} audio files, ${imageFiles} images`);
      
      // Create a simple info file with chart metadata
      const infoFilePath = path.join(songFolder, 'chart-info.txt');
      const chartInfo = [
        `Chart: ${chart.title}`,
        `Artist: ${chart.artist}`,
        `BPM: ${chart.bpm}`,
        `Difficulties: ${chart.difficulties.join(', ')}`,
        `Source: ${chart.source}`,
        `Downloaded: ${new Date().toISOString()}`,
        `Files: ${dtxFiles} DTX, ${audioFiles} audio, ${imageFiles} images`
      ].join('\n');
      
      fs.writeFileSync(infoFilePath, chartInfo, 'utf8');
      console.log(`📝 Created chart info file: chart-info.txt`);
      
    } catch (error) {
      console.log(`⚠️  Could not create chart info: ${error instanceof Error ? error.message : String(error)}`);
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
          // Properly destroy the request and response to free resources
          request.destroy();
          response.destroy();
          resolve(downloadedBytes);
        });
        
        writeStream.on('error', (error) => {
          writeStream.destroy();
          // Properly destroy the request and response on error
          request.destroy();
          response.destroy();
          fs.unlink(filePath, () => {}); // Clean up partial file
          reject(error);
        });
        
      });
      
      request.on('timeout', () => {
        request.destroy();
        reject(new Error(`Download timeout after ${timeout}ms`));
      });
      
      request.on('error', (error) => {
        request.destroy();
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
          response.destroy(); // Ensure response is destroyed
          request.destroy(); // Ensure request is destroyed
          resolve(data);
        });
        
        response.on('error', (error) => {
          response.destroy(); // Ensure response is destroyed
          request.destroy(); // Ensure request is destroyed
          reject(error);
        });
      });
      
      request.on('error', (error) => {
        request.destroy(); // Ensure request is destroyed
        reject(error);
      });
      
      request.setTimeout(15000, () => {
        request.destroy(); // Timeout cleanup
        reject(new Error('Request timeout'));
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
