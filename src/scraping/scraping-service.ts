/**
 * Main scraping service that orchestrates different strategies
 */

import { IScrapingService, IScrapingStrategy, Source, ScrapingResult, ScrapingOptions } from './interfaces';
import { ScrapingError, SourceUnavailableError } from '../core/errors';
import { ChartDatabase } from '../core/database';

export class ScrapingService implements IScrapingService {
  private readonly strategies = new Map<string, IScrapingStrategy>();
  private readonly sourceConfigs = new Map<string, Source>();
  private readonly database: ChartDatabase;

  constructor(dbPath?: string) {
    this.database = new ChartDatabase(dbPath);
  }

  registerStrategy(strategy: IScrapingStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  registerSource(source: Source): void {
    this.sourceConfigs.set(source.name, source);
  }

  async scrapeSource(source: Source, options: ScrapingOptions = {}): Promise<ScrapingResult> {
    const startTime = Date.now();
    
    if (!source.enabled) {
      throw new SourceUnavailableError(`Source ${source.name} is disabled`);
    }

    const strategy = this.strategies.get(source.strategy);
    if (!strategy) {
      throw new ScrapingError(`No strategy found for source: ${source.name}`);
    }

    if (!strategy.canHandle(source.baseUrl)) {
      throw new ScrapingError(`Strategy ${source.strategy} cannot handle URL: ${source.baseUrl}`);
    }

    try {
      const charts = await strategy.scrapeCharts(source, options);
      
      // Save charts to database and handle duplicates
      let chartsAdded = 0;
      let chartsDuplicated = 0;
      const errors: string[] = [];

      for (const chart of charts) {
        try {
          const exists = await this.database.chartExists(chart.id);
          if (exists) {
            chartsDuplicated++;
            if (!options.skipExisting) {
              await this.database.saveChart(chart); // Update existing chart
            }
          } else {
            await this.database.saveChart(chart);
            chartsAdded++;
          }
        } catch (error) {
          errors.push(`Failed to save chart ${chart.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      const duration = Date.now() - startTime;
      const nextScrapeTime = this.calculateNextScrapeTime(source);

      const result: ScrapingResult = {
        sourceName: source.name,
        chartsFound: charts.length,
        chartsAdded,
        chartsDuplicated,
        errors,
        duration
      };

      if (nextScrapeTime) {
        result.nextScrapeTime = nextScrapeTime;
      }

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        sourceName: source.name,
        chartsFound: 0,
        chartsAdded: 0,
        chartsDuplicated: 0,
        errors: [errorMessage],
        duration
      };
    }
  }

  async scrapeAllSources(options: ScrapingOptions = {}): Promise<ScrapingResult[]> {
    const enabledSources = Array.from(this.sourceConfigs.values()).filter(source => source.enabled);
    const results: ScrapingResult[] = [];

    for (const source of enabledSources) {
      try {
        const result = await this.scrapeSource(source, options);
        results.push(result);

        // Add delay between sources to be respectful
        if (source.rateLimit > 0) {
          await this.delay(source.rateLimit);
        }
      } catch (error) {
        console.error(`Failed to scrape source ${source.name}:`, error);
        results.push({
          sourceName: source.name,
          chartsFound: 0,
          chartsAdded: 0,
          chartsDuplicated: 0,
          errors: [error instanceof Error ? error.message : String(error)],
          duration: 0
        });
      }
    }

    return results;
  }

  getAllSupportedSources(): Source[] {
    return Array.from(this.sourceConfigs.values());
  }

  getEnabledSources(): Source[] {
    return Array.from(this.sourceConfigs.values()).filter(source => source.enabled);
  }

  async validateSource(source: Source): Promise<boolean> {
    try {
      const strategy = this.strategies.get(source.strategy);
      if (!strategy) {
        return false;
      }

      return strategy.canHandle(source.baseUrl);
    } catch {
      return false;
    }
  }

  getRegisteredStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  getStrategyForSource(sourceName: string): IScrapingStrategy | undefined {
    const source = this.sourceConfigs.get(sourceName);
    if (!source) {
      return undefined;
    }

    return this.strategies.get(source.strategy);
  }

  /**
   * Get the database instance
   */
  getDatabase(): ChartDatabase {
    return this.database;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.database.close();
  }

  private calculateNextScrapeTime(source: Source): Date | undefined {
    // Default to scraping every 24 hours
    const defaultInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
    const interval = source.settings?.scrapeInterval || defaultInterval;
    
    return new Date(Date.now() + interval);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
