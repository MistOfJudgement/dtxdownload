/**
 * Test script to verify download URL extraction patterns against chart #741
 */

const fs = require('fs');
const cheerio = require('cheerio');

// Read the chart HTML content
const htmlContent = fs.readFileSync('test-chart-741.html', 'utf8');

// Load with cheerio
const $ = cheerio.load(htmlContent);

// Extract text content (simulating what our scraper does)
const textContent = $('body').text();

console.log('=== Testing Download URL Extraction for Chart #741 ===\n');

// Test our patterns in the same order as the updated scraping strategy

console.log('1. Testing [DL] pattern...');
const dlLinkMatch = textContent.match(/\[DL\]\s*\(([^)]+)\)/);
if (dlLinkMatch) {
  console.log('  ✅ Found [DL] pattern:', dlLinkMatch[1]);
} else {
  console.log('  ❌ No [DL] pattern found');
}

console.log('\n2. Testing OneDrive text content patterns...');
const onedriveMatch = textContent.match(/https?:\/\/1drv\.ms\/[^\s\)]+/);
if (onedriveMatch) {
  console.log('  ✅ Found OneDrive text link:', onedriveMatch[0]);
} else {
  console.log('  ❌ No OneDrive text links found');
}

console.log('\n3. Testing OneDrive href attributes...');
let onedriveHref = '';
$('a').each((_, linkElement) => {
  const href = $(linkElement).attr('href');
  if (href && href.includes('1drv.ms')) {
    onedriveHref = href;
    console.log('  ✅ Found OneDrive href:', href);
    return false; // Break
  }
});
if (!onedriveHref) {
  console.log('  ❌ No OneDrive href attributes found');
}

console.log('\n4. Testing Google Drive file links in href...');
let gdriveHref = '';
$('a').each((_, linkElement) => {
  const href = $(linkElement).attr('href');
  if (href && href.includes('drive.google.com/file/d/')) {
    gdriveHref = href;
    console.log('  ✅ Found Google Drive href:', href);
    return false; // Break
  }
});
if (!gdriveHref) {
  console.log('  ❌ No Google Drive file hrefs found');
}

console.log('\n5. Testing Google Drive file links in text...');
const gdriveFileLinkMatch = textContent.match(/https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+(?:\/view)?(?:\?usp=sharing)?/);
if (gdriveFileLinkMatch) {
  console.log('  ✅ Found Google Drive text link:', gdriveFileLinkMatch[0]);
} else {
  console.log('  ❌ No Google Drive file text links found');
}

console.log('\n6. Testing other Google Drive patterns...');
const gdriveUcLinkMatch = textContent.match(/https:\/\/drive\.google\.com\/uc\?[^\s\)]*id=([a-zA-Z0-9_-]+)/);
const gdriveOpenLinkMatch = textContent.match(/https:\/\/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);

if (gdriveUcLinkMatch) {
  console.log('  ✅ Found Google Drive uc link:', gdriveUcLinkMatch[0]);
} else if (gdriveOpenLinkMatch) {
  console.log('  ✅ Found Google Drive open link:', gdriveOpenLinkMatch[0]);
} else {
  console.log('  ❌ No other Google Drive patterns found');
}

console.log('\n=== Final Result ===');
let finalDownloadUrl = '';

if (dlLinkMatch) {
  finalDownloadUrl = dlLinkMatch[1];
  console.log('🎯 Would extract [DL] URL:', finalDownloadUrl);
} else if (onedriveMatch) {
  finalDownloadUrl = onedriveMatch[0];
  console.log('🎯 Would extract OneDrive text URL:', finalDownloadUrl);
} else if (onedriveHref) {
  finalDownloadUrl = onedriveHref;
  console.log('🎯 Would extract OneDrive href URL:', finalDownloadUrl);
} else if (gdriveHref) {
  finalDownloadUrl = gdriveHref;
  console.log('🎯 Would extract Google Drive href URL:', finalDownloadUrl);
} else if (gdriveFileLinkMatch) {
  finalDownloadUrl = gdriveFileLinkMatch[0];
  console.log('🎯 Would extract Google Drive text URL:', finalDownloadUrl);
} else if (gdriveUcLinkMatch) {
  finalDownloadUrl = gdriveUcLinkMatch[0];
  console.log('🎯 Would extract Google Drive uc URL:', finalDownloadUrl);
} else if (gdriveOpenLinkMatch) {
  finalDownloadUrl = gdriveOpenLinkMatch[0];
  console.log('🎯 Would extract Google Drive open URL:', finalDownloadUrl);
} else {
  console.log('❌ No download URL would be extracted - chart would have downloadUrl: undefined');
}

// Also show a snippet of the page content to see what we're working with
console.log('\n=== Page Content Sample ===');
console.log('Title found in page:', $('title').text());

// Look for the actual chart content
const postContent = $('.post-body').text() || $('div.entry-content').text() || $('article').text();
if (postContent) {
  console.log('Post content (first 500 chars):');
  console.log(postContent.substring(0, 500) + '...');
} else {
  console.log('Could not find post content with standard selectors');
}

// Check if there are any DL mentions at all
const dlMentions = textContent.match(/DL/gi) || [];
console.log(`\nFound ${dlMentions.length} mentions of "DL" in the page`);

if (dlMentions.length > 0) {
  // Show context around DL mentions
  const lines = textContent.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('DL')) {
      console.log(`Line ${index}: ${line.trim()}`);
    }
  });
}
