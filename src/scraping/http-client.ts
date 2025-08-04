/**
 * HTTP client for scraping with rate limiting and retry logic
 */

import { IncomingMessage } from 'http';
import * as http from 'http';
import * as https from 'https';
import * as zlib from 'zlib';
import { Readable } from 'stream';
import { RateLimitError, ScrapingError } from '../core/errors';

export interface HttpClientOptions {
  userAgent?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
}

export interface HttpResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
  url: string;
  duration: number;
}

export class HttpClient {
  private readonly options: Required<HttpClientOptions>;
  private readonly rateLimiter: RateLimiter;

  constructor(
    options: HttpClientOptions = {},
    rateLimitConfig: RateLimitConfig = {
      requestsPerSecond: 1,
      requestsPerMinute: 30,
      requestsPerHour: 1000
    }
  ) {
    this.options = {
      userAgent: 'DTXDownload-Bot/1.0',
      timeout: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      headers: {},
      ...options
    };
    
    this.rateLimiter = new RateLimiter(rateLimitConfig);
  }

  async get(url: string, additionalHeaders: Record<string, string> = {}): Promise<HttpResponse> {
    await this.rateLimiter.checkLimit();
    
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(url, additionalHeaders);
        return {
          ...response,
          duration: Date.now() - startTime
        };
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.options.maxRetries) {
          await this.delay(this.options.retryDelay * Math.pow(2, attempt));
        }
      }
    }
    
    throw new ScrapingError(`Failed to fetch ${url}`, lastError || undefined);
  }

  private async makeRequest(
    url: string, 
    additionalHeaders: Record<string, string>
  ): Promise<Omit<HttpResponse, 'duration'>> {
    return new Promise((resolve, reject) => {
      const isHttps = url.startsWith('https');
      const client = isHttps ? https : http;
      
      const headers = {
        'User-Agent': this.options.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...this.options.headers,
        ...additionalHeaders
      };

      const request = client.get(url, { headers, timeout: this.options.timeout }, (res: IncomingMessage) => {
        let stream: Readable = res;
        
        // Handle compression
        const encoding = res.headers['content-encoding'];
        if (encoding === 'gzip') {
          stream = res.pipe(zlib.createGunzip());
        } else if (encoding === 'deflate') {
          stream = res.pipe(zlib.createInflate());
        }
        
        let data = '';
        
        stream.on('data', (chunk: Buffer) => {
          data += chunk.toString('utf8');
        });
        
        stream.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: data,
              url
            });
          } else if (res.statusCode === 429) {
            reject(new RateLimitError());
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
        
        stream.on('error', (error: Error) => {
          reject(error);
        });
      });

      request.on('error', (error: Error) => {
        reject(error);
      });

      request.on('timeout', () => {
        request.destroy();
        reject(new Error(`Request timeout for ${url}`));
      });
    });
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class RateLimiter {
  private readonly config: RateLimitConfig;
  private readonly requests: { timestamp: number; window: 'second' | 'minute' | 'hour' }[] = [];

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  async checkLimit(): Promise<void> {
    const now = Date.now();
    this.cleanupOldRequests(now);
    
    const secondCount = this.countRequestsInWindow(now, 1000);
    const minuteCount = this.countRequestsInWindow(now, 60000);
    const hourCount = this.countRequestsInWindow(now, 3600000);
    
    if (secondCount >= this.config.requestsPerSecond) {
      await this.delay(1000 - (now % 1000));
    } else if (minuteCount >= this.config.requestsPerMinute) {
      await this.delay(60000 - (now % 60000));
    } else if (hourCount >= this.config.requestsPerHour) {
      await this.delay(3600000 - (now % 3600000));
    }
    
    this.requests.push({ 
      timestamp: now, 
      window: secondCount < this.config.requestsPerSecond ? 'second' : 
              minuteCount < this.config.requestsPerMinute ? 'minute' : 'hour'
    });
  }

  private cleanupOldRequests(now: number): void {
    const hourAgo = now - 3600000;
    this.requests.splice(0, this.requests.findIndex(req => req.timestamp > hourAgo));
  }

  private countRequestsInWindow(now: number, windowMs: number): number {
    const windowStart = now - windowMs;
    return this.requests.filter(req => req.timestamp > windowStart).length;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
