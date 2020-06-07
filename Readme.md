# mDNS Tunneller

![license: CC-BY-NC-SA-4.0](https://img.shields.io/github/license/toxuin/mdns-tunneller) ![docker pulls](https://img.shields.io/docker/pulls/toxuin/mdns-tunneller)

⚠️ Warning: you can do serious damage to the network(s) you are running this in. Use this only as a last resort measure, when you have absolutely exhausted all other options. Try [avahi-reflector](https://linux.die.net/man/5/avahi-daemon.conf) and [mdns-repeater](https://bitbucket.org/geekman/mdns-repeater) first.

### What does it do

It creates a 1:1 pipe tunnel over simple HTTP and passes all the mDNS requests and responses back and forth through it, essentially merging two separate multicast DNS domains. You can connect more than one client to the server (but *should* you?) - making one big multicast DNS domain. See how dangerous it is?!

### Features

  - Automatic reconnection upon connection loss
  - Basic firewall for DNS queries - only packets containing info about services from whitelist will travel through the tunnel
  - Built in multicast storm prevention - won't relay packets that already been relayed 

### But why?..

There are certain services that operate over mDNS and refuse to work altogether without it, but mDNS stands for "Multicast DNS" (duh) and multicast has many limitations - and for good reasons most of the time. And if you just need to re-transmit multicast packets from one network to another - avahi in reflector mode would fill your bill 100%, but if you need something more complex like multicasts through Wireguard in a separate heavily-firewalled VLAN over IP-over-Fiber-Channel over IP-over-Avian-Carriers - it's much easier to just establish a tunnel specifically for mDNS.

By using mDNS Tunneller you can expose your private details to somewhere they're not intended to go. mDNS in your typical home includes A LOT of information about what devices are online (who's home) and what are they doing. mDNS Tunneller has rudimentary built-in firewall that is supposed to mitigate that, but as of now it's very basic and does not offer sufficient personal data protection (no, seriously).

### Configuration files

Default configuration values are stored in `config/defaul.yml`, however it's not advised to edit this file directly as this will mark your git tree with uncommitted changes. Instead, create a `local.yml` file in `config` directory and set any values you want to override there.

#### Configuration with Environmental Variables

You can use environmental variables to override every configuration parameter from `config/default.yml`. Check out file `custom-environment-variables.yml` for the list of all names of environmental variables.

To specify arrays, provide them in yaml format:

```
SENDERS_BLACKLIST='[192.168.1.69, 192.168.10.11]'
```

### Installation

mDNS Tunneller requires Node.js 10+ and npm to be installed.

Both client and server will need to pull this repo and install all the dependencies:

```shell script
git pull https://github.com/toxuin/mdns-tunneller
npm install
```

Or, you can use Docker:

```shell script
docker run -v your_config_file.yml:/app/config/local.yml -p 42069:42069 toxuin/mdns-tunneller
```

Then, on the server adjust the interface to be listening at in `config/local.yml` (by default it listens on all interfaces, `0.0.0.0`):

```yaml
interface: 192.168.1.69
``` 

Start the server with 

```shell script
npm run start
```

On the client you have to set where to connect to (otherwise it will start as another server - and that would be dumb) in `config/local.yml`:

```yaml
remote: 192.168.1.69
```

Start the client with
 
```shell script
npm run start
```

### Upgrading

Just do a `git pull` on the directory you've cloned this project into.

mDNS Tunneller is beta quality software - please don't use for any critical systems (unless in the events of a zombie apocalypse - then all bets are off, of course).

Because it is beta quality software - there are no guarantees that API/configuration structure will remain compatible across versions (it probably won't), so read the changelogs before updating.
