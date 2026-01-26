import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RedisService } from 'src/redis/redis.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new (require('@nestjs/common').Logger)(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET') || '',
    });
  }

  async validate(payload: any) {
    const { sub: userId, sid: sessionId, role } = payload;
    const redisUserId = await this.redisService.getSession(sessionId);
    if (!redisUserId || redisUserId !== userId) {
      throw new UnauthorizedException('Session expired');
    }

    // Backend-only app session counting with Redis de-dupe window
    // Count at most once per 30 minutes to approximate sessions
    try {
      const key = `app:session:counted:${userId}`;
      const already = await this.redisService.get(key);
      if (!already) {
        await this.redisService.set(key, true, 30 * 60); // 30 minutes TTL
        // Emit app.session event to let listeners increment counters and award badges
        this.eventEmitter.emit('app.session', { userId });
      }
    } catch (e) {
      // Non-fatal: do not block auth on analytics errors
      this.logger.warn(`Failed to track app session for user ${userId}: ${e?.message || e}`);
    }
    return {
      userId,
      role,
      sessionId,
    };
  }
}
