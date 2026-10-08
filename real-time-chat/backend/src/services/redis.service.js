import Redis from 'ioredis';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';


let redisClient = null;
let redisPubClient = null;
let redisSubClient = null;

if (env.REDIS_URL) {
  const options = {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null;
      return Math.min(times * 100, 3000);
    },
    // enableOfflineQueue: false
  };

  redisClient = new Redis(env.REDIS_URL, options);
  redisPubClient = new Redis(env.REDIS_URL, options);
  redisSubClient = new Redis(env.REDIS_URL, options);

  const handleErr = (client, name) => {
    client.on('error', (err) => {
      if (err.code !== 'ECONNREFUSED' || !client.__hasLoggedOffline) {
        logger.warn({ errCode: err.code, client: name }, 'Redis connection error');
        if (err.code === 'ECONNREFUSED') client.__hasLoggedOffline = true;
      }
    });
    client.on('connect', () => {
      logger.info({ client: name }, 'Redis connected successfully');
      client.__hasLoggedOffline = false;
    });
  };

  handleErr(redisClient, 'main');
  handleErr(redisPubClient, 'pub');
  handleErr(redisSubClient, 'sub');
}


export const getJson = async (key) => {
  if (!redisClient) return null;
  try {
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.warn({ errCode: err.code, key }, 'Redis getJson failed');
    return null;
  }
};

export const setJson = async (key, value, ttlSeconds) => {
  if (!redisClient) return false;
  try {
    const data = JSON.stringify(value);
    if (ttlSeconds) {
      await redisClient.set(key, data, 'EX', ttlSeconds);
    } else {
      await redisClient.set(key, data);
    }
    return true;
  } catch (err) {
    logger.warn({ errCode: err.code, key }, 'Redis setJson failed');
    return false;
  }
};


export const getInt = async (key) => {
  if (!redisClient) return null;
  try {
    const data = await redisClient.get(key);
    return data !== null ? parseInt(data, 10) : null;
  } catch (err) {
    logger.warn({ errCode: err?.code, key }, 'Redis getInt failed');
    return null;
  }
};

export const setInt = async (key, value, ttlSeconds) => {
  if (!redisClient) return false;
  try {
    if (ttlSeconds) {
      await redisClient.set(key, value.toString(), 'EX', ttlSeconds);
    } else {
      await redisClient.set(key, value.toString());
    }
    return true;
  } catch (err) {
    logger.warn({ errCode: err?.code, key }, 'Redis setInt failed');
    return false;
  }
};

export const incrIfExists = async (key) => {
  if (!redisClient) return false;
  try {
    // Only increment if it already exists, to avoid caching a false '1' when actual unread is higher
    const exists = await redisClient.exists(key);
    if (exists) {
      await redisClient.incr(key);
      return true;
    }
    return false;
  } catch (err) {
    logger.warn({ errCode: err?.code, key }, 'Redis incrIfExists failed');
    return false;
  }
};

export const del = async (key) => {
  if (!redisClient) return false;
  try {
    await redisClient.del(key);
    return true;
  } catch (err) {
    logger.warn({ errCode: err.code, key }, 'Redis del failed');
    return false;
  }
};

export const checkHealth = async () => {
  if (!redisClient) return 'disabled';
  try {
    await redisClient.ping();
    return 'up';
  } catch {
    return 'down';
  }
};

export const closeRedis = async () => {
  if (redisClient) await redisClient.quit();
  if (redisPubClient) await redisPubClient.quit();
  if (redisSubClient) await redisSubClient.quit();
};

export const getClient = () => redisClient;
export const getPubClient = () => redisPubClient;
export const getSubClient = () => redisSubClient;
