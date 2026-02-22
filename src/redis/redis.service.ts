import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis, { RedisOptions } from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly JOIN_CODE_SET_KEY = 'community:join_codes';

  constructor() {
    const options: RedisOptions = {
      maxRetriesPerRequest: null,
      enableReadyCheck: false, // Valkey compatibility
      retryStrategy: (attempt) => {
        console.log(`Redis reconnect attempt #${attempt}`);
        return Math.min(attempt * 200, 2000);
      },
      tls: {}, // REQUIRED for Aiven Valkey
      username: process.env.REDIS_USERNAME,
      password: process.env.REDIS_PASSWORD,
    };

    if (process.env.REDIS_URL) {
      // Ensure user uses rediss:// for SSL Valkey
      const url = process.env.REDIS_URL.replace(/^redis:\/\//, 'rediss://');
      this.client = new Redis(url, options);
    } else {
      this.client = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: Number(process.env.REDIS_PORT) || 6379,
        db: Number(process.env.REDIS_DB) || 0,
        ...options,
      });
    }

    this.setupEventHandlers();
  }
  private setupEventHandlers() {
    this.client.on('connect', () => console.log('Redis: connected'));
    this.client.on('ready', () => console.log('Redis: ready'));
    this.client.on('reconnecting', () => console.log('Redis: reconnecting...'));
    this.client.on('end', () => console.log('Redis: closed'));
    this.client.on('error', (err) => console.error('Redis: error:', err));
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  // ** version helper

  async isJoinCodeUsed(code: string): Promise<boolean> {
    return (await this.client.sismember(this.JOIN_CODE_SET_KEY, code)) === 1;
  }

  async resetJoinCodes(): Promise<void> {
    await this.client.del(this.JOIN_CODE_SET_KEY);
  }

  async releaseJoinCode(code: string): Promise<void> {
    await this.client.srem(this.JOIN_CODE_SET_KEY, code);
  }

  async addJoinCodes(codes: string[]): Promise<void> {
    if (!codes.length) return;
    await this.client.sadd(this.JOIN_CODE_SET_KEY, ...codes);
  }

  async set(key: string, value: any, ttlSeconds: number) {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async get<T = any>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    return value ? JSON.parse(value) : null;
  }

  async del(key: string) {
    await this.client.del(key);
  }

  async delByPattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } while (cursor !== '0');
  }

  async setSession(sessionId: string, userId: string, ttlSeconds: number) {
    await this.client.set(
      `auth:session:${sessionId}`,
      userId,
      'EX',
      ttlSeconds,
    );
  }

  async getVersion(baseKey: string): Promise<number> {
    const v = await this.client.get(`${baseKey}:version`);
    if (!v) return 0;
    const parsed = Number(v);
    return isNaN(parsed) ? 0 : parsed;
  }

  async incrementVersion(baseKey: string) {
    return this.client.incr(`${baseKey}:version`);
  }

  async getVersioned<T>(baseKey: string) :Promise<T | null>{
    const version = await this.getVersion(baseKey);
    if(version === 0) return null;
    const data = await this.client.get(`${baseKey}:v${version}`);
    return data ? JSON.parse(data) : null
  }

  // ** write through update 
  async setVersioned(baseKey:string,value:any,ttlSeconds:number):Promise<{oldVersion:number,newVersion:number}>{
    const oldVersion = await this.getVersion(baseKey)
    const newVersion = await this.incrementVersion(baseKey);
    await this.client.set(`${baseKey}:v${newVersion}`,JSON.stringify(value))
    return{oldVersion,newVersion}
  }

  // ** invalidation worker 
  async deleteVersion(baseKey:string,version:number){
    await this.client.del(`${baseKey}:v${version}`)
  }



  async getSession(sessionId: string) {
    return this.client.get(`auth:session:${sessionId}`);
  }

  async deleteSession(sessionId: string) {
    return this.client.del(`auth:session:${sessionId}`);
  }

  // OTP Management
  async setOTP(email: string, otp: string, ttlSeconds: number = 600): Promise<void> {
    await this.client.set(`auth:otp:${email}`, otp, 'EX', ttlSeconds);
  }

  async getOTP(email: string): Promise<string | null> {
    return this.client.get(`auth:otp:${email}`);
  }

  async deleteOTP(email: string): Promise<void> {
    await this.client.del(`auth:otp:${email}`);
  }

  // Store pending signup data temporarily
  async setPendingSignup(email: string, data: any, ttlSeconds: number = 900): Promise<void> {
    await this.client.set(`auth:pending:${email}`, JSON.stringify(data), 'EX', ttlSeconds);
  }

  async getPendingSignup(email: string): Promise<any | null> {
    const data = await this.client.get(`auth:pending:${email}`);
    return data ? JSON.parse(data) : null;
  }

  async deletePendingSignup(email: string): Promise<void> {
    await this.client.del(`auth:pending:${email}`);
  }

  // Rate limiting for OTP requests
  async incrementOTPRequests(email: string, ttlSeconds: number = 3600): Promise<number> {
    const key = `auth:otp:rate:${email}`;
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, ttlSeconds);
    }
    return count;
  }

  async getOTPRequestCount(email: string): Promise<number> {
    const count = await this.client.get(`auth:otp:rate:${email}`);
    return count ? parseInt(count, 10) : 0;
  }

  async resetOTPRequests(email: string): Promise<void> {
    await this.client.del(`auth:otp:rate:${email}`);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
