const https = require("https");
const cheerio = require("cheerio");
const fs = require("fs");
const {get} = require("./utils.js");
const request = require("request");
const extract = require("extract-zip");

class DriveLink {
    
    constructor(url) {
        this.base = "https://drive.google.com/";
        this.driveURL = this.base + "uc?export=download&id=";
        if(!url) throw new Error("No URL provided");
        if(url.includes("drive.google.com/file")) {
            this.id = url.split("/")[5];
        } else if(url.includes("drive.google.com/uc")) {
            this.id = /id=([^&]+)/.exec(url)[1];
        }
    }

    async getDownloadURL() {
        let html = await get(this.driveURL + this.id);
        if(!html) return this.driveURL + this.id;
        let $ = cheerio.load(html);
        let downloadURL = $("form#download-form").attr("action");

        return downloadURL;
    }

    async followVirusCheck() {
        //sometimes says files are too big and asks to confirm download
        // use the form to confirm the download
        let form = $("form#download-form");
        if (!form.length) {
            return Promise.resolve(this.driveURL + this.id);
        }
        let action = form.attr("action");
        let inputs = form.find("input");
        let data = {};
        inputs.each((i, input) => {
            let name = $(input).attr("name");
            let value = $(input).attr("value");
            if (name && value) {
                data[name] = value;
            }
        });
        let method = form.attr("method") || "GET";
        const call = (method.toUpperCase() === "POST") ? request.post : request.get;
        call(action, {form: data}, (err, res, body) => {
            if (err) {
                console.error("Error following virus check:", err);
                return Promise.reject(err);
            }
            if (res.statusCode !== 200) {
                console.error("Failed to follow virus check, status code:", res.statusCode);
                return Promise.reject(new Error("Failed to follow virus check"));
            }
            // Parse the response body to get the final download URL
            let $ = cheerio.load(body);
            let finalDownloadURL = $("a#download").attr("href");
            return Promise.resolve(finalDownloadURL);
        });
    }
    async download(path) {
        const file = fs.createWriteStream(path);
        const downloadURL = await this.getDownloadURL();
        // const promise = new Promise((resolve, reject) => {
        //     request.get(downloadURL).pipe(file);
        //     file.on("finish", () => {
        //         file.close(resolve);
        //     }).on("error", (err) => {
        //         console.log(err);
        //         fs.unlink(path, (unlinkErr) => {
        //             if (unlinkErr) console.log(unlinkErr);
        //         });
        //         reject(err);
        //     });
        // });
        const data = request.get(downloadURL);
        if(data.body.toLowerCase().includes("too large")) {
            // handle large file case

        }
        
        
    }
}
//https://1drv.ms/u/s!AkFLx6UquiX21Ue2ZKfsNLphQypB?e=FOkjCV
/** Method based off this php snippet
 * <?php
$sharedUrl = urldecode($_GET['url']);
$base64 = base64_encode($sharedUrl);
$encodedUrl = "u!" . rtrim($base64, '=');
$encodedUrl = str_replace('/', '_', $encodedUrl);
$encodedUrl = str_replace('+', '-', $encodedUrl);

$final = sprintf('https://api.onedrive.com/v1.0/shares/%s/root/content', $encodedUrl);
header('Location:' . $final, true, 302);
 */
class OneDriveLink {
    constructor(url) {
        if(!url) throw new Error("No URL provided");
        if(url.includes("1drv.ms")) { //need to go through the hoops
            let base64 = Buffer.from(url).toString("base64");
            let encodedUrl = "u!" + base64.replace(/=/g, "");
            encodedUrl = encodedUrl.replace(/\//g, "_");
            encodedUrl = encodedUrl.replace(/\+/g, "-");
            this.url = `https://api.onedrive.com/v1.0/shares/${encodedUrl}/root/content`;
        }
    }

    async getDownloadURL() {
        return this.url;
    }

    async download(path) {
        const file = fs.createWriteStream(path);
        const downloadURL = await this.getDownloadURL();
        return new Promise((resolve, reject) => {
            https.get(downloadURL, (res) => {
                res.pipe(file);
                file.on("finish", () => {
                    file.close(resolve);
                });
            }).on("error", (err) => {
                fs.unlink(path);
                reject(err);
            });
        });
    }
}
async function download(linkObj, path) {
    const file = fs.createWriteStream(path);
    const downloadURL = await linkObj.getDownloadURL();
    return new Promise((resolve, reject) => {
        request.get(downloadURL).pipe(file);
        file.on("finish", () => {
            file.close(resolve);
        }).on("error", (err) => {
            console.log(err);
            fs.unlink(path);
            reject(err);
        });
    });

}


async function unzip(src, dest) {
    console.log(`Unzipping ${src} to ${dest}`);
    await extract(src, {dir: dest});
    console.log(`Unzipped ${src} to ${dest}`);
    fs.unlink(src, (err) => {
        if(err) console.log(err);
    });
}

function convertLinkToObj(link) {
    if(link.includes("drive.google.com"))
        return new DriveLink(link);
    else if(link.includes("1drv.ms"))
        return new OneDriveLink(link);
    else throw new Error("Invalid link");
}

songFolder = "C:/Users/Tushar/Desktop/Applications/DTXManiaNX/DTXFiles/"
module.exports = {DriveLink, OneDriveLink, download, convertLinkToObj, unzip, songFolder};