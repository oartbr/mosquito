const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const {
  openDoor,
  closeDoor,
  getDoorStatus,
  listDoors,
} = require('../services/door.service');
const ApiError = require('../utils/ApiError');

const openDoorHandler = catchAsync(async (req, res) => {
  const result = await openDoor(req.params.doorId);
  res.status(httpStatus.OK).json(result);
});

const closeDoorHandler = catchAsync(async (req, res) => {
  const result = await closeDoor(req.params.doorId);
  res.status(httpStatus.OK).json(result);
});

const getStatusHandler = catchAsync(async (req, res) => {
  const status = await getDoorStatus(req.params.doorId);
  if (!status) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Door status not found');
  }
  res.status(httpStatus.OK).json(status);
});

const listDoorsHandler = catchAsync(async (req, res) => {
  const doors = await listDoors();
  res.status(httpStatus.OK).json({ doors });
});

module.exports = {
  openDoor: openDoorHandler,
  closeDoor: closeDoorHandler,
  getStatus: getStatusHandler,
  listDoors: listDoorsHandler,
};
