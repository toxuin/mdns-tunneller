import config from 'config';
import Debug from 'debug';
import _ from 'lodash';
import { DNSPacket, RType }  from '@homebridge/ciao/lib/coder/DNSPacket';
import { EndpointInfo } from '@homebridge/ciao/lib/MDNSServer';
import { TXTRecord } from '@homebridge/ciao/lib/coder/records/TXTRecord';
import { ResourceRecord } from '@homebridge/ciao/lib/coder/ResourceRecord';

const debug = Debug('mdns:firewall');
const BASE64_COOKIE_VALUE = `[${Buffer.from('RELAYED', 'utf8').toString('base64')}]`;

export enum MDNSMessageType {
  query = 'query',
  response = 'response',
}

export class Firewall {
  constructor() {
    debug('STARTING FIREWALL WITH CONFIG:');
    debug(`  SERVICE WHITELIST: ${config.get<string[]>('serviceWhitelist').join(', ')}`);
    debug(`  SENDER BLACKLIST: ${config.get<string[]>('sendersBlacklist').join(', ')}`);
  }

  private static packetHasCookie(packet: DNSPacket): boolean {
    const additionals = Array.from<ResourceRecord>(packet.additionals.values());
    return additionals.some((additional) => {
      if (additional.type !== RType.TXT) return false;
      if (additional.name !== 'RELAYED.') return false
      return (additional as TXTRecord).dataAsString() === BASE64_COOKIE_VALUE;
    });
  }

  public isAllowed(type: MDNSMessageType, packet: DNSPacket, endpointInfo: EndpointInfo): boolean {
    // CHECK IF SENDER IS BLACKLISTED
    if ((config.get<string[]>('sendersBlacklist')).includes(endpointInfo.address)) {
      debug(`DENY: SENDER ${endpointInfo.address} IS BLACKLISTED`);
      return false;
    }

    // CHECK IF ALREADY RELAYED
    if (Firewall.packetHasCookie(packet)) {
      debug('DENY: PACKET ALREADY RELAYED');
      return false;
    }

    // Q: SERVICE WHITELIST -> ALLOW
    if (Array.from(packet.questions.values()).some((question) => {
      const whitelistedServices = config.get<string[]>('serviceWhitelist');
      return whitelistedServices.some((serviceName) => {
        return question.name === serviceName
          || question.name === `${serviceName}.`
          || question.name.endsWith(`.${serviceName}`);
      });
    })) {
      debug('ALLOW: QUESTION IN SERVICE WHITELIST');
      return true;
    }

    // A: SERVICE WHITELIST -> ALLOW
    if (Array.from(packet.answers.values()).some((answer) => {
      const whitelistedServices = config.get<string[]>('serviceWhitelist');
      return whitelistedServices.some((serviceName) => {
        return answer.name === serviceName
          || answer.name === `${serviceName}.`
          || answer.name.endsWith(`.${serviceName}`);
      });
    })) {
      debug('ALLOW: ANSWER IN SERVICE WHITELIST');
      return true;
    }

    debug('DENY: DEFAULT DENY');
    return false;
  }

  public async transform(packet: DNSPacket): Promise<DNSPacket> {
    const resultPacket = new DNSPacket({ type: packet.type });

    // FILTER AND MERGE ADDITIONALS
    const additionals = _.compact((Array.from(packet.additionals.values()))
      .map((additional) => {
        if (additional.name === '.') return null; // NO POINT IN TRANSMITTING INFO ABOUT SENDER, SENDER ON THE OTHER END IS THE RELAY
        return additional;
      })
    );

    // ADD COOKIE TO AVOID DOUBLE-TRANSFORMING PACKETS
    if (Firewall.packetHasCookie(packet)) {
      return packet;
    } else {
      additionals.push(new TXTRecord('RELAYED', [Buffer.from('RELAYED')], true, 120));
    }

    resultPacket.addAdditionals(...additionals);

    // FILTER AND MERGE QUESTIONS
    const questions = _.compact(Array.from(packet.questions.values()))
      .map((question) => {
        // SET UNICAST RESPONSE BIT TO 0
        question.unicastResponseFlag = false;
        // TODO: FILTERING LOGIC HERE
        return question;
      });

    resultPacket.addQuestions(...questions);

    // FILTER AND MERGE ANSWERS
    const answers = _.compact(Array.from(packet.answers.values()))
      .map((answer) => {
        // TODO: FILTERING LOGIC HERE
        return answer;
      });

    resultPacket.addAnswers(...answers);

    const authorities = _.compact(Array.from(packet.authorities.values()))
      .map((authority) => {
        // TODO: FILTERING LOGIC HERE
        return authority;
      });

    resultPacket.addAuthorities(...authorities);

    return resultPacket;
  }
}
