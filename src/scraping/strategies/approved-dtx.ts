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
      
      // Look for download links (Google Drive links with [DL] or direct links)
      let downloadUrl = chartUrl;
      const dlLinkMatch = textContent.match(/\[DL\]\s*\(([^)]+)\)/);
      if (dlLinkMatch) {
        downloadUrl = dlLinkMatch[1];
      } else {
        // Look for direct Google Drive links in the text
        const gdriveLinkMatch = textContent.match(/https:\/\/drive\.google\.com[^\s\)]+/);
        if (gdriveLinkMatch) {
          downloadUrl = gdriveLinkMatch[0];
        }
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
}
