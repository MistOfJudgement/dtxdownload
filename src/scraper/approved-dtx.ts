import * as cheerio from 'cheerio';
import { get } from '../utils/http';
import { IDtxChart } from '../types';
import { getAllSongs, addSong, saveDatabaseToFile } from '../database/dtx-db';

const BASE_URL = 'http://approvedtx.blogspot.com/';

function getDTXfromPost(post: cheerio.Element): IDtxChart | null {
  try {
    const $ = cheerio.load(post);
    const data = $('*').text();
    
    // Extract title and artist
    const titleMatch = data.match(/\n\s*(.+)\s*\//);
    const artistMatch = data.match(/\/\s+(.+)\s*\n/);
    
    if (!titleMatch || !artistMatch) {
      return null;
    }
    
    const title = titleMatch[1].trim();
    const artist = artistMatch[1].trim();
    
    // Extract BPM
    const bpmMatch = data.match(/\n\s*(\d+.*B?PM) ?:/);
    if (!bpmMatch) {
      return null;
    }
    const bpm = bpmMatch[1];
    
    // Extract difficulties
    const difficultyMatch = data.match(/(\d\.\d+\/?)+/);
    if (!difficultyMatch) {
      return null;
    }
    const difficulties = difficultyMatch[0]
      .split('/')
      .map((difficulty: string) => parseFloat(difficulty));
    
    // Extract image URL
    const imgElement = $('img').first();
    const imgURL = imgElement.attr('src');
    
    // Extract download URL (usually the second link)
    const linkElements = $('a');
    if (linkElements.length < 2) {
      return null;
    }
    const dlURL = linkElements.eq(1).attr('href');
    
    if (!dlURL) {
      return null;
    }
    
    const result: IDtxChart = {
      title,
      artist,
      bpm,
      difficulties,
      dlURL,
    };
    
    if (imgURL) {
      result.imgURL = imgURL;
    }
    
    return result;
  } catch (error) {
    return null;
  }
}

export async function getDtx(url: string, depth: number): Promise<IDtxChart[]> {
  if (depth <= 0) {
    return [];
  }
  
  const html = await get(url);
  const $ = cheerio.load(html);
  const posts = $('div.post-body.entry-content');
  const olderPosts = $('a.blog-pager-older-link');
  const dtxs: IDtxChart[] = [];
  const existingSongs = getAllSongs();
  
  for (let i = 0; i < posts.length; i++) {
    try {
      const dtx = getDTXfromPost(posts[i]);
      if (dtx === null) {
        throw new Error('Invalid post');
      }
      
      // Check if song already exists in database
      const alreadyExists = existingSongs.find(
        existingSong => 
          existingSong.title === dtx.title && existingSong.artist === dtx.artist
      );
      
      if (!alreadyExists) {
        dtxs.push(dtx);
        addSong(dtx);
      }
    } catch (error) {
      const postElement = posts[i];
      let errorContext = 'Unknown post';
      
      try {
        const $ = cheerio.load(postElement);
        const titleElement = $('div').first().text();
        errorContext = titleElement || `Post ${i}`;
      } catch {
        errorContext = `Post ${i}`;
      }
      
      // eslint-disable-next-line no-console
      console.log(`Error processing ${errorContext}:`, error);
    }
  }
  
  // Recursively process older posts
  if (olderPosts.length > 0) {
    const olderUrl = olderPosts.first().attr('href');
    if (olderUrl) {
      const olderDtxs = await getDtx(olderUrl, depth - 1);
      dtxs.push(...olderDtxs);
    }
  }
  
  return dtxs;
}

export async function scrapeAllDtx(maxDepth = 60): Promise<IDtxChart[]> {
  // eslint-disable-next-line no-console
  console.log('Starting DTX scraping...');
  
  const dtxs = await getDtx(BASE_URL, maxDepth);
  
  // eslint-disable-next-line no-console
  console.log(`Found ${dtxs.length} new DTX charts`);
  console.log(dtxs);
  
  // Save to database file
  saveDatabaseToFile();
  
  return dtxs;
}

export async function main(): Promise<void> {
  await scrapeAllDtx();
}
