const express = require('express');
const validate = require('../../middlewares/validate');
const doorValidation = require('../../validations/door.validation');
const doorAblyController = require('../../controllers/doorAbly.controller');

const router = express.Router();

router.get('/', doorAblyController.listDoors);
router.get(
  '/:doorId/status',
  validate(doorValidation.getStatus),
  doorAblyController.getStatus,
);
router.post(
  '/:doorId/open',
  validate(doorValidation.commandDoor),
  doorAblyController.openDoor,
);
router.post(
  '/:doorId/close',
  validate(doorValidation.commandDoor),
  doorAblyController.closeDoor,
);

module.exports = router;
