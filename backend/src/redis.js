const Redis = require('ioredis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL;

const commandClient = new Redis(redisUrl, {
  connectTimeout: 5000,
  commandTimeout: 5000,
  maxRetriesPerRequest: 1,
});

const pubsubClient = new Redis(redisUrl, {
  connectTimeout: 5000,
  commandTimeout: 5000,
  maxRetriesPerRequest: 1,
});

commandClient.on('error', (err) => console.error('Redis Command Client Error', err));
pubsubClient.on('error', (err) => console.error('Redis PubSub Client Error', err));

module.exports = { commandClient, pubsubClient };