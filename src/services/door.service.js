const { v4: uuidv4 } = require('uuid');
const {
  publishCommand,
  getDoorStatus,
  listDoorIds,
  setDoorStatus,
} = require('../utils/mqttClient');

const buildCommandResponse = (doorId, action, requestId, topic) => {
  return {
    doorId,
    action,
    requestId,
    topic,
  };
};

const sendCommand = async (doorId, action) => {
  const requestId = uuidv4();
  const { topic } = await publishCommand(doorId, action, requestId);
  setDoorStatus(doorId, { state: action }, 'manual');
  return buildCommandResponse(doorId, action, requestId, topic);
};

const openDoor = async (doorId) => {
  return sendCommand(doorId, 'open');
};

const closeDoor = async (doorId) => {
  return sendCommand(doorId, 'close');
};

const getDoorStatusById = async (doorId) => {
  return getDoorStatus(doorId);
};

const listDoors = async () => {
  const ids = listDoorIds();
  return ids.map((doorId) => ({
    doorId,
    status: getDoorStatus(doorId),
  }));
};

module.exports = {
  openDoor,
  closeDoor,
  getDoorStatus: getDoorStatusById,
  listDoors,
};
