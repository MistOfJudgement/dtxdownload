/**
 * Base scraping strategy with common functionality
 */

import * as cheerio from 'cheerio';
import { IScrapingStrategy, Source, ScrapingOptions, ScrapingProgress, ScrapingStatus } from './interfaces';
import { IChart } from '../core/models';
import { HttpClient, HttpClientOptions } from './http-client';
import { ScrapingError, ChartValidationError } from '../core/errors';

export abstract class BaseScrapingStrategy implements IScrapingStrategy {
  abstract readonly name: string;
  abstract readonly baseUrl: string;

  protected readonly httpClient: HttpClient;
  protected scrapingProgress?: ScrapingProgress;

  constructor(httpOptions: HttpClientOptions = {}) {
    this.httpClient = new HttpClient(httpOptions);
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
      
      while (currentUrl && pageCount < maxPages) {
        pageCount++;
        this.updateProgress(pageCount, maxPages, charts.length);
        
        try {
          const { pageCharts, html } = await this.scrapePageWithHtml(currentUrl, source);
          charts.push(...pageCharts);
          
          const nextUrl = await this.getNextPageUrl(currentUrl, html);
          if (!nextUrl) {
            break;
          }
          currentUrl = nextUrl;
          
          if (options.requestDelay || source.rateLimit) {
            await this.delay(options.requestDelay || source.rateLimit || 1000);
          }
          
        } catch (error) {
          const errorMsg = `Error scraping page ${pageCount}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          
          if (errors.length > 5) {
            throw new ScrapingError(`Too many errors during scraping: ${errors.join(', ')}`);
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
      
      if (!chart.downloadUrl?.trim()) {
        throw new ChartValidationError('Download URL is required', 'downloadUrl');
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
}
