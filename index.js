const config = require('config');
const debug = require('debug')('mdns-relay');
const mdns = require('multicast-dns')({
  loopback: config.enableLoopback,
  interface: config.interface,
});
const makeLink = require('./lib/link');
const firewall = require('./lib/firewall.js');

const run = async () => {
  const link = await makeLink();

  const doRelay = (type) => async (packet, peerInfo) => {
    let shouldRelay = await firewall.isAllowed(packet, peerInfo);
    if (!shouldRelay) return;
    const transformedPacket = await firewall.transform(packet);

    // DON'T RELAY IF NO ONE IS CONNECTED
    if (link.isServer && !link.connected) shouldRelay = false;

    const linkPacket = { peerInfo, data: transformedPacket, type };

    if (shouldRelay) {
      debug(```RELAYING ${packet.type} FROM LOCAL ${peerInfo.address}:
        { questions: ${packet.questions.length},
          answers: ${packet.answers.length},
          authorities: ${packet.authorities.length},
          additionals: ${packet.additionals.length},
        }```);
      link.write(linkPacket);
    }
  };

  mdns.on('response', doRelay('response'));
  mdns.on('query', doRelay('query'));

  const packetHandler = async (packet) => {
    const { peerInfo, data, type } = packet;

    if (type === 'response') {
      debug(`SENDING RELAYED RESPONSE FROM ${peerInfo.address}`);
      mdns.respond(data);
    } else if (type === 'query') {
      debug(`SENDING RELAYED QUERY FROM ${peerInfo.address}`);
      mdns.query(data);
    }
  };

  if (link.isServer) link.on('connection', (conn) => { conn.on('data', packetHandler); });
  else link.on('data', packetHandler);
};

run();
