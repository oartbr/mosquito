const mqtt = require('mqtt');
const logger = require('../config/logger');
const config = require('../config/config');

let client;
const statusCache = new Map();

const normalizePrefix = (prefix) => {
  if (!prefix) return '';
  return prefix.endsWith('/') ? prefix : `${prefix}/`;
};

const buildUrl = () => {
  if (config.mqtt.url) {
    return config.mqtt.url;
  }
  const host = config.mqtt.host || 'localhost';
  const port = config.mqtt.port || 1883;
  return `mqtt://${host}:${port}`;
};

const getDoorIdFromTopic = (topic) => {
  const prefix = normalizePrefix(config.mqtt.topicPrefix);
  const trimmed =
    prefix && topic.startsWith(prefix) ? topic.slice(prefix.length) : topic;
  const [doorId, channel] = trimmed.split('/');
  if (!doorId || channel !== 'status') {
    return null;
  }
  return doorId;
};

const parsePayload = (payload) => {
  const text = payload ? payload.toString('utf8') : '';
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    return { raw: text };
  }
};

const subscribeStatusTopics = () => {
  if (!client) return;
  const prefix = normalizePrefix(config.mqtt.topicPrefix);
  const topics =
    config.mqtt.doorIds && config.mqtt.doorIds.length
      ? config.mqtt.doorIds.map((doorId) => `${prefix}${doorId}/status`)
      : [`${prefix}+/status`];

  client.subscribe(topics, { qos: config.mqtt.qos }, (error) => {
    if (error) {
      logger.error(`MQTT subscribe failed: ${error.message}`);
      return;
    }
    logger.info(`MQTT subscribed: ${topics.join(', ')}`);
  });
};

const connectClient = () => {
  if (client) return client;
  const url = buildUrl();
  const options = {
    username: config.mqtt.username,
    password: config.mqtt.password,
    clientId: config.mqtt.clientId,
    clean: true,
    reconnectPeriod: 1000,
  };

  client = mqtt.connect(url, options);

  client.on('connect', () => {
    logger.info(`MQTT connected: ${url}`);
    subscribeStatusTopics();
  });

  client.on('message', (topic, payload) => {
    const doorId = getDoorIdFromTopic(topic);
    if (!doorId) return;
    const data = {
      doorId,
      topic,
      receivedAt: new Date().toISOString(),
      payload: parsePayload(payload),
    };
    statusCache.set(doorId, data);
  });

  client.on('reconnect', () => logger.info('MQTT reconnecting'));
  client.on('error', (error) => logger.error(`MQTT error: ${error.message}`));

  return client;
};

const getClient = () => {
  if (!client) {
    return connectClient();
  }
  return client;
};

const publishCommand = (doorId, action, requestId) => {
  const prefix = normalizePrefix(config.mqtt.topicPrefix);
  const topic = `${prefix}${doorId}/command`;
  const payload = JSON.stringify({ action, requestId });
  const mqttClient = getClient();

  return new Promise((resolve, reject) => {
    mqttClient.publish(topic, payload, { qos: config.mqtt.qos }, (error) => {
      if (error) {
        return reject(error);
      }
      return resolve({ topic, payload });
    });
  });
};

const getDoorStatus = (doorId) => {
  return statusCache.get(doorId) || null;
};

const setDoorStatus = (doorId, payload, source = 'manual') => {
  const prefix = normalizePrefix(config.mqtt.topicPrefix);
  const topic = `${prefix}${doorId}/status`;
  const data = {
    doorId,
    topic,
    receivedAt: new Date().toISOString(),
    payload,
    source,
  };
  statusCache.set(doorId, data);
  return data;
};

const listDoorIds = () => {
  if (config.mqtt.doorIds && config.mqtt.doorIds.length) {
    return config.mqtt.doorIds;
  }
  return Array.from(statusCache.keys());
};

const closeClient = () => {
  if (client) {
    client.end(true);
    client = null;
  }
};

module.exports = {
  getClient,
  publishCommand,
  getDoorStatus,
  setDoorStatus,
  listDoorIds,
  closeClient,
};
