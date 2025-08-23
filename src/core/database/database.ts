/**
 * Database service for managing DTX charts
 */

import * as sqlite3 from 'sqlite3';
import { IChart, ChartQueryOptions } from '../models';
import { ChartValidationError } from '../errors';

export class ChartDatabase {
  private db: sqlite3.Database;
  private initialized: Promise<void>;

  constructor(dbPath: string = 'charts.db') {
    this.db = new sqlite3.Database(dbPath);
    this.initialized = this.initializeDatabase();
  }

  /**
   * Initialize the database schema
   */
  private async initializeDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Create charts table
      const createChartsTable = `
        CREATE TABLE IF NOT EXISTS charts (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          bpm TEXT NOT NULL,
          difficulties TEXT, -- JSON string of difficulty array
          downloadUrl TEXT, -- Now optional, can be NULL when no valid download source
          source TEXT NOT NULL,
          tags TEXT, -- JSON string of tags array
          previewImageUrl TEXT,
          originalPageUrl TEXT NOT NULL, -- Always required for re-scraping
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create scraping progress table
      const createScrapingProgressTable = `
        CREATE TABLE IF NOT EXISTS scraping_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          url TEXT NOT NULL,
          page_number INTEGER,
          scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          charts_found INTEGER DEFAULT 0,
          status TEXT DEFAULT 'completed', -- 'completed', 'failed', 'partial'
          error_message TEXT,
          UNIQUE(source, url)
        )
      `;

      // Create indexes for better query performance
      const createIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_charts_source ON charts(source)',
        'CREATE INDEX IF NOT EXISTS idx_charts_artist ON charts(artist)',
        'CREATE INDEX IF NOT EXISTS idx_charts_title ON charts(title)',
        'CREATE INDEX IF NOT EXISTS idx_charts_bpm ON charts(bpm)',
        'CREATE INDEX IF NOT EXISTS idx_scraping_progress_source ON scraping_progress(source)',
        'CREATE INDEX IF NOT EXISTS idx_scraping_progress_scraped_at ON scraping_progress(scraped_at)'
      ];

      this.db.serialize(() => {
        this.db.run(createChartsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        this.db.run(createScrapingProgressTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

        // Run migrations for existing databases
        // Note: Database migration temporarily disabled - will require DB wipe
        // this.runMigrations();

        createIndexes.forEach(sql => {
          this.db.run(sql, (err) => {
            if (err) {
              reject(err);
              return;
            }
          });
        });

        console.log('✅ Database initialized');
        resolve();
      });
    });
  }

  /**
   * Run database migrations for schema updates
   * Note: Temporarily disabled - requires database wipe for new schema
   */
  /*
  private runMigrations(): void {
    // Migration 1: Remove downloadSourceMissing column and ensure originalPageUrl exists
    // Note: SQLite doesn't support DROP COLUMN, so we'll work around the existing schema
    
    // First, add originalPageUrl if it doesn't exist
    this.db.run(`
      ALTER TABLE charts ADD COLUMN originalPageUrl TEXT
    `, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error for originalPageUrl:', err.message);
      }
    });

    // Migration 2: Allow downloadUrl to be NULL by updating existing NOT NULL constraint
    // This requires recreating the table for SQLite
    this.db.run(`
      CREATE TABLE IF NOT EXISTS charts_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        artist TEXT NOT NULL,
        bpm TEXT NOT NULL,
        difficulties TEXT,
        downloadUrl TEXT,
        source TEXT NOT NULL,
        tags TEXT,
        previewImageUrl TEXT,
        originalPageUrl TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) {
        console.error('Migration error creating new table:', err.message);
        return;
      }

      // Copy data from old table, setting originalPageUrl to downloadUrl if missing
      this.db.run(`
        INSERT INTO charts_new (id, title, artist, bpm, difficulties, downloadUrl, source, tags, previewImageUrl, originalPageUrl, createdAt, updatedAt)
        SELECT id, title, artist, bpm, difficulties, 
               CASE WHEN downloadSourceMissing = 1 THEN NULL ELSE downloadUrl END,
               source, tags, previewImageUrl, 
               COALESCE(originalPageUrl, downloadUrl, 'unknown'),
               createdAt, updatedAt
        FROM charts
        WHERE NOT EXISTS (SELECT 1 FROM charts_new WHERE charts_new.id = charts.id)
      `, (err) => {
        if (err) {
          console.error('Migration error copying data:', err.message);
          return;
        }

        // Drop old table and rename new one
        this.db.run(`DROP TABLE IF EXISTS charts`, (err) => {
          if (err) {
            console.error('Migration error dropping old table:', err.message);
            return;
          }

          this.db.run(`ALTER TABLE charts_new RENAME TO charts`, (err) => {
            if (err) {
              console.error('Migration error renaming table:', err.message);
            } else {
              console.log('✅ Database migration completed');
            }
          });
        });
      });
    });
  }
  */

  /**
   * Ensure database is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    await this.initialized;
  }

  /**
   * Insert a new chart or update existing one
   */
  async saveChart(chart: IChart): Promise<void> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO charts (
          id, title, artist, bpm, difficulties, downloadUrl, source, tags, previewImageUrl, originalPageUrl, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      const params = [
        chart.id,
        chart.title,
        chart.artist,
        chart.bpm,
        JSON.stringify(chart.difficulties || []),
        chart.downloadUrl || null, // Allow null for missing download sources
        chart.source,
        JSON.stringify(chart.tags || []),
        chart.previewImageUrl || null,
        chart.originalPageUrl, // Now required
        chart.createdAt ? chart.createdAt.toISOString() : new Date().toISOString()
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(new ChartValidationError(`Failed to save chart: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Save multiple charts in a transaction
   */
  async saveCharts(charts: IChart[]): Promise<{ saved: number; errors: string[] }> {
    await this.ensureInitialized();
    
    return new Promise((resolve) => {
      const sql = `
        INSERT OR REPLACE INTO charts (
          id, title, artist, bpm, difficulties, downloadUrl, source, tags, previewImageUrl, originalPageUrl, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      const errors: string[] = [];
      let saved = 0;
      let completed = 0;

      if (charts.length === 0) {
        resolve({ saved: 0, errors: [] });
        return;
      }

      const db = this.db; // Capture reference for callbacks

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        for (const chart of charts) {
          const params = [
            chart.id,
            chart.title,
            chart.artist,
            chart.bpm,
            JSON.stringify(chart.difficulties || []),
            chart.downloadUrl || null, // Allow null for missing download sources
            chart.source,
            JSON.stringify(chart.tags || []),
            chart.previewImageUrl || null,
            chart.originalPageUrl, // Now required
            chart.createdAt ? chart.createdAt.toISOString() : new Date().toISOString()
          ];

          db.run(sql, params, function(err) {
            completed++;
            if (err) {
              errors.push(`Chart ${chart.id}: ${err.message}`);
            } else {
              saved++;
            }

            if (completed === charts.length) {
              if (errors.length > 0) {
                db.run('ROLLBACK', () => {
                  resolve({ saved: 0, errors });
                });
              } else {
                db.run('COMMIT', () => {
                  resolve({ saved, errors });
                });
              }
            }
          });
        }
      });
    });
  }

  /**
   * Get a chart by ID
   */
  async getChart(id: string): Promise<IChart | null> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM charts WHERE id = ?';
      
      this.db.get(sql, [id], (err, row: any) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          resolve(this.mapRowToChart(row));
        }
      });
    });
  }

  /**
   * Query charts with filters
   */
  async queryCharts(options: ChartQueryOptions = {}): Promise<IChart[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM charts WHERE 1=1';
      const params: any[] = [];

      // Apply filters
      if (options.source) {
        sql += ' AND source = ?';
        params.push(options.source);
      }

      if (options.artist) {
        sql += ' AND artist LIKE ?';
        params.push(`%${options.artist}%`);
      }

      if (options.title) {
        sql += ' AND title LIKE ?';
        params.push(`%${options.title}%`);
      }

      if (options.minBpm) {
        sql += ' AND CAST(bpm AS INTEGER) >= ?';
        params.push(options.minBpm);
      }

      if (options.maxBpm) {
        sql += ' AND CAST(bpm AS INTEGER) <= ?';
        params.push(options.maxBpm);
      }

      // Sorting
      if (options.sortBy) {
        const sortOrder = options.sortOrder || 'ASC';
        sql += ` ORDER BY ${options.sortBy} ${sortOrder}`;
      } else {
        sql += ' ORDER BY createdAt DESC';
      }

      // Pagination
      if (options.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);

        if (options.offset) {
          sql += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => this.mapRowToChart(row)));
        }
      });
    });
  }

  /**
   * Get chart count by source
   */
  async getChartCountBySource(): Promise<Record<string, number>> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const sql = 'SELECT source, COUNT(*) as count FROM charts GROUP BY source';
      
      this.db.all(sql, [], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          const result: Record<string, number> = {};
          for (const row of rows) {
            result[row.source] = row.count;
          }
          resolve(result);
        }
      });
    });
  }

  /**
   * Get total chart count
   */
  async getTotalChartCount(): Promise<number> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const sql = 'SELECT COUNT(*) as count FROM charts';
      
      this.db.get(sql, [], (err, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.count);
        }
      });
    });
  }

  /**
   * Check if chart exists
   */
  async chartExists(id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const sql = 'SELECT 1 FROM charts WHERE id = ?';
      
      this.db.get(sql, [id], (err, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!result);
        }
      });
    });
  }

  /**
   * Delete a chart
   */
  async deleteChart(id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM charts WHERE id = ?';
      
      this.db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  /**
   * Clear all charts from a specific source
   */
  async clearChartsFromSource(source: string): Promise<number> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM charts WHERE source = ?';
      
      this.db.run(sql, [source], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Clear all charts from the database
   */
  async clearAllCharts(): Promise<number> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM charts';
      
      this.db.run(sql, [], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Record that a page has been scraped
   */
  async recordPageScraped(source: string, url: string, pageNumber: number | null, chartsFound: number, status: 'completed' | 'failed' | 'partial' = 'completed', errorMessage?: string): Promise<void> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO scraping_progress (
          source, url, page_number, charts_found, status, error_message, scraped_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      const params = [source, url, pageNumber, chartsFound, status, errorMessage || null];

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Check if a page has been scraped
   */
  async isPageScraped(source: string, url: string): Promise<boolean> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const sql = 'SELECT 1 FROM scraping_progress WHERE source = ? AND url = ? AND status = "completed"';
      
      this.db.get(sql, [source, url], (err, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!result);
        }
      });
    });
  }

  /**
   * Get all scraped pages for a source
   */
  async getScrapedPages(source: string): Promise<Array<{ url: string; pageNumber: number | null; scrapedAt: Date; chartsFound: number; status: string }>> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const sql = 'SELECT url, page_number, scraped_at, charts_found, status FROM scraping_progress WHERE source = ? ORDER BY scraped_at DESC';
      
      this.db.all(sql, [source], (err, rows: any[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            url: row.url,
            pageNumber: row.page_number,
            scrapedAt: new Date(row.scraped_at),
            chartsFound: row.charts_found,
            status: row.status
          })));
        }
      });
    });
  }

  /**
   * Get scraping statistics for a source
   */
  async getScrapingStats(source: string): Promise<{ totalPages: number; completedPages: number; failedPages: number; totalCharts: number; lastScrapedAt: Date | null }> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          COUNT(*) as total_pages,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_pages,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_pages,
          SUM(charts_found) as total_charts,
          MAX(scraped_at) as last_scraped_at
        FROM scraping_progress 
        WHERE source = ?
      `;
      
      this.db.get(sql, [source], (err, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            totalPages: result.total_pages || 0,
            completedPages: result.completed_pages || 0,
            failedPages: result.failed_pages || 0,
            totalCharts: result.total_charts || 0,
            lastScrapedAt: result.last_scraped_at ? new Date(result.last_scraped_at) : null
          });
        }
      });
    });
  }

  /**
   * Clear scraping progress for a source
   */
  async clearScrapingProgress(source: string): Promise<number> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM scraping_progress WHERE source = ?';
      
      this.db.run(sql, [source], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Close database connection
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Map database row to IChart object
   */
  private mapRowToChart(row: any): IChart {
    return {
      id: row.id,
      title: row.title,
      artist: row.artist,
      bpm: row.bpm,
      difficulties: row.difficulties ? JSON.parse(row.difficulties) : [],
      downloadUrl: row.downloadUrl || undefined, // Handle NULL values from database
      source: row.source,
      tags: row.tags ? JSON.parse(row.tags) : [],
      previewImageUrl: row.previewImageUrl || undefined,
      originalPageUrl: row.originalPageUrl, // Now required field
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }
}
