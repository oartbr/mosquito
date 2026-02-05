const { v4: uuidv4 } = require('uuid');
const {
  publishCommand,
  getDoorStatus,
  listDoorIds,
  setDoorStatus,
  getLastStatus,
} = require('../utils/ablyClient');

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
  const cached = getDoorStatus(doorId);
  if (cached) return cached;
  return getLastStatus(doorId);
};

const listDoors = async () => {
  const ids = listDoorIds();
  const statuses = await Promise.all(
    ids.map(async (doorId) => {
      const cached = getDoorStatus(doorId);
      return cached || (await getLastStatus(doorId));
    }),
  );

  return ids.map((doorId, index) => ({
    doorId,
    status: statuses[index] || null,
  }));
};

module.exports = {
  openDoor,
  closeDoor,
  getDoorStatus: getDoorStatusById,
  listDoors,
};
