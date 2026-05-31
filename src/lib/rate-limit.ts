interface RateLimitWindow {
  timestamps: number[];
}

// In-memory store for IP request timestamps
const rateLimitMap = new Map<string, RateLimitWindow>();

// Setup automatic periodic garbage collection to prevent memory leaks in long-running processes
if (typeof global !== 'undefined') {
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [ip, window] of rateLimitMap.entries()) {
      // Filter out timestamps older than 1 minute (60,000 ms)
      window.timestamps = window.timestamps.filter(t => now - t < 60000);
      if (window.timestamps.length === 0) {
        rateLimitMap.delete(ip);
      }
    }
  }, 60000); // Clean up every 60 seconds

  // Unref the interval so it doesn't block node process exit (especially during testing or builds)
  if (interval && typeof interval.unref === 'function') {
    interval.unref();
  }
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Sliding window rate limiter based on client IP.
 * Defaults to 5 requests per minute per IP.
 * 
 * @param ip Client IP address
 * @param limit Max allowed requests within the window (default 5)
 * @param windowMs Time window in milliseconds (default 60,000ms = 1 minute)
 * @returns RateLimitResult success status, limits, and reset timestamp
 */
export function rateLimit(
  ip: string,
  limit = 5,
  windowMs = 60000
): RateLimitResult {
  const now = Date.now();
  let record = rateLimitMap.get(ip);

  if (!record) {
    record = { timestamps: [] };
    rateLimitMap.set(ip, record);
  }

  // Keep only the timestamps that fall within the current sliding window
  record.timestamps = record.timestamps.filter(t => now - t < windowMs);

  if (record.timestamps.length >= limit) {
    const oldestTimestamp = record.timestamps[0];
    const resetTime = oldestTimestamp + windowMs;
    return {
      success: false,
      limit,
      remaining: 0,
      reset: resetTime,
    };
  }

  // Record the current request timestamp
  record.timestamps.push(now);

  return {
    success: true,
    limit,
    remaining: limit - record.timestamps.length,
    reset: now + windowMs,
  };
}
