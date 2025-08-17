import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

export interface OneDriveDownloadOptions {
  downloadDir: string;
  timeout?: number;
  chart?: {
    id: string;
    title: string;
    artist?: string;
    downloadUrl: string;
  };
}

export interface OneDriveDownloadResult {
  success: boolean;
  filePath?: string;
  fileSize?: number;
  error?: string;
}

export class WorkingOneDriveDownloader {
  async downloadFromOneDrive(options: OneDriveDownloadOptions): Promise<OneDriveDownloadResult> {
    console.log('🚀 Starting REAL OneDrive download with Puppeteer...');
    
    let browser: puppeteer.Browser | null = null;
    let page: puppeteer.Page | null = null;
    
    try {
      // Ensure download directory exists
      if (!fs.existsSync(options.downloadDir)) {
        fs.mkdirSync(options.downloadDir, { recursive: true });
      }

      console.log('🌐 Launching browser...');
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080'
        ]
      });

      page = await browser.newPage();
      
      // Set up download path
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: options.downloadDir
      });

      console.log(`📥 Navigating to: ${options.chart?.downloadUrl}`);
      await page.goto(options.chart?.downloadUrl || '', {
        waitUntil: 'networkidle0',
        timeout: options.timeout || 30000
      });

      console.log('🔍 Waiting for page to load and looking for download button...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for OneDrive to fully load

      // Multiple strategies to find download button
      const downloadSelectors = [
        '[data-automationid="DownloadButton"]',
        'button[title*="Download"]',
        'button[aria-label*="Download"]',
        'button[data-testid*="download"]',
        'button:has-text("Download")',
        '[data-icon-name="Download"]',
        '.ms-Button--primary:has-text("Download")',
        'button[name="Download"]'
      ];

      let downloadButton = null;
      for (const selector of downloadSelectors) {
        try {
          console.log(`🔍 Trying selector: ${selector}`);
          downloadButton = await page.$(selector);
          if (downloadButton) {
            console.log(`✅ Found download button with selector: ${selector}`);
            break;
          }
        } catch (error) {
          console.log(`❌ Selector failed: ${selector}`);
        }
      }

      if (!downloadButton) {
        // Try to find any button that might be a download button
        console.log('🔍 Looking for any buttons containing download text...');
        const allButtons = await page.$$('button');
        for (const button of allButtons) {
          try {
            const text = await button.evaluate(el => el.textContent?.toLowerCase() || '');
            const title = await button.evaluate(el => el.getAttribute('title')?.toLowerCase() || '');
            const ariaLabel = await button.evaluate(el => el.getAttribute('aria-label')?.toLowerCase() || '');
            
            if (text.includes('download') || title.includes('download') || ariaLabel.includes('download')) {
              downloadButton = button;
              console.log(`✅ Found download button by text content: "${text}" / "${title}" / "${ariaLabel}"`);
              break;
            }
          } catch (error) {
            // Continue to next button
          }
        }
      }

      if (!downloadButton) {
        // Take a screenshot for debugging
        const screenshotPath = path.join(options.downloadDir, 'onedrive-debug.png');
        await page.screenshot({ 
          path: screenshotPath as `${string}.png`, 
          fullPage: true 
        });
        console.log(`📸 Screenshot saved to: ${screenshotPath}`);
        
        throw new Error('Could not find download button on OneDrive page');
      }

      console.log('👆 Clicking download button...');
      
      // Check if it's in a dropdown menu
      const isInMenu = await downloadButton.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.width === 0 || rect.height === 0;
      });

      if (isInMenu) {
        console.log('📋 Download button is in a dropdown menu, looking for menu trigger...');
        const menuTriggers = await page.$$('button[aria-haspopup="true"], button[data-testid*="menu"], [data-icon-name="More"]');
        
        for (const trigger of menuTriggers) {
          try {
            await trigger.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try to find download button again after opening menu
            downloadButton = await page.$('[data-automationid="DownloadButton"]');
            if (downloadButton) {
              console.log('✅ Found download button in opened menu');
              break;
            }
          } catch (error) {
            console.log('❌ Failed to open menu, trying next trigger');
          }
        }
      }

      // Monitor for download
      const downloadPromise = this.waitForDownload(options.downloadDir, options.timeout || 30000);
      
      // Click the download button
      if (downloadButton) {
        await downloadButton.click();
        console.log('⏳ Waiting for download to complete...');
      } else {
        throw new Error('Download button became null before clicking');
      }

      // Wait for download to finish
      const downloadedFile = await downloadPromise;
      
      if (!downloadedFile) {
        throw new Error('Download did not complete within timeout period');
      }

      console.log(`✅ Download completed: ${downloadedFile}`);

      // Get file stats
      const stats = fs.statSync(downloadedFile);
      
      // Rename file with chart info if available
      let finalPath = downloadedFile;
      if (options.chart) {
        const ext = path.extname(downloadedFile);
        const safeName = this.sanitizeFilename(`${options.chart.title}_${options.chart.id}`);
        finalPath = path.join(path.dirname(downloadedFile), `${safeName}${ext}`);
        
        if (finalPath !== downloadedFile) {
          fs.renameSync(downloadedFile, finalPath);
          console.log(`📝 Renamed to: ${path.basename(finalPath)}`);
        }
      }

      return {
        success: true,
        filePath: finalPath,
        fileSize: stats.size
      };

    } catch (error) {
      console.error('❌ OneDrive download failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      if (page) {
        await page.close();
      }
      if (browser) {
        await browser.close();
      }
    }
  }

  private async waitForDownload(downloadDir: string, timeout: number): Promise<string | null> {
    const startTime = Date.now();
    const initialFiles = new Set(fs.readdirSync(downloadDir));
    
    while (Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const currentFiles = fs.readdirSync(downloadDir);
      const newFiles = currentFiles.filter(file => !initialFiles.has(file));
      
      for (const file of newFiles) {
        const filePath = path.join(downloadDir, file);
        const stats = fs.statSync(filePath);
        
        // Check if file is still being downloaded (some browsers create .tmp files)
        if (!file.endsWith('.tmp') && !file.endsWith('.crdownload') && stats.size > 0) {
          // Wait a bit more to ensure download is complete
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check if file size is stable (download complete)
          const newStats = fs.statSync(filePath);
          if (newStats.size === stats.size) {
            return filePath;
          }
        }
      }
    }
    
    return null;
  }

  private sanitizeFilename(filename: string): string {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 200); // Limit length
  }
}
