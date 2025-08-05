/**
 * ApprovedDTX scraping strategy implementation
 */

import * as cheerio from 'cheerio';
import { BaseScrapingStrategy } from '../base-strategy';
import { IChart } from '../../core/models';
import { ChartValidationError } from '../../core/errors';

export class ApprovedDtxStrategy extends BaseScrapingStrategy {
  readonly name = 'approved-dtx';
  readonly baseUrl = 'http://approvedtx.blogspot.com/';

  canHandle(url: string): boolean {
    return url.includes('approvedtx.blogspot.com');
  }

  protected getChartElements($: cheerio.Root): cheerio.Element[] {
    const elements: cheerio.Element[] = [];
    
    // Look for blog post containers - Blogger typically uses these classes
    const blogPostSelectors = [
      'div.post',
      'div.post-body',
      'div.entry-content',
      'article.post',
      'div[class*="post"]'
    ];
    
    for (const selector of blogPostSelectors) {
      $(selector).each((_, element) => {
        const $post = $(element);
        const text = $post.text();
        
        // Check if this post contains chart-like content
        // Look for patterns like "#number." and "BPM :" 
        if (text.includes('#') && text.match(/#\d+\./) && text.includes('BPM')) {
          elements.push(element);
        }
      });
      
      // If we found posts with the current selector, use those
      if (elements.length > 0) {
        break;
      }
    }
    
    // If no specific post containers found, fall back to finding any containers with chart content
    if (elements.length === 0) {
      $('div, article, section').each((_, element) => {
        const $container = $(element);
        const text = $container.text();
        
        // Must contain chart number pattern and BPM info
        if (text.match(/#\d+\./) && text.includes('BPM') && text.includes(':')) {
          // Make sure it's a substantial container (not just a small text fragment)
          if (text.length > 50) {
            elements.push(element);
          }
        }
      });
    }
    
    console.log(`🔍 Found ${elements.length} potential chart elements to process`);
    return elements;
  }

  async extractChartFromElement(element: cheerio.Element): Promise<IChart | null> {
    try {
      const $ = cheerio.load(element);
      const textContent = $(element).text();
      
      // Find chart heading with pattern "#number. Title"
      const headingMatch = textContent.match(/#(\d+)\.\s*([^\n\r]+)/);
      if (!headingMatch) {
        return null;
      }
      
      const chartId = headingMatch[1];
      const title = headingMatch[2].trim();
      
      // Look for the chart URL in any link within the post
      let chartUrl = '';
      $('a').each((_, linkElement) => {
        const href = $(linkElement).attr('href');
        const linkText = $(linkElement).text();
        
        // If this link contains the chart title or chart number, it's likely the chart page link
        if (href && (linkText.includes(`#${chartId}`) || linkText.includes(title.substring(0, 20)))) {
          chartUrl = href;
        }
      });
      
      // Extract artist and BPM info from patterns like:
      // "Title / Artist     123BPM : 2.70/5.20/7.00/8..."
      // "Artist     123BPM : 2.70/5.20/7.00/8..."
      let artist = 'Unknown Artist';
      let bpm = 0;
      let difficulties: number[] = [];
      
      // Try to find artist/BPM pattern
      const artistBpmMatch = textContent.match(/(.+?)\s*\/\s*(.+?)\s*(\d+)BPM\s*:\s*([\d\./]+)/);
      if (artistBpmMatch) {
        artist = artistBpmMatch[2].trim();
        bpm = parseInt(artistBpmMatch[3]);
        difficulties = this.parseDifficulties(artistBpmMatch[4]);
      } else {
        // Try simpler BPM pattern without explicit artist separation
        const simpleBpmMatch = textContent.match(/(\d+)BPM\s*:\s*([\d\./]+)/);
        if (simpleBpmMatch) {
          bpm = parseInt(simpleBpmMatch[1]);
          difficulties = this.parseDifficulties(simpleBpmMatch[2]);
          
          // Try to extract artist from the line before BPM
          const beforeBpmMatch = textContent.match(/(.+?)\s*\d+BPM/);
          if (beforeBpmMatch) {
            const beforeBpm = beforeBpmMatch[1].trim();
            // Look for "/" to separate title and artist
            const parts = beforeBpm.split('/');
            if (parts.length >= 2) {
              artist = parts[parts.length - 1].trim();
            }
          }
        }
      }
      
      if (bpm === 0) {
        return null; // BPM is required
      }
      
      // Determine which batch folder this chart belongs to based on chart number
      const chartNumber = parseInt(chartId);
      
      // Extract download URL - look for Google Drive links directly in the HTML and text
      let downloadUrl = '';
      const $post = $(element);
      
      // Priority 1: Look for Google Drive file links in href attributes
      $post.find('a').each((_, linkElement) => {
        const href = $(linkElement).attr('href');
        if (href && href.includes('drive.google.com/file/d/')) {
          downloadUrl = href;
          return false; // Break the loop
        }
        return; // Explicit return for all code paths
      });
      
      // Priority 2: Look for Google Drive file links in the text content
      if (!downloadUrl) {
        const gdriveFileLinkMatch = textContent.match(/https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+(?:\/view)?(?:\?usp=sharing)?/);
        if (gdriveFileLinkMatch) {
          downloadUrl = gdriveFileLinkMatch[0];
        }
      }
      
      // Priority 3: Look for other Google Drive patterns
      if (!downloadUrl) {
        // Check for uc?id= download links
        const gdriveUcLinkMatch = textContent.match(/https:\/\/drive\.google\.com\/uc\?[^\s\)]*id=([a-zA-Z0-9_-]+)/);
        if (gdriveUcLinkMatch) {
          downloadUrl = gdriveUcLinkMatch[0];
        } else {
          // Check for open?id= links
          const gdriveOpenLinkMatch = textContent.match(/https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
          if (gdriveOpenLinkMatch) {
            downloadUrl = gdriveOpenLinkMatch[0];
          }
        }
      }
      
      // Priority 4: Look for download links in common markdown/text patterns
      if (!downloadUrl) {
        const dlLinkMatch = textContent.match(/\[DL\]\s*\(([^)]+)\)/);
        if (dlLinkMatch) {
          downloadUrl = dlLinkMatch[1];
        }
      }
      
      // Fallback: If no individual file URL found, use batch folder but mark it for enhancement
      if (!downloadUrl || downloadUrl === '') {
        const batchFolder = this.getBatchFolderUrl(chartNumber);
        downloadUrl = batchFolder;
        console.log(`⚠️  Using batch folder for chart #${chartId}, will need individual file URL extraction`);
      }
      
      // Extract preview image
      const imgElement = $('img').first();
      const imageUrl = imgElement.attr('src');
      
      const chart: IChart = {
        id: `approved-dtx-${chartId}`,
        title,
        artist,
        bpm: bpm.toString(),
        difficulties,
        downloadUrl: downloadUrl || chartUrl || '',
        source: this.name,
        tags: ['dtx', 'drum'],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      if (imageUrl) {
        chart.previewImageUrl = imageUrl;
      }
      
      console.log(`📊 Chart found: #${chartId} - "${title}" by ${artist} (${bpm}BPM)`);
      
      return chart;
      
    } catch (error) {
      throw new ChartValidationError(
        `Failed to extract chart from ApprovedDTX element: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  override async getNextPageUrl(_currentUrl: string, html: string): Promise<string | null> {
    const $ = cheerio.load(html);
    
    console.log('Looking for pagination...');
    console.log('HTML length:', html.length);
    
    // Debug: Log all links to see what's available
    console.log('All links found:');
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (href && (href.includes('max-results') || href.includes('updated-max') || text.toLowerCase().includes('older') || text.toLowerCase().includes('next'))) {
        console.log(`  - Link ${i}: "${text}" -> ${href}`);
      }
    });
    
    // Look for "Older Posts" link (common Blogger pagination)
    let olderPostLink = $('a.blog-pager-older-link').first();
    console.log(`Found blog-pager-older-link: ${olderPostLink.length}`);
    
    // If that doesn't work, try alternative selectors
    if (olderPostLink.length === 0) {
      olderPostLink = $('a:contains("Older Posts")').first();
      console.log(`Found "Older Posts" text: ${olderPostLink.length}`);
    }
    
    // Look for Blogger's updated-max pagination
    if (olderPostLink.length === 0) {
      olderPostLink = $('a[href*="updated-max"]').first();
      console.log(`Found updated-max links: ${olderPostLink.length}`);
    }
    
    // Try looking for links with "max-results" parameter (Blogger pagination)
    if (olderPostLink.length === 0) {
      olderPostLink = $('a[href*="max-results"]').first();
      console.log(`Found max-results links: ${olderPostLink.length}`);
    }
    
    // Generic pagination selectors
    if (olderPostLink.length === 0) {
      olderPostLink = $('a:contains("Next")').first();
      console.log(`Found "Next" text: ${olderPostLink.length}`);
    }
    
    // Try archive links (since this site uses archives instead of traditional pagination)
    if (olderPostLink.length === 0) {
      // Look for year archive links
      const archiveLinks = $('a[href*="/2024/"]').first();
      if (archiveLinks.length > 0) {
        console.log(`Found archive link to 2024: ${archiveLinks.attr('href')}`);
        olderPostLink = archiveLinks;
      }
    }
    
    if (olderPostLink.length > 0) {
      const nextUrl = olderPostLink.attr('href');
      console.log(`Found pagination link: ${nextUrl}`);
      return nextUrl || null;
    }
    
    console.log('No pagination link found');
    return null;
  }

  protected override parseDifficulties(difficultyString: string): number[] {
    // ApprovedDTX uses format like "5.5/6.0/7.2" for different difficulties
    return difficultyString
      .split('/')
      .map(d => parseFloat(d.trim()))
      .filter(d => d > 0 && d <= 10); // Valid difficulty range
  }

  protected override generateChartId(title: string, artist: string): string {
    // Create a more specific ID for ApprovedDTX
    const sanitized = `approved-dtx-${title}-${artist}`
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    
    return sanitized.substring(0, 100); // Reasonable length limit
  }

  /**
   * Get the Google Drive batch folder URL for a chart number
   */
  private getBatchFolderUrl(chartNumber: number): string {
    // ApprovedDTX organizes charts into batch folders of 50
    const batchStart = Math.floor((chartNumber - 1) / 50) * 50 + 1;
    const batchEnd = batchStart + 49;
    
    // Map of batch ranges to their Google Drive folder URLs (from the sidebar)
    const batchFolders: Record<string, string> = {
      '1-50': 'https://drive.google.com/drive/folders/1OqQmBL0yocFgVpPo74KCmsVaeiBct0oj?usp=share_link',
      '51-100': 'https://drive.google.com/drive/folders/1T3MbYe4iksTpckLSG7ITEtGV6EtcreXC?usp=sharing',
      '101-150': 'https://drive.google.com/drive/folders/1gA_JAQXaJUAyBjz942-LHiWyzivlqWdf?usp=sharing',
      '151-200': 'https://drive.google.com/drive/folders/1nKzCG_JLQjkgLv5Qk8IO_1OOBqdiC7DW?usp=sharing',
      '251-300': 'https://drive.google.com/drive/folders/1FIInAxTn4FK2HdSWcKmMIcpc3Rl3I7SS?usp=sharing',
      '401-450': 'https://drive.google.com/drive/folders/1jY3WiTUE5L80YtWOtj50JKTpc1rfrrXW?usp=sharing',
      '451-500': 'https://drive.google.com/drive/folders/1YPWiNzhk0CBNbv5w6LxX7XrUjpW9lLr2?usp=sharing',
      '501-550': 'https://drive.google.com/drive/folders/1_ElmLSDCVUTDRNe4b0KtFbuz2nLPQ7N_?usp=share_link',
      '551-600': 'https://drive.google.com/drive/folders/14BGsydYepg0TOfScABvl3AN_vjKHK2Ho?usp=share_link',
      '601-650': 'https://drive.google.com/drive/folders/105RE7HxD7deFJOsgraO1a-nb3ofDA0Qu?usp=share_link',
      '651-700': 'https://drive.google.com/drive/folders/1BjfiLenB20_erwgP3haPFimKIMUqtq92?usp=sharing',
      '701-750': 'https://drive.google.com/drive/folders/1qLxtkCAycGFAY12mcKs8ov5TVdkmRNBe?usp=sharing',
      '751-800': 'https://drive.google.com/drive/folders/1Bc25PnPgU-lVM7k5fRxtcUFaQeqU_95Y?usp=sharing',
      '801-850': 'https://drive.google.com/drive/folders/178FeZTO_JbH37dBwNwvlLW0peneB_fBU?usp=sharing',
      '851-900': 'https://drive.google.com/drive/folders/1P1uAzSWdj9RsA1idiPDWHG__bBbZGiQ1?usp=sharing',
      '901-950': 'https://drive.google.com/drive/folders/1CT2dAqAELo8gFsK4GY6m4l5jatAg2lJe?usp=share_link',
      '951-1000': 'https://drive.google.com/drive/folders/1aoZfht7OCsSgI8uCRLYgAEdX2-QUD0cJ?usp=share_link',
      '1001-1050': 'https://drive.google.com/drive/folders/1Xcrj42CbAVeLIp3tttoerz1HEOpxdxyO?usp=sharing',
      '1051-1100': 'https://drive.google.com/drive/folders/1TUz7IeS4GZbgh9BZUPz4gBPTxX4ZiPb6?usp=sharing',
      '1101-1150': 'https://drive.google.com/drive/folders/1q7haQsCW7e9HWqQndbkRxMKOOR7SvJ9z?usp=sharing',
      '1151-1200': 'https://drive.google.com/drive/folders/1J-JwS1-rp-erRdd5XKtWWDuXEPWS4rtR?usp=sharing',
      '1201-1250': 'https://drive.google.com/drive/folders/1FabkY1S6vgySUfLKGyAHnmYdZ1rn8YjQ?usp=sharing'
    };
    
    const batchKey = `${batchStart}-${batchEnd}`;
    return batchFolders[batchKey] || `https://drive.google.com/drive/folders/unknown-batch-${batchStart}-${batchEnd}`;
  }
}
