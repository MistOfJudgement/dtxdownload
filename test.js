const {download, convertLinkToObj, unzip, songFolder} = require('./dlHandler.js');
const {db, getSongsInRange} = require('./dtxDB.js');

toDL = [1171]

if (process.argv.length == 3) {
    toDL = JSON.parse(process.argv[2]);
}

toDL = toDL.map((x) => db[x]);
async function main() {
    for(let i = 0; i < toDL.length; i++) {
        const dtx = toDL[i];
        const linkObj = convertLinkToObj(dtx.dlURL);
        await download(linkObj, `./dtx/${dtx.title}.zip`).then(() => {
            console.log(`Downloaded ${dtx.title}`);
            unzip(`./dtx/${dtx.title}.zip`, songFolder);
        }).catch((err) => {
            console.log(`Failed to download ${dtx.title}`);
            console.log(err);
        });
    }
}

main();