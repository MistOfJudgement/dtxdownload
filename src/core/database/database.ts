/**
 * Database service for managing DTX charts
 */

import Database from 'better-sqlite3';
import { IChart, ChartQueryOptions } from '../models';
import { ChartValidationError } from '../errors';

export class ChartDatabase {
  private db: Database.Database;

  constructor(dbPath: string = 'charts.db') {
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  /**
   * Initialize the database schema
   */
  private initializeDatabase(): void {
    // Create charts table
    const createChartsTable = this.db.prepare(`
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
    `);

    // Create indexes for better query performance
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_charts_source ON charts(source)',
      'CREATE INDEX IF NOT EXISTS idx_charts_artist ON charts(artist)',
      'CREATE INDEX IF NOT EXISTS idx_charts_title ON charts(title)',
      'CREATE INDEX IF NOT EXISTS idx_charts_bpm ON charts(bpm)'
    ];

    createChartsTable.run();
    createIndexes.forEach(sql => this.db.prepare(sql).run());

    console.log('✅ Database initialized');
  }

  /**
   * Insert a new chart or update existing one
   */
  async saveChart(chart: IChart): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO charts (
        id, title, artist, bpm, difficulties, downloadUrl, source, tags, previewImageUrl, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    try {
      stmt.run(
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
      );
    } catch (error) {
      throw new ChartValidationError(`Failed to save chart: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Save multiple charts in a transaction
   */
  async saveCharts(charts: IChart[]): Promise<{ saved: number; errors: string[] }> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO charts (
        id, title, artist, bpm, difficulties, downloadUrl, source, tags, previewImageUrl, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    const transaction = this.db.transaction((charts: IChart[]) => {
      const errors: string[] = [];
      let saved = 0;

      for (const chart of charts) {
        try {
          stmt.run(
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
          );
          saved++;
        } catch (error) {
          errors.push(`Chart ${chart.id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      return { saved, errors };
    });

    return transaction(charts);
  }

  /**
   * Get a chart by ID
   */
  async getChart(id: string): Promise<IChart | null> {
    const stmt = this.db.prepare('SELECT * FROM charts WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) {
      return null;
    }

    return this.mapRowToChart(row);
  }

  /**
   * Query charts with filters
   */
  async queryCharts(options: ChartQueryOptions = {}): Promise<IChart[]> {
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

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => this.mapRowToChart(row));
  }

  /**
   * Get chart count by source
   */
  async getChartCountBySource(): Promise<Record<string, number>> {
    const stmt = this.db.prepare('SELECT source, COUNT(*) as count FROM charts GROUP BY source');
    const rows = stmt.all() as any[];

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.source] = row.count;
    }

    return result;
  }

  /**
   * Get total chart count
   */
  async getTotalChartCount(): Promise<number> {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM charts');
    const result = stmt.get() as any;
    return result.count;
  }

  /**
   * Check if chart exists
   */
  async chartExists(id: string): Promise<boolean> {
    const stmt = this.db.prepare('SELECT 1 FROM charts WHERE id = ?');
    return !!stmt.get(id);
  }

  /**
   * Delete a chart
   */
  async deleteChart(id: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM charts WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Clear all charts from a specific source
   */
  async clearChartsFromSource(source: string): Promise<number> {
    const stmt = this.db.prepare('DELETE FROM charts WHERE source = ?');
    const result = stmt.run(source);
    return result.changes;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
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
