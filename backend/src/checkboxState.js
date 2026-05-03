const { commandClient } = require('./redis');

const CHECKBOX_KEY = 'checkboxes';

async function setCheckbox(index, value) {
  return await commandClient.bitfield(CHECKBOX_KEY, 'SET', 'u1', index, value);
}

async function getCheckbox(index) {
  const result = await commandClient.bitfield(CHECKBOX_KEY, 'GET', 'u1', index);
  return result[0];
}

async function getFullStateBuffer() {
  let buffer = await commandClient.getBuffer(CHECKBOX_KEY);
  if (!buffer) {
    buffer = Buffer.alloc(Math.ceil(parseInt(process.env.TOTAL_CHECKBOXES || '1000000') / 8));
  }
  return buffer;
}

module.exports = {
  setCheckbox,
  getCheckbox,
  getFullStateBuffer
};
