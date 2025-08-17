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
          downloadUrl TEXT NOT NULL,
          source TEXT NOT NULL,
          tags TEXT, -- JSON string of tags array
          previewImageUrl TEXT,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Create indexes for better query performance
      const createIndexes = [
        'CREATE INDEX IF NOT EXISTS idx_charts_source ON charts(source)',
        'CREATE INDEX IF NOT EXISTS idx_charts_artist ON charts(artist)',
        'CREATE INDEX IF NOT EXISTS idx_charts_title ON charts(title)',
        'CREATE INDEX IF NOT EXISTS idx_charts_bpm ON charts(bpm)'
      ];

      this.db.serialize(() => {
        this.db.run(createChartsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
        });

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
          id, title, artist, bpm, difficulties, downloadUrl, source, tags, previewImageUrl, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      const params = [
        chart.id,
        chart.title,
        chart.artist,
        chart.bpm,
        JSON.stringify(chart.difficulties || []),
        chart.downloadUrl,
        chart.source,
        JSON.stringify(chart.tags || []),
        chart.previewImageUrl || null,
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
          id, title, artist, bpm, difficulties, downloadUrl, source, tags, previewImageUrl, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
            chart.downloadUrl,
            chart.source,
            JSON.stringify(chart.tags || []),
            chart.previewImageUrl || null,
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
      downloadUrl: row.downloadUrl,
      source: row.source,
      tags: row.tags ? JSON.parse(row.tags) : [],
      previewImageUrl: row.previewImageUrl || undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }
}
