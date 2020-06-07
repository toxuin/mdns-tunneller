const _ = require('lodash');
const config = require('config');
const debug = require('debug')('mdns-firewall');

// CONVERTS { type: 'Buffer' data: [45,234,11,...]} to 'hi#=fart'
const bufferLikeToString = (bufferLike) => {
  if (!bufferLike.type || !bufferLike.data) return bufferLike; // RETURN AS IS
  if (bufferLike.type !== 'Buffer') return bufferLike;
  if (!Array.isArray(bufferLike.data)) return bufferLike;
  return Buffer.from(bufferLike.data).toString('utf8')
};

const deepBufferLikeToString = (orig) => {
  // ONLY OBJ & ARRAYS NEED TO BE TOUCHED - IN JS BOTH ARE 'object'
  if (typeof orig !== 'object') return orig;
  if (Buffer.isBuffer(orig)) return Buffer.from(orig).toString('utf8');
  if (Array.isArray(orig)) return orig.map((item) => deepBufferLikeToString(item));

  // AT THIS POINT ORIG IS OBJECT

  const maybeString = bufferLikeToString(orig);
  if (typeof maybeString === 'string') return maybeString;

  return Object.keys(orig).reduce((accum, key) => {
    const value = orig[key];
    if (typeof value !== 'object') accum[key] = value;
    else {
      const maybeStringValue = bufferLikeToString(value);
      if (typeof maybeStringValue === 'string') accum[key] = maybeStringValue;
      else accum[key] = deepBufferLikeToString(value);
    }
    return accum;
  }, {});
};

const transform = async (packet) => {
  const modifiedPacket = deepBufferLikeToString(packet);
  if (!modifiedPacket) return modifiedPacket;
  const additionals = _.compact((modifiedPacket.additionals || []).map((additional) => {
    if (additional.name === '.') return null; // NO POINT IN TRANSMITTING INFO ABOUT SENDER, SENDER ON THE OTHER END IS THE RELAY
    return additional;
  }));
  const questions = modifiedPacket.questions || [];
  const answers = modifiedPacket.answers || [];
  const authorities = modifiedPacket.authorities || [];

  // ADD COOKIE TO AVOID DOUBLE-TRANSFORMING PACKETS
  if (!additionals.some((additional) => additional.type === 'TXT' && additional.name === 'RELAYED')) {
    additionals.push(
      {
        type: 'TXT',
        name: 'RELAYED',
        ttl: 120,
        data: '127.0.0.3',
        class: 'IN',
        flush: true,
      },
    );
  }

  return {
    questions,
    answers,
    additionals,
    authorities,
  };
};

// PACKET IS RAW HERE
const isAllowed = async (packet, peerInfo) => {
  if ((config.sendersBlacklist || []).includes(peerInfo.address)) return false;

  if (packet.additionals.some((additional) => additional.type === 'TXT' && additional.name === 'RELAYED')) {
    debug('DENY: PACKET ALREADY RELAYED');
    return false;
  }

  if (packet.questions.some(
    (question) => (config.serviceWhitelist || []).includes(question.name),
  )) {
    debug('PASS: QUESTION IN SERVICE WHITELIST');
    return true;
  }

  if (packet.answers.some(
    (answer) => (config.serviceWhitelist || []).includes(answer.name),
  )) {
    debug('PASS: ANSWER IN SERVICE WHITELIST');
    return true;
  }

  return false;
}

module.exports = {
  transform,
  isAllowed,
};
