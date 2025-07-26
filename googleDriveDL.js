
const {get} = require("./utils.js");
function extractIdFromUrl(url) {
    const regex = /[-\w]{25,}/;
    const match = url.match(regex);
    return match ? match[0] : null;
}
/*
 this.base = "https://drive.google.com/";
        this.driveURL = this.base + "uc?export=download&id=";
        if(!url) throw new Error("No URL provided");
        if(url.includes("drive.google.com/file")) {
            this.id = url.split("/")[5];
        } else if(url.includes("drive.google.com/uc")) {
            this.id = /id=([^&]+)/.exec(url)[1];
        }
Copied from dlHandler.js
*/
function buildDownloadUrl(id) {
    if (!id) throw new Error("No ID provided");
    return `https://drive.google.com/uc?export=download&id=${id}`;
}
const cheerio = require("cheerio");
async function getDataFromPage(url) {
    const html = await Promise.resolve(get(url)).catch(err => {
        console.error("Error fetching data from page:", err);
        throw err;
    });
    if (!html) throw new Error("Failed to fetch HTML");
    const $ = cheerio.load(html);
    return html
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}
async function test() {
    const sampleUrl = "https://drive.google.com/file/d/1enDdb7s6Dmxkn8tCNNZkHh7geYzYUDSw/view?usp=sharing"
    const id = extractIdFromUrl(sampleUrl);
    assert(id === "1enDdb7s6Dmxkn8tCNNZkHh7geYzYUDSw", "Failed to extract correct ID");
    const downloadUrl = buildDownloadUrl(id);
    assert(downloadUrl === "https://drive.google.com/UC?export=download&id=1enDdb7s6Dmxkn8tCNNZkHh7geYzYUDSw", "Failed to build correct download URL");
    console.log(await getDataFromPage(downloadUrl));
}
test();