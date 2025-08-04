const cheerio = require('cheerio');
const http = require('http');
const zlib = require('zlib');

// Simple test to check for pagination links
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = Buffer.alloc(0);
      
      res.on('data', (chunk) => {
        data = Buffer.concat([data, chunk]);
      });
      
      res.on('end', () => {
        try {
          let html;
          if (res.headers['content-encoding'] === 'gzip') {
            html = zlib.gunzipSync(data).toString('utf8');
          } else {
            html = data.toString('utf8');
          }
          resolve(html);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', reject);
  });
}

async function testPagination() {
  try {
    console.log('Fetching page...');
    const html = await makeRequest('http://approvedtx.blogspot.com/');
    const $ = cheerio.load(html);
    
    console.log('\n=== Looking for pagination links ===');
    
    // Look for various pagination patterns
    const paginationSelectors = [
      'a.blog-pager-older-link',
      'a:contains("Older Posts")',
      'a:contains("Older")',
      'a:contains("Next")',
      'a[href*="max-results"]',
      '.blog-pager a',
      '.pager a'
    ];
    
    paginationSelectors.forEach(selector => {
      const links = $(selector);
      console.log(`${selector}: ${links.length} matches`);
      links.each((i, link) => {
        const href = $(link).attr('href');
        const text = $(link).text().trim();
        console.log(`  - "${text}" -> ${href}`);
      });
    });
    
    console.log('\n=== All links containing "older", "next", or "max-results" ===');
    $('a').each((i, link) => {
      const href = $(link).attr('href') || '';
      const text = $(link).text().toLowerCase().trim();
      
      if (text.includes('older') || text.includes('next') || href.includes('max-results')) {
        console.log(`"${$(link).text().trim()}" -> ${href}`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testPagination();
