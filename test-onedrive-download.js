/**
 * Test OneDrive redirect flow with download parameter
 */

const fetch = require('node-fetch');

async function testOneDriveDownload() {
    // Test OneDrive URL from the 2021 archive
    const testUrl = 'https://1drv.ms/u/s!AkFLx6UquiX21i-f3pAr5zM_mFUQ?e=RPsphm';
    
    console.log('🧪 Testing OneDrive download with &download=1 parameter...');
    console.log(`Original URL: ${testUrl}`);
    
    // Try adding &download=1 to the original URL
    const downloadUrl = testUrl + '&download=1';
    console.log(`Download URL: ${downloadUrl}`);
    
    try {
        console.log('\n🌐 Testing direct download with &download=1...');
        
        const response = await fetch(downloadUrl, {
            method: 'HEAD',
            redirect: 'manual' // Don't follow redirects automatically so we can see them
        });
        
        console.log(`Response status: ${response.status}`);
        console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));
        
        if (response.status === 200) {
            console.log('✅ SUCCESS! Direct download works!');
            const contentLength = response.headers.get('content-length');
            const contentType = response.headers.get('content-type');
            console.log(`Content-Length: ${contentLength}`);
            console.log(`Content-Type: ${contentType}`);
        } else if (response.status === 302 || response.status === 301) {
            console.log('🔄 REDIRECT! Following the redirect...');
            const location = response.headers.get('location');
            console.log(`Redirect location: ${location}`);
            
            // Follow the redirect
            if (location) {
                console.log('\n🔄 Following redirect...');
                const redirectResponse = await fetch(location, {
                    method: 'HEAD',
                    redirect: 'manual'
                });
                
                console.log(`Redirect response status: ${redirectResponse.status}`);
                console.log(`Redirect response headers:`, Object.fromEntries(redirectResponse.headers.entries()));
                
                if (redirectResponse.status === 200) {
                    console.log('✅ SUCCESS! Download works after redirect!');
                    const contentLength = redirectResponse.headers.get('content-length');
                    const contentType = redirectResponse.headers.get('content-type');
                    console.log(`Content-Length: ${contentLength}`);
                    console.log(`Content-Type: ${contentType}`);
                } else if (redirectResponse.status === 302 || redirectResponse.status === 301) {
                    const secondLocation = redirectResponse.headers.get('location');
                    console.log(`Second redirect to: ${secondLocation}`);
                }
            }
        } else {
            console.log(`❌ FAILED with status ${response.status}`);
        }
        
    } catch (error) {
        console.log(`❌ ERROR: ${error.message}`);
    }
}

testOneDriveDownload();
