import * as https from 'https';
import * as fs from 'fs';
import * as cheerio from 'cheerio';
import * as request from 'request';
import extract from 'extract-zip';
import { get } from '../utils/http';
import { IDownloadLink } from '../types';

const SONG_FOLDER = 'C:/Users/Tushar/Desktop/Applications/DTXManiaNX/DTXFiles/';

export class DriveLink implements IDownloadLink {
  private readonly base = 'https://drive.google.com/';
  private readonly driveURL: string;
  private readonly id: string;

  constructor(url: string) {
    this.driveURL = this.base + 'uc?export=download&id=';
    if (!url) {
      throw new Error('No URL provided');
    }
    if (url.includes('drive.google.com/file')) {
      const urlParts = url.split('/');
      this.id = urlParts[5];
    } else if (url.includes('drive.google.com/uc')) {
      const match = /id=([^&]+)/.exec(url);
      if (!match) {
        throw new Error('Invalid Google Drive URL format');
      }
      this.id = match[1];
    } else {
      throw new Error('Invalid Google Drive URL');
    }
  }

  async getDownloadURL(): Promise<string> {
    const html = await get(this.driveURL + this.id);
    if (!html) {
      return this.driveURL + this.id;
    }

    const $ = cheerio.load(html);
    const downloadURL = $('form#download-form').attr('action');

    return downloadURL || this.driveURL + this.id;
  }

  async followVirusCheck(): Promise<string> {
    return new Promise((resolve, reject) => {
      const html = get(this.driveURL + this.id);
      html
        .then(htmlContent => {
          const $ = cheerio.load(htmlContent);
          
          // Check for virus warning form
          const form = $('form#download-form');
          if (!form.length) {
            return resolve(this.driveURL + this.id);
          }

          const action = form.attr('action');
          if (!action) {
            return resolve(this.driveURL + this.id);
          }

          const inputs = form.find('input');
          const data: Record<string, string> = {};
          
          inputs.each((_, input) => {
            const $input = $(input);
            const name = $input.attr('name');
            const value = $input.attr('value');
            if (name && value) {
              data[name] = value;
            }
          });

          const method = form.attr('method') || 'GET';
          const requestMethod = method.toUpperCase() === 'POST' ? request.post : request.get;

          requestMethod(action, { form: data }, (err, res, body) => {
            if (err) {
              // eslint-disable-next-line no-console
              console.error('Error following virus check:', err);
              return reject(err);
            }
            if (res.statusCode !== 200) {
              // eslint-disable-next-line no-console
              console.error('Failed to follow virus check, status code:', res.statusCode);
              return reject(new Error('Failed to follow virus check'));
            }

            // Parse the response body to get the final download URL
            const $response = cheerio.load(body);
            const finalDownloadURL = $response('a#download').attr('href');
            return resolve(finalDownloadURL || this.driveURL + this.id);
          });
        })
        .catch(reject);
    });
  }

  async download(path: string): Promise<void> {
    const file = fs.createWriteStream(path);
    const downloadURL = await this.getDownloadURL();

    return new Promise((resolve, reject) => {
      request
        .get(downloadURL)
        .pipe(file)
        .on('finish', () => {
          file.close();
          resolve();
        })
        .on('error', (err: Error) => {
          // eslint-disable-next-line no-console
          console.log(err);
          fs.unlink(path, unlinkErr => {
            if (unlinkErr) {
              // eslint-disable-next-line no-console
              console.log(unlinkErr);
            }
          });
          reject(err);
        });
    });
  }
}

export class OneDriveLink implements IDownloadLink {
  private readonly url: string;

  constructor(url: string) {
    if (!url) {
      throw new Error('No URL provided');
    }
    
    if (url.includes('1drv.ms')) {
      // Convert OneDrive share URL to direct download URL
      const base64 = Buffer.from(url).toString('base64');
      let encodedUrl = 'u!' + base64.replace(/=/g, '');
      encodedUrl = encodedUrl.replace(/\//g, '_');
      encodedUrl = encodedUrl.replace(/\+/g, '-');
      this.url = `https://api.onedrive.com/v1.0/shares/${encodedUrl}/root/content`;
    } else {
      this.url = url;
    }
  }

  async getDownloadURL(): Promise<string> {
    return this.url;
  }

  async download(path: string): Promise<void> {
    const file = fs.createWriteStream(path);
    const downloadURL = await this.getDownloadURL();
    
    return new Promise((resolve, reject) => {
      https
        .get(downloadURL, res => {
          res.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        })
        .on('error', (err: Error) => {
          fs.unlink(path, unlinkErr => {
            if (unlinkErr) {
              // eslint-disable-next-line no-console
              console.log(unlinkErr);
            }
          });
          reject(err);
        });
    });
  }
}

export async function download(linkObj: IDownloadLink, path: string): Promise<void> {
  return linkObj.download(path);
}

export async function unzip(src: string, dest: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`Unzipping ${src} to ${dest}`);
  await extract(src, { dir: dest });
  // eslint-disable-next-line no-console
  console.log(`Unzipped ${src} to ${dest}`);
  
  return new Promise((resolve, reject) => {
    fs.unlink(src, err => {
      if (err) {
        // eslint-disable-next-line no-console
        console.log(err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

export function convertLinkToObj(link: string): IDownloadLink {
  if (link.includes('drive.google.com')) {
    return new DriveLink(link);
  } else if (link.includes('1drv.ms')) {
    return new OneDriveLink(link);
  } else {
    throw new Error('Invalid link: Unsupported service');
  }
}

export { SONG_FOLDER as songFolder };
