/**
 * Base scraping strategy with common functionality
 */

import * as cheerio from 'cheerio';
import { IScrapingStrategy, Source, ScrapingOptions, ScrapingProgress, ScrapingStatus } from './interfaces';
import { IChart } from '../core/models';
import { HttpClient, HttpClientOptions } from './http-client';
import { ScrapingError, ChartValidationError } from '../core/errors';
import { ChartDatabase } from '../core/database';

export abstract class BaseScrapingStrategy implements IScrapingStrategy {
  abstract readonly name: string;
  abstract readonly baseUrl: string;

  protected readonly httpClient: HttpClient;
  protected scrapingProgress?: ScrapingProgress;
  protected database: ChartDatabase | undefined;

  constructor(httpOptions: HttpClientOptions = {}, database?: ChartDatabase) {
    this.httpClient = new HttpClient(httpOptions);
    this.database = database;
  }

  abstract canHandle(url: string): boolean;
  abstract extractChartFromElement(element: cheerio.Element): Promise<IChart | null>;

  async scrapeCharts(source: Source, options: ScrapingOptions = {}): Promise<IChart[]> {
    const startTime = new Date();
    const charts: IChart[] = [];
    const errors: string[] = [];
    
    this.initializeProgress(source.name, startTime);
    
    try {
      let currentUrl = source.baseUrl;
      let pageCount = 0;
      const maxPages = options.maxPages || source.maxPages || 50;
      const resumeFromOlder = options.resumeFromOlder || false;
      
      // If resuming from older charts, find the last scraped page and continue from there
      if (resumeFromOlder && this.database) {
        const scrapedPages = await this.database.getScrapedPages(source.name);
        if (scrapedPages.length > 0) {
          console.log(`📋 Found ${scrapedPages.length} previously scraped pages for ${source.name}`);
          // Skip to finding unscraped content by going to the end
          currentUrl = await this.findOldestUnscrapedUrl(source, scrapedPages);
        }
      }
      
      while (currentUrl && pageCount < maxPages) {
        pageCount++;
        this.updateProgress(pageCount, maxPages, charts.length);
        
        // Check if this page has already been scraped (skip if resuming and page exists)
        if (this.database && options.skipExisting) {
          const isScraped = await this.database.isPageScraped(source.name, currentUrl);
          if (isScraped) {
            console.log(`⏭️  Skipping already scraped page: ${currentUrl}`);
            const nextUrl = await this.getNextPageUrl(currentUrl, ''); // Get next without scraping
            if (!nextUrl) break;
            currentUrl = nextUrl;
            continue;
          }
        }
        
        try {
          console.log(`🔍 Scraping page ${pageCount}: ${currentUrl}`);
          const { pageCharts, html } = await this.scrapePageWithHtml(currentUrl, source);
          charts.push(...pageCharts);
          
          // Record this page as scraped in the database
          if (this.database) {
            await this.database.recordPageScraped(
              source.name, 
              currentUrl, 
              pageCount, 
              pageCharts.length, 
              'completed'
            );
            console.log(`📝 Recorded page ${pageCount} with ${pageCharts.length} charts`);
          }
          
          const nextUrl = await this.getNextPageUrl(currentUrl, html);
          if (!nextUrl) {
            console.log(`🏁 No more pages found after page ${pageCount}`);
            break;
          }
          currentUrl = nextUrl;
          
          if (options.requestDelay || source.rateLimit) {
            await this.delay(options.requestDelay || source.rateLimit || 1000);
          }
          
        } catch (error) {
          const errorMsg = `Error scraping page ${pageCount}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          console.error(errorMsg);
          
          // Record failed page in database
          if (this.database) {
            await this.database.recordPageScraped(
              source.name, 
              currentUrl, 
              pageCount, 
              0, 
              'failed',
              errorMsg
            );
          }
          
          if (errors.length > 5) {
            throw new ScrapingError(`Too many errors during scraping: ${errors.join(', ')}`);
          }
          
          // Continue to next page even if current page failed
          try {
            const nextUrl = await this.getNextPageUrl(currentUrl, '');
            if (!nextUrl) break;
            currentUrl = nextUrl;
          } catch {
            break; // If we can't get next URL, stop
          }
        }
      }
      
      this.completeProgress(charts.length, errors);
      return charts;
      
    } catch (error) {
      this.failProgress(error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async getNextPageUrl(_currentUrl: string, _html: string): Promise<string | null> {
    // Default implementation - can be overridden by specific strategies
    return null;
  }

  protected async scrapePage(url: string, source: Source): Promise<IChart[]> {
    const response = await this.httpClient.get(url, source.customHeaders);
    const $ = cheerio.load(response.body);
    
    const chartElements = this.getChartElements($);
    const charts: IChart[] = [];
    
    for (const element of chartElements) {
      try {
        const chart = await this.extractChartFromElement(element);
        if (chart && this.validateChart(chart)) {
          charts.push(chart);
        }
      } catch (error) {
        // Log individual chart extraction errors but continue processing
        console.warn(`Failed to extract chart from element: ${error}`);
      }
    }
    
    return charts;
  }

  protected async scrapePageWithHtml(url: string, source: Source): Promise<{ pageCharts: IChart[], html: string }> {
    const response = await this.httpClient.get(url, source.customHeaders);
    const $ = cheerio.load(response.body);
    
    const chartElements = this.getChartElements($);
    const charts: IChart[] = [];
    
    for (const element of chartElements) {
      try {
        const chart = await this.extractChartFromElement(element);
        if (chart && this.validateChart(chart)) {
          charts.push(chart);
        }
      } catch (error) {
        // Log individual chart extraction errors but continue processing
        console.warn(`Failed to extract chart from element: ${error}`);
      }
    }
    
    return { pageCharts: charts, html: response.body };
  }

  protected abstract getChartElements($: cheerio.Root): cheerio.Element[];

  protected validateChart(chart: IChart): boolean {
    try {
      if (!chart.title?.trim()) {
        throw new ChartValidationError('Title is required', 'title');
      }
      
      if (!chart.artist?.trim()) {
        throw new ChartValidationError('Artist is required', 'artist');
      }
      
      if (!chart.originalPageUrl?.trim()) {
        throw new ChartValidationError('Original page URL is required for re-scraping', 'originalPageUrl');
      }
      
      // Allow charts without download URLs (they will be marked as missing download source)
      if (chart.downloadUrl) {
        // If download URL exists, validate it's not a Google Drive folder
        if (this.isGoogleDriveFolderUrl(chart.downloadUrl)) {
          // Don't reject, just remove the download URL to mark as missing
          delete (chart as any).downloadUrl;
          console.warn(`⚠️  Removing Google Drive folder URL for chart: ${chart.title} by ${chart.artist}`);
        }
      }
      
      if (!chart.difficulties || chart.difficulties.length === 0) {
        throw new ChartValidationError('At least one difficulty is required', 'difficulties');
      }
      
      // Validate difficulty values
      for (const difficulty of chart.difficulties) {
        if (typeof difficulty !== 'number' || difficulty < 0 || difficulty > 10) {
          throw new ChartValidationError('Difficulty must be between 0 and 10', 'difficulties');
        }
      }
      
      return true;
    } catch (error) {
      if (error instanceof ChartValidationError) {
        console.warn(`Chart validation failed: ${error.message}`, chart);
      }
      return false;
    }
  }

  /**
   * Check if URL is a Google Drive folder
   */
  protected isGoogleDriveFolderUrl(url: string): boolean {
    return url.includes('drive.google.com/drive/folders/');
  }

  protected extractTextContent($: cheerio.CheerioAPI, selector: string): string {
    return $(selector).first().text().trim();
  }

  protected extractAttribute($: cheerio.CheerioAPI, selector: string, attribute: string): string | undefined {
    return $(selector).first().attr(attribute);
  }

  protected parseFloat(value: string): number {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  protected parseDifficulties(difficultyString: string): number[] {
    return difficultyString
      .split(/[\/,]/)
      .map(d => this.parseFloat(d.trim()))
      .filter(d => d > 0);
  }

  protected generateChartId(title: string, artist: string): string {
    const combined = `${title}-${artist}`.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return combined.substring(0, 50);
  }

  private initializeProgress(sourceName: string, startTime: Date): void {
    this.scrapingProgress = {
      sourceName,
      currentPage: 0,
      chartsFound: 0,
      status: ScrapingStatus.RUNNING,
      startTime
    };
  }

  private updateProgress(currentPage: number, totalPages: number, chartsFound: number): void {
    if (this.scrapingProgress) {
      this.scrapingProgress.currentPage = currentPage;
      this.scrapingProgress.totalPages = totalPages;
      this.scrapingProgress.chartsFound = chartsFound;
      
      const elapsed = Date.now() - this.scrapingProgress.startTime.getTime();
      const avgTimePerPage = elapsed / currentPage;
      const remainingPages = totalPages - currentPage;
      
      if (remainingPages > 0) {
        this.scrapingProgress.estimatedCompletion = new Date(Date.now() + (avgTimePerPage * remainingPages));
      }
    }
  }

  private completeProgress(chartsFound: number, _errors: string[]): void {
    if (this.scrapingProgress) {
      this.scrapingProgress.status = ScrapingStatus.COMPLETED;
      this.scrapingProgress.chartsFound = chartsFound;
    }
  }

  private failProgress(_errorMessage: string): void {
    if (this.scrapingProgress) {
      this.scrapingProgress.status = ScrapingStatus.FAILED;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public getProgress(): ScrapingProgress | undefined {
    return this.scrapingProgress;
  }

  /**
   * Find the oldest unscraped URL by working backwards from current pages
   * Default implementation - can be overridden by specific strategies
   */
  protected async findOldestUnscrapedUrl(source: Source, _scrapedPages: Array<{ url: string; pageNumber: number | null }>): Promise<string> {
    // Simple default: start from the base URL and let normal pagination handle finding older content
    // ApprovedDTX strategy can override this to look for archive pages
    return source.baseUrl;
  }
}
