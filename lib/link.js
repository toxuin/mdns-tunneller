const config = require('config');
const Primus = require('primus');

const server = async () => {
  const link = Primus.createServer({
    port: config.port,
    transformer: 'websockets',
    parser: 'json',
    iknowhttpsisbetter: 'true',
  });

  link.on('connection', (conn) => {
    console.log(`Client connected: ${conn.address.ip}:${conn.address.port}`);
  });

  console.log(`Started server on port ${config.port}`);

  link.isServer = true;

  return link;
};

const client = async () => {
  const remoteAddress = `http://${config.remote || process.env.REMOTE}:${config.port}`;
  console.log(`Connecting to ${remoteAddress}...`);

  const Socket = Primus.createSocket({
    transformer: 'websockets',
    parser: 'json',
  });
  const link = new Socket(remoteAddress);

  link.on('reconnected', (opts) => {
    console.log(`Reconnected! It took ${opts.duration} ms to reconnect`);
  });

  await new Promise((resolve) => {
    link.on('open', () => {
      console.log(`Connected to the remote: ${remoteAddress}`);
      return resolve();
    });
  });

  link.isServer = false;

  return link;
};

const makeLink = async () => {
  if (!config.remote) return server();
  return client();
};

module.exports = makeLink;
