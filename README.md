# Enriched UDP Socket and Client 
[![npm](https://img.shields.io/npm/v/e-socket-udp)](https://www.npmjs.com/package/e-socket-udp)
[![tests](https://github.com/JerryCauser/e-socket-udp/actions/workflows/tests.yml/badge.svg)](https://github.com/JerryCauser/e-socket-udp/actions/workflows/tests.yml)
[![CodeQL](https://github.com/JerryCauser/e-socket-udp/actions/workflows/codeql.yml/badge.svg)](https://github.com/JerryCauser/e-socket-udp/actions/workflows/codeql.yml)
[![CodeFactor Grade](https://img.shields.io/codefactor/grade/github/JerryCauser/e-socket-udp/master)](https://www.codefactor.io/repository/github/jerrycauser/e-socket-udp)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![node-current](https://img.shields.io/node/v/e-socket-udp)](https://nodejs.org)
[![GitHub](https://img.shields.io/github/license/JerryCauser/e-socket-udp)](https://github.com/JerryCauser/e-socket-udp/blob/master/LICENSE)

Enriched UDP Socket and Client with possibility to encrypt data and send big messages.

- Fast — small overhead above UDP to send messages
- Secure — built-in encryption for sensitive logs
- Universal – built-in fragmentation to send big messages
- Simple — used well-known Node streams to manipulate and move data 
- ESM and CJS

## Install

```bash
npm i --save e-socket-udp
```

## Fast Start

```javascript
//client.js
import { UDPClient } from 'e-socket-udp'

const secret = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'
const client = new UDPClient({ encryption: secret })

client.write(Buffer.from('Hello, World!', 'utf8'))
```

```javascript
//server.js
import { UDPSocket } from 'e-socket-udp'

const secret = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'
const socket = new UDPSocket({ decryption: secret })

for await (const message of socket) {
  console.log(message)
}
```

After just start the server  `node server.js` and client `node app.js`. That's all and everything works.

## Documentation

### class `UDPClient`
Extends [Basic UDPClient][basic-udp-client].

#### Arguments:
- `options` `<object>` – optional
  - `type` `<'udp4' | 'udp6'>` – optional. _Inherited_. **Default** `'udp4'`
  - `port` `<string | number>` – optional. _Inherited_. **Default** `44302`
  - `address` `<string>` – optional. _Inherited_. **Default** `'127.0.0.1'` or `'::1'`
  - `encryption` `<string> | <(payload: Buffer) => Buffer>` – optional. **Default** `undefined`
    - if passed `string` - will be applied `aes-256-ctr` encryption with passed string as a secret, so it should be `64char` long;
    - if passed `function` - this function will be used to encrypt every message;
    - if passed `undefined` - will not use any kind of encryption.
  - `fragmentation` `<boolean>` – optional. Automatically split each message into chunks. Useful with any size of messages (especially big ones). **Default** `true`  
  - `packetSize` `<number>` – optional. Used if `fragmentation = true`. Number of bytes in each packet (chunk). **Default** `1280`

#### Methods:
- `write (buffer)`: `<boolean>` — _Inherited_.

#### Fields:
- `origin`: [`<dgram.Socket>`][node-dgram-socket] — _Inherited_.
- `port`: `<number>` — _Inherited_.
- `address`: `<string>` — _Inherited_.
- `family`: `<string>` — _Inherited_.

#### Events:
- `'ready'`: `<void>` – _Inherited_. Emitted when the client "establishes" udp connection.

#### Usage
##### Simple example with encryption
```javascript
import { UDPClient } from 'e-socket-udp'

const client = new UDPClient({
  port: 44302,
  // encryption: (buf) => buf.map(byte => byte ^ 83)
  encryption: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'
})

client.write(Buffer.from('Hello, world!', 'utf8'))
```

---

### class `UDPSocket`
Extends [Basic UDPSocket][basic-udp-socket]

It is a UDP socket in `readable stream` form with encoding and possibility to handle big messages.

#### Arguments:
- `options` `<object>` – **required**
  - `type` `<'udp4' | 'udp6'>` – optional. _Inherited_. **Default** `'udp4'`
  - `port` `<string | number>` – optional. _Inherited_. **Default** `44302`
  - `host` `<string>` – optional. _Inherited_. **Default** `'127.0.0.1'` or `'::1'`
  - `decryption` `<string> | <(payload: Buffer) => Buffer>` – optional. **Default** `undefined`
    - if passed `string` - will be applied `aes-256-ctr` decryption with passed string as a secret, so it should be `64char` long;
    - if passed `function` - will be used that function to decrypt every message;
    - if passed `undefined` - will not use any kind of decryption.
  - `fragmentation` `<boolean>` – optional. Combine chunks into message. Useful with any size of messages (especially big ones). **Default** `true`
  - `gcIntervalTime` `<number>` — optional. How often instance will check internal buffer to delete expired messages (in ms). **Default** `5000` 
  - `gcExpirationTime` `<number>`— optional. How long chunks can await all missing chunks in internal buffer (in ms). **Default** `10000`

#### Fields:
- `origin`: [`<dgram.Socket>`][node-dgram-socket] — _Inherited_.
- `port`: `<number>` — _Inherited_.
- `address`: `<string>` — _Inherited_.
- `family`: `<string>` — _Inherited_.
- `allowPush`: `<boolean>` — _Inherited_.

#### Events:
All `Readable` events of course and:

##### Event: `'ready'` — _Inherited_.
Emitted when socket started and ready to receive data.

##### Event: `'warning'`
Emitted when warning occurs.
 - `message` `<object | Error>`
   - `type` `<Symbol>`
   - `id` `<string>` – optional
   - `date` `<Date>` – optional

A type might be:
   - `Symbol<'missing_message'>` – when some messages didn't receive all chunks and got expired.
   - `Symbol<'decryption_message'>` – when some messages failed to be compiled from chunks.

#### Usage
##### Example how to use pure socket as async generator
```javascript
import { UDPSocket } from 'e-socket-udp'

const socket = new UDPsocket({
  port: 44302,
  // decryption: (buf) => buf.map(byte => byte ^ 83) // not safe at all, but better than nothing
  decryption: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'
})

for await (const message of socket) {
  /*handle messages*/
}
```

##### Example how to use socket and fs write stream
```javascript
import fs from 'node:fs'
import { UDPSocket } from 'e-socket-udp'

const secret = '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff'

const writer = fs.createWriteStream('/some/path')
const socket = new UDPSocket({ port: 44302, decryption: secret })

socket.pipe(writer)
```

---


### Additional Exposed variables and functions
#### constant `DEFAULT_PORT`
- `<number>` : `44302`

#### constant `WARNING_MISSING_MESSAGE`
- `<Symbol>` : `Symbol<'missing_message'>`

#### constant `WARNING_DECRYPTION_FAIL`
- `<Symbol>` : `Symbol<'decryption_fail'>`
---

There are `_identifier` and `_constants` exposed also, but they are used for internal needs. They could be removed in next releases, so it is not recommended to use it in your project.  

---

License ([MIT](LICENSE))

[basic-udp-client]: https://github.com/JerryCauser/socket-udp#class-udpclient
[basic-udp-socket]: https://github.com/JerryCauser/socket-udp#class-udpsocket
[node-readable]: https://nodejs.org/api/stream.html#class-streamreadable
[node-writable]: https://nodejs.org/api/stream.html#class-streamwritable
[node-dgram-socket]: https://nodejs.org/api/dgram.html#class-dgramsocket
[client]: #class-udpclient
[socket]: #class-udpsocket
[constants]: src/constants.js
[socket-event-warning]: #event-warning
