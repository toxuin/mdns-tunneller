import { AddressInfo } from 'net';
import Debug from 'debug';
import { DNSPacket, PacketType } from '@homebridge/ciao/lib/coder/DNSPacket';
import { EndpointInfo } from '@homebridge/ciao/lib/MDNSServer';
import BJSON from 'buffer-json';
import { MdnsServer } from './lib/mdns-server';
import { Firewall, MDNSMessageType } from './lib/firewall';
import makeLink from './lib/link';

const debug = Debug('mdns');

type MdnsLinkPacket = {
  peerInfo: AddressInfo,
  data: string, // JSON REPRESENTATION OF BUFFER WITH RAW DNS PACKET
};

const link = makeLink<MdnsLinkPacket>();

const linkMessageHandler = async (message: MdnsLinkPacket): Promise<void> => {
  const { peerInfo, data } = message;
  let packet: DNSPacket | null = null;
  try {
    packet = DNSPacket.decode(peerInfo, BJSON.parse(data));
  } catch (err) {
    console.error(err);
  }
  if (!packet) {
    debug(`COULD NOT DECODE DATA FROM ${peerInfo.address}`);
    return;
  }

  debug(`BROADCASTING LINK PACKET FROM ${peerInfo.address}`);
  await mdns.send(packet);
};

link.addMessageHandler(linkMessageHandler);

const firewall = new Firewall();

const doRelay = (type: MDNSMessageType) => (packet: DNSPacket, endpointInfo: EndpointInfo): void => {
  (async () => { // ASYNC CONTEXT, SYNC HANDLER4
    // DROP PACKETS THAT ARE NOT ALLOWED BY FW
    if (!firewall.isAllowed(type, packet, endpointInfo)) return;

    const transformedPacket = await firewall.transform(packet);
    if (!transformedPacket) return; // NOTHING LEFT OF PACKET

    // DON'T RELAY IF NO ONE IS CONNECTED
    if (link.isServer && !link.isConnected()) return;

    const peerInfo: AddressInfo = {
      address: endpointInfo.address,
      port: endpointInfo.port,
      family: mdns.getInterfaceFamily(endpointInfo.address),
    }

    const linkMessage: MdnsLinkPacket = {
      peerInfo,
      data: BJSON.stringify(transformedPacket.encode()),
    };

    debug('RELAYING %s FROM LOCAL (%s): \
        { questions: %d, answers: %d, authorities: %d, additionals: %d }',
      packet.type === PacketType.QUERY ? 'QUERY' : 'RESPONSE',
      endpointInfo.address,
      (packet.questions || []).size,
      (packet.answers || []).size,
      (packet.authorities || []).size,
      (packet.additionals || []).size,
    );
    link.write(linkMessage);
  })();
}

const mdns = new MdnsServer({
  handleQuery: doRelay(MDNSMessageType.query),
  handleResponse: doRelay(MDNSMessageType.response),
});
mdns.start();
