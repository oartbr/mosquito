const express = require('express');
const doorRoute = require('./door.route');
const config = require('../../config/config');
const logger = require('../../config/logger');

const router = express.Router();

const defaultRoutes = [
  {
    path: '/doors',
    route: doorRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

logger.info(`starting router in ${config.env} mode`);

module.exports = router;
