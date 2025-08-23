/**
 * Test script to verify our UPDATED download URL extraction patterns against chart #741
 */

const fs = require('fs');
const cheerio = require('cheerio');

console.log('=== Testing UPDATED Download URL Extraction for Chart #741 ===\n');

// Simulate the exact HTML structure we found in the browser
const mockChartHtml = `
<div class="post-body entry-content">
  <div class="separator" style="clear: both;">
    <a href="https://blogger.googleusercontent.com/img/a/AVvXsEjPA29clDYBb2dvsL3Chsr4oKltQx_Odx1QFavJUdBvmBqnngrl7X3PRqm0RV931J_Ne1F5gcsMGXsmubhnr2c29cUmzzbE_RQ0S_pncZLZYKjPfW7fT00J7Na6xPwSbeBSlfUbwTvF5C-6TYQ8Llr2KAzNHa9OhUPTfoC-y_nMXcUpSn5V1mLNCGeZ=s400">
      <img alt="" border="0" src="https://blogger.googleusercontent.com/img/a/AVvXsEjPA29clDYBb2dvsL3Chsr4oKltQx_Odx1QFavJUdBvmBqnngrl7X3PRqm0RV931J_Ne1F5gcsMGXsmubhnr2c29cUmzzbE_RQ0S_pncZLZYKjPfW7fT00J7Na6xPwSbeBSlfUbwTvF5C-6TYQ8Llr2KAzNHa9OhUPTfoC-y_nMXcUpSn5V1mLNCGeZ=s200" width="200">
    </a>
  </div>
  <br><br><br>
  <b><span>&nbsp;&nbsp; &nbsp;</span></b>
  <div>
    <b><span>&nbsp;&nbsp; &nbsp;</span>COLORS / Afterglow×FLOW</b><br><br>
    <span>&nbsp;&nbsp; &nbsp;</span>136BPM : 1.20/3.90/5.80/7.10 <a href="https://1drv.ms/u/s!AkFLx6UquiX21jtQBuWBNuPwxpl4?e=NcsUge">DL</a>
  </div>
  <div style="clear: both;"></div>
</div>
`;

// Load with cheerio (simulating our chart element)
const $ = cheerio.load(mockChartHtml);
const element = $('.post-body').get(0); // This simulates the chart element we'd extract
const $post = $(element);
const textContent = $(element).text();

console.log('Chart Content:');
console.log('Title: COLORS / Afterglow×FLOW');
console.log('BPM: 136BPM : 1.20/3.90/5.80/7.10');
console.log('Text content:', textContent.trim());
console.log('');

// Test our UPDATED extraction logic (exactly as in the updated scraper)

let downloadUrl = '';

console.log('=== Testing UPDATED Extraction Logic ===\n');

// Priority 1: Look for download links in href attributes within this chart element
console.log('1. Testing download links in href attributes...');
$post.find('a').each((_, linkElement) => {
  const href = $(linkElement).attr('href');
  const linkText = $(linkElement).text().trim().toLowerCase();
  
  console.log(`   Found link: "${linkText}" -> ${href}`);
  
  // Look for download-like links (DL, download, etc.) with OneDrive or Google Drive URLs
  if (href && (linkText === 'dl' || linkText === 'download' || linkText.includes('download'))) {
    if (href.includes('1drv.ms') || href.includes('drive.google.com/file/d/')) {
      downloadUrl = href;
      console.log(`   ✅ FOUND DOWNLOAD LINK: ${href}`);
      return false; // Break the loop - found specific chart download
    }
  }
});

if (!downloadUrl) {
  console.log('   ❌ No download links found in href attributes');
}

// Priority 2: Look for [DL] markdown links
if (!downloadUrl) {
  console.log('\n2. Testing [DL] markdown links...');
  const dlLinkMatch = textContent.match(/\[DL\]\s*\(([^)]+)\)/);
  if (dlLinkMatch) {
    downloadUrl = dlLinkMatch[1];
    console.log('  ✅ Found [DL] pattern:', dlLinkMatch[1]);
  } else {
    console.log('  ❌ No [DL] markdown links found');
  }
}

// Priority 3: Look for any OneDrive links in text content
if (!downloadUrl) {
  console.log('\n3. Testing OneDrive links in text content...');
  const onedriveMatch = textContent.match(/https?:\/\/1drv\.ms\/[^\s\)]+/);
  if (onedriveMatch) {
    downloadUrl = onedriveMatch[0];
    console.log('  ✅ Found OneDrive text link:', onedriveMatch[0]);
  } else {
    console.log('  ❌ No OneDrive text links found');
  }
}

console.log('\n=== FINAL RESULT ===');
if (downloadUrl) {
  console.log(`🎯 SUCCESS! Would extract download URL: ${downloadUrl}`);
  
  // Test provider detection
  if (downloadUrl.includes('1drv.ms')) {
    console.log('🏷️  Provider: OneDrive (1drv.ms)');
  } else if (downloadUrl.includes('drive.google.com')) {
    console.log('🏷️  Provider: Google Drive');
  }
} else {
  console.log('❌ FAILED! No download URL would be extracted');
}

console.log('\n=== Comparison with Database ===');
console.log('Current database entry for chart #741: Download: undefined');
console.log('Expected after fix: Download:', downloadUrl || 'undefined');
console.log('Status:', downloadUrl ? '✅ FIXED' : '❌ STILL BROKEN');
