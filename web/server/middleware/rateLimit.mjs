const userCounts = new Map();

// Reset counts every hour
setInterval(() => userCounts.clear(), 60 * 60 * 1000);

export function rateLimiter(maxPerHour) {
  return (req, res, next) => {
    const key = `${req.userId}:${req.baseUrl}`;
    const count = userCounts.get(key) || 0;

    if (count >= maxPerHour) {
      return res.status(429).json({
        error: `Rate limit exceeded. Max ${maxPerHour} requests per hour for this endpoint.`
      });
    }

    userCounts.set(key, count + 1);
    next();
  };
}
