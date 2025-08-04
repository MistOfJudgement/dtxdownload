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
    $('div.post-body.entry-content').each((_, element) => {
      elements.push(element);
    });
    return elements;
  }

  async extractChartFromElement(element: cheerio.Element): Promise<IChart | null> {
    try {
      const $ = cheerio.load(element);
      const textContent = $('*').text();
      
      // Extract title and artist using regex patterns
      const titleMatch = textContent.match(/\n\s*(.+)\s*\//);
      const artistMatch = textContent.match(/\/\s+(.+)\s*\n/);
      
      if (!titleMatch || !artistMatch) {
        return null;
      }
      
      const title = titleMatch[1].trim();
      const artist = artistMatch[1].trim();
      
      // Extract BPM
      const bpmMatch = textContent.match(/\n\s*(\d+.*B?PM)\s*:/);
      if (!bpmMatch) {
        return null;
      }
      const bpm = bpmMatch[1].trim();
      
      // Extract difficulties
      const difficultyMatch = textContent.match(/(\d\.\d+\/?)+/);
      if (!difficultyMatch) {
        return null;
      }
      const difficulties = this.parseDifficulties(difficultyMatch[0]);
      
      // Extract download URL (usually the second link)
      const linkElements = $('a');
      if (linkElements.length < 2) {
        return null;
      }
      const downloadUrl = linkElements.eq(1).attr('href');
      if (!downloadUrl) {
        return null;
      }
      
      // Extract image URL
      const imgElement = $('img').first();
      const imageUrl = imgElement.attr('src');
      
      const chart: IChart = {
        id: this.generateChartId(title, artist),
        title,
        artist,
        bpm,
        difficulties,
        downloadUrl,
        source: this.name,
        tags: ['dtx', 'drum'],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      if (imageUrl) {
        chart.previewImageUrl = imageUrl;
      }
      
      return chart;
      
    } catch (error) {
      throw new ChartValidationError(
        `Failed to extract chart from ApprovedDTX element: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  override async getNextPageUrl(_currentUrl: string, html: string): Promise<string | null> {
    const $ = cheerio.load(html);
    const olderPostLink = $('a.blog-pager-older-link').first();
    
    if (olderPostLink.length > 0) {
      const nextUrl = olderPostLink.attr('href');
      return nextUrl || null;
    }
    
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
