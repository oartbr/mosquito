const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const { closeClient, getClient } = require('./utils/mqttClient');

let server;

const startServer = () => {
  server = app.listen(config.port, () => {
    logger.info(`Listening to port ${config.port}`);
  });
};

try {
  getClient();
} catch (error) {
  logger.error(`MQTT client init failed: ${error.message}`);
}

startServer();

const exitHandler = () => {
  if (server) {
    server.close(() => {
      closeClient();
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    closeClient();
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close(() => closeClient());
  } else {
    closeClient();
  }
});
