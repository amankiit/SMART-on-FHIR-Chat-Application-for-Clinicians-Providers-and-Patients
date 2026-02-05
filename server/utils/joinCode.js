const crypto = require('crypto');

function generateJoinCode() {
  const num = crypto.randomInt(100000, 999999);
  return String(num);
}

module.exports = { generateJoinCode };
