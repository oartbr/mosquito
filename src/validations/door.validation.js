const Joi = require('joi');

const commandDoor = {
  params: Joi.object().keys({
    doorId: Joi.string().trim().required(),
  }),
};

const getStatus = {
  params: Joi.object().keys({
    doorId: Joi.string().trim().required(),
  }),
};

module.exports = {
  commandDoor,
  getStatus,
};
