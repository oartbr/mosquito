const Ably = require('ably');
const logger = require('../config/logger');
const config = require('../config/config');

let client;
let restClient;
const channels = new Map();
const statusCache = new Map();

const getChannelName = () => {
  return config.ably.channel || 'doors';
};

const ensureConfig = () => {
  if (!config.ably.apiKey) {
    throw new Error('Missing ABLY_API_KEY');
  }
  if (!config.ably.channel) {
    throw new Error('Missing ABLY_CHANNEL');
  }
};

const parsePayload = (payload) => {
  if (payload === null || payload === undefined) {
    return null;
  }
  if (typeof payload === 'string') {
    if (!payload) return null;
    try {
      return JSON.parse(payload);
    } catch (error) {
      return { raw: payload };
    }
  }
  return payload;
};

const parseStatusName = (name) => {
  if (!name) return null;
  const suffixMatch = /^(.+)(:|\/)status$/.exec(name);
  if (suffixMatch) return suffixMatch[1];
  const prefixMatch = /^status(:|\/)(.+)$/.exec(name);
  if (prefixMatch) return prefixMatch[2];
  return null;
};

const getDoorIdFromPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null;
  return (
    payload.doorId || payload.door_id || payload.id || payload.door || null
  );
};

const buildTopic = (channelName, name) => {
  if (!channelName) return name || '';
  if (!name) return channelName;
  return `${channelName}:${name}`;
};

const getDoorIdFromChannelName = (channelName) => {
  if (!channelName) return null;
  const base = getChannelName();
  if (channelName === base) return null;
  const prefixColon = `${base}:`;
  if (channelName.startsWith(prefixColon)) {
    return channelName.slice(prefixColon.length);
  }
  const prefixSlash = `${base}/`;
  if (channelName.startsWith(prefixSlash)) {
    return channelName.slice(prefixSlash.length);
  }
  return channelName;
};

const getDoorIdFromMessage = (channelName, message, payload) => {
  return (
    parseStatusName(message && message.name) ||
    getDoorIdFromPayload(payload) ||
    getDoorIdFromChannelName(channelName)
  );
};

const isLikelyStatusMessage = (message, payload) => {
  const name = message && message.name;
  if (name && /status/i.test(name)) return true;
  if (!payload || typeof payload !== 'object') return false;
  return (
    Object.prototype.hasOwnProperty.call(payload, 'status') ||
    Object.prototype.hasOwnProperty.call(payload, 'state')
  );
};

const setStatusCache = (channelName, message) => {
  const payload = parsePayload(message && message.data);
  const doorId = getDoorIdFromMessage(channelName, message, payload);
  if (!doorId) return;
  if (!isLikelyStatusMessage(message, payload)) return;
  const data = {
    doorId,
    topic: buildTopic(channelName, message && message.name),
    receivedAt: new Date().toISOString(),
    payload,
  };
  statusCache.set(doorId, data);
};

const subscribeStatusMessages = (ablyChannel, channelName) => {
  if (!ablyChannel) return;
  ablyChannel.subscribe((message) => {
    setStatusCache(channelName, message);
  });
};

const connectClient = () => {
  if (client) return client;
  ensureConfig();

  client = new Ably.Realtime({ key: config.ably.apiKey });

  client.connection.on('connected', () => {
    logger.info(`Ably connected: ${getChannelName()}`);
    initializeChannels();
  });

  client.connection.on('disconnected', () => {
    logger.warn('Ably disconnected');
  });

  client.connection.on('failed', (stateChange) => {
    logger.error(`Ably connection failed: ${stateChange.reason}`);
  });

  return client;
};

const getRestClient = () => {
  if (!restClient) {
    ensureConfig();
    restClient = new Ably.Rest({ key: config.ably.apiKey });
  }
  return restClient;
};

const getChannel = () => {
  if (!client) {
    connectClient();
  }
  return getOrCreateChannel(getChannelName());
};

const getOrCreateChannel = (channelName) => {
  if (!client) {
    connectClient();
  }
  if (channels.has(channelName)) {
    return channels.get(channelName);
  }
  const ablyChannel = client.channels.get(channelName);
  channels.set(channelName, ablyChannel);
  return ablyChannel;
};

