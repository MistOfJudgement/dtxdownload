/**
 * Core types and interfaces for DTX Download Manager GUI
 */

export interface Chart {
    id: string;
    title: string;
    artist: string;
    bpm: string;
    difficulties: number[];
    source: string;
    downloadUrl: string;
    previewImageUrl?: string;
    imageUrl?: string;
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
}

export interface FilterConfig {
    artists: Set<string>;
    sources: Set<string>;
    difficulties: { min: number; max: number };
    bpm: { min: number; max: number };
}

export interface DownloadOptions {
    chartIds: string[];
    downloadDir: string;
    maxConcurrency: number;
    autoUnzip: boolean;
    organizeSongFolders: boolean;
    deleteZipAfterExtraction: boolean;
}

export interface DownloadProgress {
    completed: number;
    total: number;
    currentChart?: string;
    percentage: number;
}

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    issues: string[]; // For backward compatibility
}

export type ViewMode = 'grid' | 'list';
export type SortOrder = 'asc' | 'desc';

export interface UIState {
    currentPage: number;
    chartsPerPage: number;
    viewMode: ViewMode;
    sortBy: string;
    sortOrder: SortOrder;
    searchQuery: string;
    isLoading: boolean;
}

export interface AppEvents {
    'charts-updated': Chart[];
    'selection-changed': Set<string>;
    'filter-changed': FilterConfig;
    'download-progress': DownloadProgress;
    'status-changed': string;
}
