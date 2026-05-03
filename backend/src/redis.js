const Redis = require('ioredis');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL;

const commandClient = new Redis(redisUrl);
const pubsubClient = new Redis(redisUrl);

commandClient.on('error', (err) => console.error('Redis Command Client Error', err));
pubsubClient.on('error', (err) => console.error('Redis PubSub Client Error', err));

module.exports = { commandClient, pubsubClient };
