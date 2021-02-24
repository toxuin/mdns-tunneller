import config from 'config';
import Primus from 'primus';
import * as http from 'http';
import Debug from 'debug';

const debug = Debug('mdns:link');

export abstract class Link<T> {
  public readonly isServer: boolean;
  protected messageHandlers: ((message: T) => {})[];

  protected constructor(isServer: boolean) {
    this.isServer = isServer;
    this.messageHandlers = [];
  }

  public abstract isConnected(): boolean;
  public abstract write(data: T): void;

  public addMessageHandler(messageHandler: (message: T) => {}): void {
    this.messageHandlers.push(messageHandler);
  }
}

export class Server<T> extends Link<T> {
  private transport: Primus;
  private readonly httpServer: http.Server;

  constructor() {
    super(true);

    this.httpServer = http.createServer().listen(config.get('port'), config.get('interface'));
    this.transport = new Primus(this.httpServer, {
      transformer: 'websockets',
      parser: 'json',
      iknowhttpsisbetter: true,
    } as any);

    this.transport.on('connection', (conn) => {
      console.log(`Client connected: ${conn.address.ip}:${conn.address.port}`);
      conn.on('data', (message) => {
        // TODO: ADD PACKET VALIDATOR?
        debug(`GOT DATA FROM CLIENT ${conn.address.ip}:${conn.address.port}`);
        this.messageHandlers.forEach((messageHandler) => {
          messageHandler(message as T);
        });
      });
    });

    console.log(`Started server on ${config.get('interface')}:${config.get('port')}`);
  }

  isConnected(): boolean {
    return !!this.transport.connected;
  }

  write(data: T): void {
    if (!this.isConnected()) return;
    return this.transport.write(data);
  }
}

export class Client<T> extends Link<T> {
  private transport: Primus.Socket;
  private isSocketConnected: boolean;

  constructor() {
    super(false);
    this.isSocketConnected = false;

    const remoteAddress = `http://${config.get('remote')}:${config.get('port')}`;
    console.log(`Connecting to ${remoteAddress}...`);

    const PrimusSocket = Primus.createSocket({
      transformer: 'websockets',
      parser: 'json',
    });
    this.transport = new PrimusSocket(remoteAddress, {
      reconnect: {
        max: 5000,
        factor: 1.1,
        retries: Infinity,
      },
    });

    this.transport.on('reconnected', (opts) => {
      console.log(`Reconnected! It took ${opts.duration} ms to reconnect`);
      this.isSocketConnected = true;
    });

    this.transport.on('end', () => {
      debug(`CLIENT TRANSPORT CLOSED!`);
      this.isSocketConnected = false;
    });

    this.transport.on('open', () => {
      this.isSocketConnected = true;
      console.log(`Connected to the remote: ${remoteAddress}`);
    });

    this.transport.on('data', (data) => {
      // TODO: ADD PACKET VALIDATOR?
      debug(`GOT MESSAGE FROM SERVER`);
      this.messageHandlers.forEach((messageHandler) => {
        messageHandler(data as T);
      });
    });

    this.transport.on('error', (err) => {
      debug('TRANSPORT ERROR OCCURRED');
      console.error(err);
    })
  }

  isConnected(): boolean {
    return this.isSocketConnected;
  }

  write(data: T): void {
    this.transport.write(data);
  }
}

export default function makeLink<T>(): Link<T> {
  debug(`CREATING LINK AS ${config.has('remote') ? 'CLIENT' : 'SERVER'}...`);
  return config.has('remote') ? new Client<T>() : new Server<T>();
}
