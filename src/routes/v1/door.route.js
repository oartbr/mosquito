const express = require('express');
const validate = require('../../middlewares/validate');
const doorValidation = require('../../validations/door.validation');
const doorController = require('../../controllers/door.controller');

const router = express.Router();

router.get('/', doorController.listDoors);
router.get(
  '/:doorId/status',
  validate(doorValidation.getStatus),
  doorController.getStatus,
);
router.post(
  '/:doorId/open',
  validate(doorValidation.commandDoor),
  doorController.openDoor,
);
router.post(
  '/:doorId/close',
  validate(doorValidation.commandDoor),
  doorController.closeDoor,
);

module.exports = router;
