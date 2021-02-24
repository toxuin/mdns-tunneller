import config from 'config';
import {
  EndpointInfo,
  MDNSServer,
  MDNSServerOptions,
  PacketHandler
} from '@homebridge/ciao/lib/MDNSServer';
import { DNSPacket } from '@homebridge/ciao/lib/coder/DNSPacket';

export class MdnsServer {
  private server: MDNSServer;
  private started: boolean = false;

  constructor(handler: PacketHandler) {
    const options: MDNSServerOptions = {
      disableIpv6: !config.get<boolean>('enableIpv6'),
    };

    if (config.has('mdnsInterfaces')) {
      options.interface = config.get<string | string[]>('mdnsInterfaces');
    }

    const handlers: PacketHandler = {
      handleQuery(packet: DNSPacket, rinfo: EndpointInfo) {
        // TODO: ADD FILTER LOGIC?
        handler.handleQuery(packet, rinfo);
      },
      handleResponse(packet: DNSPacket, rinfo: EndpointInfo) {
        // TODO: ADD FILTER LOGIC?
        handler.handleResponse(packet, rinfo);
      }
    }

    this.server = new MDNSServer(handlers, options);
  }

  public async start() {
    await this.server.bind();
    this.started = true;
  }

  public async send(packet: DNSPacket): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const interfaceName of this.server.getBoundInterfaceNames()) {
      const promise = new Promise<void>((resolve, reject) => {
        this.server.send(packet, interfaceName)
          .then((result) => {
            if (result.status === 'fulfilled') resolve();
            else reject(result.reason);
          });
      });
      promises.push(promise);
    }

    await Promise.all(promises);
  }

  // THIS METHOD IS FARCE, DON'T RELY ON IT
  public getInterfaceFamily(address: string): 'IPv4' | 'IPv6' {
    // THIS IS USED TO CONVERT ADDRESS TO EITHER IPv4 OR IPv6 TO SATISFY DNSPacket IN @ciao
    // THING IS, THE family PARAMETER IS NOT USED AT ALL IN IT
    // AND THE WHOLE AddressInfo IS REQUIRED TO JUST DISPLAY AN ERROR.
    // SO HERE IT IS, REALLY CRAPPY WAY OF DETERMINING ADDRESS'S FAMILY
    const IPv4 = 'IPv4';
    const IPv6 = 'IPv6';

    if (address.includes(':')) {
      return (address.includes('.')) ? IPv4 : IPv6;
    }
    return IPv4;
  }
}

