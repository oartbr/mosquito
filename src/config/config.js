const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');
const logger = require('./logger');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string()
      .valid('production', 'development', 'test')
      .required(),
    PORT: Joi.number().default(3000),
    CORS_ORIGIN: Joi.string().allow(''),
    CORS_STATUS: Joi.number().default(204),
    MQTT_URL: Joi.string()
      .optional()
      .description('Full MQTT URL (overrides host/port)'),
    MQTT_HOST: Joi.string().optional().description('MQTT host'),
    MQTT_PORT: Joi.number().optional().description('MQTT port'),
    MQTT_USERNAME: Joi.string().optional().description('MQTT username'),
    MQTT_PASSWORD: Joi.string().optional().description('MQTT password'),
    MQTT_CLIENT_ID: Joi.string().optional().description('MQTT client ID'),
    MQTT_TOPIC_PREFIX: Joi.string()
      .default('doors/')
      .description('Topic prefix (include trailing /)'),
    MQTT_QOS: Joi.number().integer().min(0).max(2).default(0),
    MQTT_DOOR_IDS: Joi.string()
      .optional()
      .description('Comma-separated door IDs'),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

logger.info(`NODE_ENV: ${envVars.NODE_ENV}`);

const doorIds = (envVars.MQTT_DOOR_IDS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  cors: {
    origin: envVars.CORS_ORIGIN,
    status: envVars.CORS_STATUS,
  },
  mqtt: {
    url: envVars.MQTT_URL,
    host: envVars.MQTT_HOST,
    port: envVars.MQTT_PORT,
    username: envVars.MQTT_USERNAME,
    password: envVars.MQTT_PASSWORD,
    clientId: envVars.MQTT_CLIENT_ID,
    topicPrefix: envVars.MQTT_TOPIC_PREFIX,
    qos: envVars.MQTT_QOS,
    doorIds,
  },
};
