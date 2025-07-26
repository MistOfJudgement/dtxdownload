const https = require('https');
const http = require('http');
const cheerio = require('cheerio');
const fs = require('fs');
let url = "http://approvedtx.blogspot.com/";
const { get } = require('./utils.js');
let dbdata = [];
try{
    dbdata = require('./db.json');
} catch(err) {
    console.log("no db.json found");
}
/**
 * @typedef {Object} Dtx
 * @property {string} title
 * @property {string} artist
 * @property {string} bpm
 * @property {Array<number>} levels
 * @property {string} dlURL
 * @property {string} [imgURL]
 * 
 */

function getDTXfromPost(post) {
    // if(post.children.length !== 13) return null;//TODO i can do better
    // const titleDiv = post.children[8];
    // const difficultyDiv = post.children[9];
    // const dtx = {}
    // if(!titleDiv.children[0].children[1]) return null;
    // dtx.title = titleDiv.children[0].children[1].data.slice(0, -3);
    // dtx.artist = titleDiv.children[1].children[0].data;
    // dtx.difficulties = difficultyDiv.children[3].data.split(":")[1].trim().split("/").map((x) => parseFloat(x));
    // dtx.bpm = difficultyDiv.children[3].data.split(":")[0].trim().slice(0, -3);
    // dtx.dlURL = difficultyDiv.children[4].attribs.href;
    // dtx.imgURL = post.children[1].children[0].children[0].attribs.src;
    const $ = cheerio.load(post);
    let data = $.text();
    let dtx = {};
    dtx.title = data.match(/\n\s*(.+)\s*\//)[1];
    dtx.artist = data.match(/\/\s+(.+)\s*\n/)[1];
    //look there are input errors on the blog. what can i do about it?
    dtx.bpm = data.match(/\n\s*(\d+.*B?PM) ?:/)[1];
    dtx.difficulties = data.match(/(\d\.\d+\/?)+/)[0].split("/").map((x) => parseFloat(x));
    dtx.imgURL = $('img').attr('src');
    dtx.dlURL = $('a')[1].attribs.href;
    return dtx;
}
/**
 * @param {string} url
 */
async function getDtx(url, depth) {
    if(depth <= 0) return [];
    const html = await get(url);
    const $ = cheerio.load(html);
    const posts = $('div.post-body.entry-content');
    const olderPosts = $('a.blog-pager-older-link');
    const dtxs = [];
    for(let i = 0; i < posts.length; i++) {
        try {
            let dtx = getDTXfromPost(posts[i]);
            if(dtx === null) throw new Error("Invalid post");
            if(dbdata.find((x) => x.title === dtx.title && x.artist === dtx.artist)) continue;
            dtxs.push(dtx);
        } catch(err) {
            console.log("err on ["+i+"] " + posts[i].parent.children[9]?.children[1]?.children[0]?.data);
        }
    }
    if(olderPosts.length > 0) {
        const olderDtxs = await getDtx(olderPosts[0].attribs.href, depth - 1);
        dtxs.push(...olderDtxs);
    }
    return dtxs;

}

async function main() {
    const dtxs = await getDtx(url, 60);
    console.log(dtxs);
    fs.writeFileSync('./db.json', JSON.stringify([...dbdata, ...dtxs]));
}

main();