const collectChannelNames = () => {
  const base = getChannelName();
  const names = new Set();
  names.add(base);
  if (config.ably.doorIds && config.ably.doorIds.length) {
    config.ably.doorIds.forEach((doorId) => {
      names.add(doorId);
      names.add(`${base}:${doorId}`);
      names.add(`${base}/${doorId}`);
    });
  }
  return Array.from(names);
};

const attachChannel = (ablyChannel) => {
  return new Promise((resolve, reject) => {
    if (ablyChannel.state === 'attached') {
      return resolve();
    }
    ablyChannel.attach((error) => {
      if (error) {
        return reject(error);
      }
      return resolve();
    });
  });
};

const seedChannelStatus = async (ablyChannel, channelName) => {
  try {
    const rest = getRestClient();
    const restChannel = rest.channels.get(channelName);
    const page = await restChannel.history({
      limit: 5,
      direction: 'backwards',
    });
    if (!page || !page.items || !page.items.length) {
      return;
    }
    page.items.some((message) => {
      const payload = parsePayload(message && message.data);
      if (!isLikelyStatusMessage(message, payload)) {
        return false;
      }
      setStatusCache(channelName, message);
      return true;
    });
  } catch (error) {
    // ignore history errors
  }
};

const initializeChannels = () => {
  const channelNames = collectChannelNames();
  channelNames.forEach((channelName) => {
    const ablyChannel = getOrCreateChannel(channelName);
    attachChannel(ablyChannel)
      .then(() => {
        subscribeStatusMessages(ablyChannel, channelName);
        return seedChannelStatus(ablyChannel, channelName);
      })
      .catch((error) => {
        logger.error(
          `Ably channel init failed (${channelName}): ${error.message}`,
        );
      });
  });
};

const publishWithTimeout = (ablyChannel, name, payload, timeoutMs = 5000) => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Ably publish timeout'));
    }, timeoutMs);
    ablyChannel.publish(name, payload, (error) => {
      clearTimeout(timer);
      if (error) {
        return reject(error);
      }
      return resolve();
    });
  });
};

const publishCommand = async (doorId, action, requestId) => {
  const name = `${doorId}:command`;
  const payload = { action, requestId };
  const ablyChannel = getChannel();
  await attachChannel(ablyChannel);
  const rest = getRestClient();
  const restChannel = rest.channels.get(getChannelName());
  await restChannel.publish(name, payload);
  return { topic: buildTopic(getChannelName(), name), payload };
};

const getLastStatus = async (doorId) => {
  const base = getChannelName();
  const candidates = [`${base}:${doorId}`, `${base}/${doorId}`, base, doorId];

  for (const channelName of candidates) {
    const ablyChannel = getOrCreateChannel(channelName);
    try {
      await attachChannel(ablyChannel);
      await seedChannelStatus(ablyChannel, channelName);
      const cached = statusCache.get(doorId);
      if (cached) {
        return cached;
      }
    } catch (error) {
      logger.error(`Ably history failed (${channelName}): ${error.message}`);
    }
  }

  return null;
};

const getDoorStatus = (doorId) => {
  return statusCache.get(doorId) || null;
};

const setDoorStatus = (doorId, payload, source = 'manual') => {
  const name = `${doorId}:status`;
  const data = {
    doorId,
    topic: buildTopic(name),
    receivedAt: new Date().toISOString(),
    payload,
    source,
  };
  statusCache.set(doorId, data);
  return data;
};

const listDoorIds = () => {
  if (config.ably.doorIds && config.ably.doorIds.length) {
    return config.ably.doorIds;
  }
  return Array.from(statusCache.keys());
};

const closeClient = () => {
  if (client) {
    channels.clear();
    client.close();
    client = null;
  }
  restClient = null;
};

module.exports = {
  getChannel,
  publishCommand,
  getLastStatus,
  getDoorStatus,
  setDoorStatus,
  listDoorIds,
  closeClient,
};
