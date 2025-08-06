/**
 * Shared types for DTX Download Manager (JavaScript version)
 * This file provides JSDoc type definitions that can be used in JavaScript
 * 
 * @fileoverview Type definitions for DTX Download Manager
 */

/**
 * @typedef {Object} IChart
 * @property {string} id - Unique identifier for the chart
 * @property {string} title - Song title
 * @property {string} artist - Artist name
 * @property {string} bpm - BPM information (can include ranges like "120-140")
 * @property {number[]} difficulties - Array of difficulty ratings
 * @property {string} source - Source identifier (e.g., "approved-dtx")
 * @property {string} downloadUrl - URL to download the chart
 * @property {string} [previewImageUrl] - Optional preview image URL (backend model)
 * @property {string} [imageUrl] - Optional preview image URL (API response)
 * @property {string[]} tags - Tags for categorization
 * @property {Date} createdAt - When the chart was first discovered
 * @property {Date} updatedAt - When the chart was last updated
 */

/**
 * @typedef {Object} IChartFilters
 * @property {string} [title] - Filter by title (partial match)
 * @property {string} [artist] - Filter by artist (partial match)
 * @property {string} [source] - Filter by source
 * @property {number} [minDifficulty] - Filter by minimum difficulty
 * @property {number} [maxDifficulty] - Filter by maximum difficulty
 * @property {string[]} [tags] - Filter by tags
 * @property {number} [offset] - Pagination offset
 * @property {number} [limit] - Pagination limit
 */

/**
 * @typedef {Object} FilterConfig
 * @property {string} difficulty - Difficulty filter
 * @property {string} genre - Genre filter
 * @property {string} search - Search term
 * @property {string} [artist] - Artist filter
 * @property {number} [bpmMin] - Minimum BPM
 * @property {number} [bpmMax] - Maximum BPM
 * @property {number} [diffMin] - Minimum difficulty
 * @property {number} [diffMax] - Maximum difficulty
 */

/**
 * @typedef {Object} DownloadOptions
 * @property {string[]} chartIds - Array of chart IDs to download
 * @property {string} downloadDir - Directory to download to
 * @property {number} maxConcurrency - Maximum concurrent downloads
 * @property {boolean} autoUnzip - Whether to auto-unzip files
 * @property {boolean} organizeSongFolders - Whether to organize into song folders
 * @property {boolean} deleteZipAfterExtraction - Whether to delete ZIP after extraction
 */

/**
 * @typedef {Object} APIResponse
 * @template T
 * @property {boolean} success - Whether the request was successful
 * @property {T} [data] - Response data
 * @property {string} [error] - Error message if failed
 * @property {string} [message] - Additional message
 */

/**
 * @typedef {Object} ChartListResponse
 * @property {IChart[]} charts - Array of charts
 * @property {number} total - Total number of charts
 * @property {number} [page] - Current page
 * @property {number} [limit] - Results per page
 */

/**
 * @typedef {Object} DownloadResult
 * @property {boolean} success - Whether the download was successful
 * @property {string} chartId - Chart ID
 * @property {string} title - Chart title
 * @property {string} artist - Chart artist
 * @property {string} [error] - Error message if failed
 * @property {string} [filePath] - Path to downloaded file
 */

/**
 * @typedef {Object} DownloadResponse
 * @property {boolean} success - Whether the overall download was successful
 * @property {DownloadResult[]} results - Array of individual download results
 * @property {Object} summary - Download summary
 * @property {number} summary.total - Total downloads attempted
 * @property {number} summary.successful - Number of successful downloads
 * @property {number} summary.failed - Number of failed downloads
 */

/**
 * @typedef {Object} IDownloadProgress
 * @property {number} downloaded - Current bytes downloaded
 * @property {number} [total] - Total bytes to download (if known)
 * @property {number} [speed] - Download speed in bytes/second
 * @property {number} [eta] - Estimated time remaining in seconds
 * @property {'pending'|'downloading'|'completed'|'failed'|'cancelled'} status - Current status
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} IScrapeOptions
 * @property {number} [maxPages] - Maximum number of pages to scrape
 * @property {number} [delay] - Delay between requests (ms)
 * @property {boolean} [skipExisting] - Whether to skip already existing charts
 * @property {Object<string, string>} [headers] - Custom headers for requests
 */

// Export types for ES modules (if supported)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Types are not runtime values, but we can export helper functions
  };
}
