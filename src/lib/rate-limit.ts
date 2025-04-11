interface RateLimitConfig {
  pointsToConsume: number;
  intervalInSeconds: number;
  points: number;
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
}

class RateLimit {
  private cache: Map<string, { points: number; timestamp: number }>;

  constructor() {
    this.cache = new Map();
  }

  async check(
    identifier: string,
    prefix: string,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    const key = `${prefix}:${identifier}`;
    const now = Date.now();
    const entry = this.cache.get(key);

    // エントリが存在しない、または期限切れの場合は新規作成
    if (!entry || now - entry.timestamp > config.intervalInSeconds * 1000) {
      this.cache.set(key, {
        points: config.points - config.pointsToConsume,
        timestamp: now
      });

      return {
        success: true,
        limit: config.points,
        remaining: config.points - config.pointsToConsume
      };
    }

    // ポイントが不足している場合は失敗
    if (entry.points < config.pointsToConsume) {
      throw new Error('Rate limit exceeded');
    }

    // ポイントを消費
    const remaining = entry.points - config.pointsToConsume;
    this.cache.set(key, {
      points: remaining,
      timestamp: entry.timestamp
    });

    return {
      success: true,
      limit: config.points,
      remaining
    };
  }
}

export const rateLimit = new RateLimit(); 