const http = require('http');
const https = require('https');

async function get(url) {
    if(url.startsWith("https")) {
        return await getHTTPS(url);
    } else {
        return await getHTTP(url);
    }
}
async function getHTTP(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = "";
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve(data);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}
async function getHTTPS(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = "";
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve(data);
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

module.exports = {get, getHTTP, getHTTPS};