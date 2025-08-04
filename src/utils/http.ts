import { IncomingMessage } from 'http';
import * as http from 'http';
import * as https from 'https';

export async function get(url: string): Promise<string> {
  if (url.startsWith('https')) {
    return await getHTTPS(url);
  } else {
    return await getHTTP(url);
  }
}

async function getHTTP(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res: IncomingMessage) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          resolve(data);
        });
      })
      .on('error', (err: Error) => {
        reject(err);
      });
  });
}

async function getHTTPS(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res: IncomingMessage) => {
        let data = '';
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on('end', () => {
          resolve(data);
        });
      })
      .on('error', (err: Error) => {
        reject(err);
      });
  });
}
