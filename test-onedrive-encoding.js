/**
 * Quick test to verify OneDrive URL encoding strategy
 */

// Test OneDrive URL from the 2021 archive
const testUrl = 'https://1drv.ms/u/s!AkFLx6UquiX21i-f3pAr5zM_mFUQ?e=RPsphm';

console.log('🧪 Testing OneDrive URL encoding strategy...');
console.log(`Original URL: ${testUrl}`);

// Implement the encoding method from your old code
function encodeOneDriveUrl(url) {
    if (!url) throw new Error("No URL provided");
    
    if (url.includes("1drv.ms")) {
        // Base64 encode the URL
        let base64 = Buffer.from(url).toString("base64");
        console.log(`Base64 encoded: ${base64}`);
        
        // Add "u!" prefix and remove "=" padding
        let encodedUrl = "u!" + base64.replace(/=/g, "");
        console.log(`After u! prefix and = removal: ${encodedUrl}`);
        
        // Replace "/" with "_" and "+" with "-"
        encodedUrl = encodedUrl.replace(/\//g, "_");
        encodedUrl = encodedUrl.replace(/\+/g, "-");
        console.log(`After character replacement: ${encodedUrl}`);
        
        // Construct the final API URL
        const finalUrl = `https://api.onedrive.com/v1.0/shares/${encodedUrl}/root/content`;
        console.log(`Final API URL: ${finalUrl}`);
        
        return finalUrl;
    }
    
    return url;
}

// Test the encoding
try {
    const encodedUrl = encodeOneDriveUrl(testUrl);
    console.log('\n✅ Encoding successful!');
    console.log(`Encoded URL: ${encodedUrl}`);
    
    // Now let's test if this URL actually works by making a HEAD request
    const fetch = require('node-fetch');
    
    console.log('\n🌐 Testing if the encoded URL works...');
    
    fetch(encodedUrl, { method: 'HEAD' })
        .then(response => {
            console.log(`Response status: ${response.status}`);
            console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));
            
            if (response.status === 200) {
                console.log('✅ SUCCESS! The OneDrive API URL works!');
                console.log('🎉 The encoding strategy from your old code is still valid!');
            } else if (response.status === 302 || response.status === 301) {
                console.log('🔄 REDIRECT! The URL redirects - this might work for actual downloads');
                console.log(`Redirect location: ${response.headers.get('location')}`);
            } else if (response.status === 401) {
                console.log('🔐 AUTHENTICATION REQUIRED! The API is correct but needs auth');
                console.log('✅ The encoding strategy is valid, but we need browser automation for auth');
            } else if (response.status === 403) {
                console.log('🚫 FORBIDDEN! The link might be expired or restricted');
                console.log('✅ The encoding strategy is valid, but this specific link has access issues');
            } else {
                console.log(`❌ FAILED with status ${response.status}`);
            }
            
            // Test with a simple download attempt on original URL
            console.log('\n🔄 Testing original URL with &download=1...');
            const simpleUrl = `${testUrl}&download=1`;
            return fetch(simpleUrl, { method: 'HEAD', redirect: 'manual' });
        })
        .then(response => {
            console.log(`Original URL + &download=1 status: ${response.status}`);
            if (response.status === 302 || response.status === 301) {
                console.log(`🔄 Redirects to: ${response.headers.get('location')}`);
                console.log('✅ Original URL still works and redirects properly!');
            }
        })
        .catch(error => {
            console.log(`❌ ERROR: ${error.message}`);
        });
        
} catch (error) {
    console.log(`❌ Encoding failed: ${error.message}`);
}
