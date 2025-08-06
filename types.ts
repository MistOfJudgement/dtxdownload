/**
 * Shared types for DTX Download Manager
 * This file exports types that are used by both frontend and backend
 */

// Import core types from the backend models
import type { IChart, IChartFilters, IScrapeOptions, IDownloadProgress, IDownloadItem } from './src/core/models/index.js';

// Re-export core types
export type { IChart, IChartFilters, IScrapeOptions, IDownloadProgress, IDownloadItem };

// Additional frontend-specific types
export interface ChartCardData {
  id: string;
  title: string;
  artist: string;
  bpm: string;
  difficulties: number[];
  previewImageUrl?: string;
  selected?: boolean;
}

export interface FilterConfig {
  difficulty: string;
  genre: string;
  search: string;
  artist?: string;
  bpmMin?: number;
  bpmMax?: number;
  diffMin?: number;
  diffMax?: number;
}

export interface DownloadOptions {
  chartIds: string[];
  downloadDir: string;
  maxConcurrency: number;
  autoUnzip: boolean;
  organizeSongFolders: boolean;
  deleteZipAfterExtraction: boolean;
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ChartListResponse {
  charts: IChart[];
  total: number;
  page?: number;
  limit?: number;
}

export interface DownloadResult {
  success: boolean;
  chartId: string;
  title: string;
  artist: string;
  error?: string;
  filePath?: string;
}

export interface DownloadResponse {
  success: boolean;
  results: DownloadResult[];
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
}
