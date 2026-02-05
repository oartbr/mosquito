const winston = require('winston');

const env = process.env.NODE_ENV || 'development';

const enumerateErrorFormat = winston.format((info) => {
  if (info instanceof Error) {
    Object.assign(info, { message: info.stack });
  }
  return info;
});

let logger;
if (env === 'test') {
  logger = {
    error: () => {},
    warn: () => {},
    info: () => {},
    http: () => {},
    verbose: () => {},
    debug: () => {},
    silly: () => {},
  };
} else {
  const transports = [
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ];

  logger = winston.createLogger({
    level: env === 'development' ? 'debug' : 'info',
    format: winston.format.combine(
      enumerateErrorFormat(),
      env === 'development'
        ? winston.format.colorize()
        : winston.format.uncolorize(),
      winston.format.splat(),
      winston.format.printf(({ level, message }) => `${level}: ${message}`),
    ),
    transports,
  });
}

module.exports = logger;
