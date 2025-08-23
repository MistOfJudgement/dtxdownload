/**
 * Download Provider Utilities
 * Functions to detect and analyze download providers from URLs
 */

export type DownloadProvider = 'Google Drive' | 'OneDrive' | 'Direct' | 'Unknown';

export interface DownloadProviderInfo {
  provider: DownloadProvider;
  icon: string;
  color: string;
  supportLevel: 'Full' | 'Partial' | 'Manual';
  description: string;
}

/**
 * Detect download provider from URL
 */
export function detectDownloadProvider(url: string): DownloadProvider {
  if (!url) return 'Unknown';
  
  const urlLower = url.toLowerCase();
  
  // Google Drive patterns
  if (urlLower.includes('drive.google.com') || 
      urlLower.includes('drive.usercontent.google.com') ||
      urlLower.includes('docs.google.com')) {
    return 'Google Drive';
  }
  
  // OneDrive patterns
  if (urlLower.includes('1drv.ms') ||
      urlLower.includes('onedrive.live.com') ||
      urlLower.includes('sharepoint.com') ||
      urlLower.includes('my.sharepoint.com')) {
    return 'OneDrive';
  }
  
  // Direct download patterns (common file hosting)
  if (urlLower.includes('dropbox.com') ||
      urlLower.includes('mega.nz') ||
      urlLower.includes('mediafire.com') ||
      urlLower.includes('archive.org') ||
      urlLower.match(/\.(zip|rar|7z|tar|gz)(\?|$)/)) {
    return 'Direct';
  }
  
  return 'Unknown';
}

/**
 * Get download provider information including icons and colors
 */
export function getDownloadProviderInfo(provider: DownloadProvider): DownloadProviderInfo {
  switch (provider) {
    case 'Google Drive':
      return {
        provider: 'Google Drive',
        icon: 'fab fa-google-drive',
        color: '#4285f4',
        supportLevel: 'Full',
        description: 'Automated download with virus scan handling'
      };
      
    case 'OneDrive':
      return {
        provider: 'OneDrive',
        icon: 'fab fa-microsoft',
        color: '#0078d4',
        supportLevel: 'Partial',
        description: 'Limited automation, may require manual intervention'
      };
      
    case 'Direct':
      return {
        provider: 'Direct',
        icon: 'fas fa-download',
        color: '#28a745',
        supportLevel: 'Full',
        description: 'Direct file download'
      };
      
    case 'Unknown':
    default:
      return {
        provider: 'Unknown',
        icon: 'fas fa-question-circle',
        color: '#6c757d',
        supportLevel: 'Manual',
        description: 'Unknown provider, manual download may be required'
      };
  }
}

/**
 * Get download provider from URL with caching
 */
const providerCache = new Map<string, DownloadProvider>();

export function getDownloadProviderCached(url: string): DownloadProvider {
  if (providerCache.has(url)) {
    return providerCache.get(url)!;
  }
  
  const provider = detectDownloadProvider(url);
  providerCache.set(url, provider);
  return provider;
}

/**
 * Clear the provider cache (useful for testing or memory management)
 */
export function clearProviderCache(): void {
  providerCache.clear();
}

/**
 * Get support level color class for CSS
 */
export function getSupportLevelClass(supportLevel: string): string {
  switch (supportLevel) {
    case 'Full':
      return 'support-full';
    case 'Partial':
      return 'support-partial';
    case 'Manual':
      return 'support-manual';
    default:
      return 'support-unknown';
  }
}

/**
 * Check if URL is a folder/batch download URL
 */
export function isFolderUrl(url: string): boolean {
  if (!url) return false;
  
  const urlLower = url.toLowerCase();
  
  // Google Drive folder
  if (urlLower.includes('drive.google.com/drive/folders/')) {
    return true;
  }
  
  // OneDrive folder
  if (urlLower.includes('onedrive.live.com') && urlLower.includes('folder')) {
    return true;
  }
  
  return false;
}

/**
 * Get friendly provider name for display
 */
export function getProviderDisplayName(provider: DownloadProvider): string {
  switch (provider) {
    case 'Google Drive':
      return 'Google Drive';
    case 'OneDrive':
      return 'OneDrive';
    case 'Direct':
      return 'Direct Download';
    case 'Unknown':
    default:
      return 'Unknown';
  }
}
