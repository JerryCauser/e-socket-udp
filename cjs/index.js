var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.js
var e_udp_socket_exports = {};
__export(e_udp_socket_exports, {
  DEFAULT_PORT: () => DEFAULT_PORT,
  UDPClient: () => client_default,
  UDPSocket: () => socket_default,
  WARNING_DECRYPTION_FAIL: () => WARNING_DECRYPTION_FAIL,
  WARNING_MISSING_MESSAGE: () => WARNING_MISSING_MESSAGE,
  _constants: () => constants_exports,
  _identifier: () => identifier_exports
});
module.exports = __toCommonJS(e_udp_socket_exports);

// src/socket.js
var import_socket_udp = require("socket-udp");

// src/collector.js
var import_node_events = __toESM(require("node:events"), 1);

// src/constants.js
var constants_exports = {};
__export(constants_exports, {
  DEFAULT_DECRYPT_FUNCTION: () => DEFAULT_DECRYPT_FUNCTION,
  DEFAULT_ENCRYPT_FUNCTION: () => DEFAULT_ENCRYPT_FUNCTION,
  DEFAULT_PORT: () => DEFAULT_PORT,
  IV_SIZE: () => IV_SIZE,
  WARNING_DECRYPTION_FAIL: () => WARNING_DECRYPTION_FAIL,
  WARNING_MISSING_MESSAGE: () => WARNING_MISSING_MESSAGE
});
var import_node_crypto = __toESM(require("node:crypto"), 1);
var DEFAULT_PORT = 44302;
var IV_SIZE = 16;
var DEFAULT_ENCRYPTION = "aes-256-ctr";
var DEFAULT_ENCRYPT_FUNCTION = (secret, payload) => {
  const iv = import_node_crypto.default.randomBytes(IV_SIZE).subarray(0, IV_SIZE);
  const cipher = import_node_crypto.default.createCipheriv(DEFAULT_ENCRYPTION, secret, iv);
  const beginChunk = cipher.update(payload);
  const finalChunk = cipher.final();
  return Buffer.concat(
    [iv, beginChunk, finalChunk],
    IV_SIZE + beginChunk.length + finalChunk.length
  );
};
var DEFAULT_DECRYPT_FUNCTION = (secret, buffer) => {
  const iv = buffer.subarray(0, IV_SIZE);
  const payload = buffer.subarray(IV_SIZE);
  const decipher = import_node_crypto.default.createDecipheriv(DEFAULT_ENCRYPTION, secret, iv);
  const beginChunk = decipher.update(payload);
  const finalChunk = decipher.final();
  return Buffer.concat(
    [beginChunk, finalChunk],
    beginChunk.length + finalChunk.length
  );
};
var WARNING_MISSING_MESSAGE = Symbol("missing_message");
var WARNING_DECRYPTION_FAIL = Symbol("decryption_fail");

// src/collector.js
var Collector = class extends import_node_events.default {
  #collector = /* @__PURE__ */ new Map();
  #gcIntervalId;
  #gcIntervalTime;
  #gcExpirationTime;
  #gcFunction = () => {
    const dateNow = Date.now();
    for (const [id, payload] of this.#collector) {
      if (payload[1] + this.#gcExpirationTime < dateNow) {
        this.#collector.delete(id);
        this.emit("warning", {
          type: WARNING_MISSING_MESSAGE,
          id,
          date: payload[2]
        });
      }
    }
  };
  constructor({
    gcIntervalTime = 5e3,
    gcExpirationTime = 1e4,
    ...eventEmitterOptions
  }) {
    super(eventEmitterOptions);
    this.#gcIntervalTime = gcIntervalTime;
    this.#gcExpirationTime = gcExpirationTime;
  }
  start() {
    this.#collector.clear();
    this.#gcIntervalId = setInterval(this.#gcFunction, this.#gcIntervalTime);
  }
  stop() {
    clearInterval(this.#gcIntervalId);
    this.#collector.clear();
  }
  set(id, payload) {
    return this.#collector.set(id, payload);
  }
  get(id) {
    return this.#collector.get(id);
  }
  delete(id) {
    return this.#collector.delete(id);
  }
};
var collector_default = Collector;

// src/identifier.js
var identifier_exports = {};
__export(identifier_exports, {
  COUNTER_INDEX_SIZE: () => COUNTER_INDEX_SIZE,
  COUNTER_TOTAL_SIZE: () => COUNTER_TOTAL_SIZE,
  DATE_SIZE: () => DATE_SIZE,
  ID_SIZE: () => ID_SIZE,
  INCREMENTAL_SIZE: () => INCREMENTAL_SIZE,
  RANDOM_SIZE: () => RANDOM_SIZE,
  SEED_N_TOTAL_OFFSET: () => SEED_N_TOTAL_OFFSET,
  SEED_SIZE: () => SEED_SIZE,
  TIME_META_SIZE: () => TIME_META_SIZE,
  generateId: () => generateId,
  parseId: () => parseId,
  setChunkMetaInfo: () => setChunkMetaInfo
});
var import_node_crypto2 = __toESM(require("node:crypto"), 1);
var DATE_SIZE = 6;
var INCREMENTAL_SIZE = 4;
var INCREMENTAL_EDGE = Buffer.alloc(INCREMENTAL_SIZE).fill(255).readUIntBE(0, INCREMENTAL_SIZE);
var TIME_META_SIZE = DATE_SIZE + INCREMENTAL_SIZE;
var RANDOM_SIZE = 6;
var SEED_SIZE = TIME_META_SIZE + RANDOM_SIZE;
var COUNTER_TOTAL_SIZE = 3;
var COUNTER_INDEX_SIZE = 3;
var CHUNK_META_SIZE = COUNTER_TOTAL_SIZE + COUNTER_INDEX_SIZE;
var ID_SIZE = SEED_SIZE + CHUNK_META_SIZE;
var CACHE_SIZE = 2048 * RANDOM_SIZE;
var CACHE_BUFFER = Buffer.alloc(CACHE_SIZE);
var incrementId = 0;
var cacheOffset = 0;
function refreshCache() {
  cacheOffset = 0;
  import_node_crypto2.default.randomFillSync(CACHE_BUFFER, 0, CACHE_SIZE);
}
refreshCache();
function generateId() {
  if (cacheOffset >= CACHE_SIZE)
    refreshCache();
  const id = Buffer.alloc(ID_SIZE);
  id.set(
    [
      CACHE_BUFFER[cacheOffset],
      CACHE_BUFFER[cacheOffset + 1],
      CACHE_BUFFER[cacheOffset + 2],
      CACHE_BUFFER[cacheOffset + 3],
      CACHE_BUFFER[cacheOffset + 4],
      CACHE_BUFFER[cacheOffset + 5]
    ],
    TIME_META_SIZE
  );
  cacheOffset += RANDOM_SIZE;
  incrementId = ++incrementId & INCREMENTAL_EDGE;
  id.writeUIntBE(Date.now(), 0, DATE_SIZE);
  id.writeUIntBE(incrementId, DATE_SIZE, INCREMENTAL_SIZE);
  return id;
}
var SEED_N_TOTAL_OFFSET = SEED_SIZE + COUNTER_TOTAL_SIZE;
function setChunkMetaInfo(id, total, index) {
  id.writeUIntBE(total, SEED_SIZE, COUNTER_TOTAL_SIZE);
  id.writeUIntBE(index, SEED_N_TOTAL_OFFSET, COUNTER_INDEX_SIZE);
}
function parseId(buffer) {
  if (buffer.length !== ID_SIZE)
    throw new Error("id_size_not_valid");
  const date = new Date(buffer.readUintBE(0, DATE_SIZE));
  const id = buffer.subarray(0, SEED_SIZE);
  const total = buffer.readUintBE(SEED_SIZE, COUNTER_TOTAL_SIZE);
  const index = buffer.readUintBE(SEED_N_TOTAL_OFFSET, COUNTER_INDEX_SIZE);
  return [date, id, total, index];
}

// src/socket.js
var UDPSocketPlus = class extends import_socket_udp.UDPSocket {
  #decryptionFunction;
  #decryptionSecret;
  #decryptionEnabled = false;
  #fragmentation = true;
  #collector;
  #collectorWarningHandler = (message) => this.emit("warning", message);
  constructor({
    decryption,
    fragmentation = true,
    gcIntervalTime = 5e3,
    gcExpirationTime = 1e4,
    ...udpSocketOptions
  } = {}) {
    super(udpSocketOptions);
    this.#collector = new collector_default({ gcIntervalTime, gcExpirationTime });
    this.#fragmentation = fragmentation;
    if (decryption) {
      if (typeof decryption === "string") {
        this.#decryptionSecret = Buffer.from(decryption, "hex");
        this.#decryptionFunction = (data) => DEFAULT_DECRYPT_FUNCTION(this.#decryptionSecret, data);
      } else if (decryption instanceof Function) {
        this.#decryptionFunction = decryption;
      }
      if (this.#decryptionFunction instanceof Function) {
        this.#decryptionEnabled = true;
      }
    }
  }
  _construct(callback) {
    var _a, _b, _c, _d;
    (_b = (_a = this.#collector).start) == null ? void 0 : _b.call(_a);
    (_d = (_c = this.#collector).on) == null ? void 0 : _d.call(_c, "warning", this.#collectorWarningHandler);
    super._construct(callback);
  }
  _destroy(error, callback) {
    var _a, _b, _c, _d;
    super._destroy(error, callback);
    (_b = (_a = this.#collector).off) == null ? void 0 : _b.call(_a, "warning", this.#collectorWarningHandler);
    (_d = (_c = this.#collector).stop) == null ? void 0 : _d.call(_c);
  }
  handleMessage(body, head) {
    if (this.#decryptionEnabled) {
      try {
        body = this.#decryptionFunction(body);
        head.originSize = head.size;
      } catch (e) {
        this.emit("warning", { type: WARNING_DECRYPTION_FAIL });
      }
    }
    if (this.#fragmentation !== true) {
      head.size = body.byteLength;
      return super.handleMessage(body, head);
    }
    const [date, idBuffer, total, index] = parseId(body.subarray(0, ID_SIZE));
    const id = idBuffer.toString("hex");
    let data = this.#collector.get(id);
    if (!data) {
      data = [/* @__PURE__ */ new Map(), Date.now(), date, id, 0];
      this.#collector.set(id, data);
    }
    data[0].set(index, body.subarray(ID_SIZE));
    if (this.#decryptionEnabled) {
      data[4] += head.originSize;
    } else {
      data[4] += body.byteLength;
    }
    if (data[0].size === total + 1) {
      this.#collector.delete(id);
      const compiledBody = this.#compileMessage(data[0]);
      head.originSize = data[4];
      head.size = compiledBody.length;
      head.id = id;
      head.sentDate = date;
      return super.handleMessage(compiledBody, head);
    }
    return this.allowPush;
  }
  #compileMessage(body) {
    let bodyBuffered;
    if (body.size > 1) {
      const chunkSize = body.get(0).byteLength;
      const size = chunkSize * (body.size - 1) + body.get(body.size - 1).byteLength;
      bodyBuffered = Buffer.alloc(size);
      for (const entry of body) {
        bodyBuffered.set(entry[1], chunkSize * entry[0]);
      }
    } else {
      bodyBuffered = body.get(0);
    }
    return bodyBuffered;
  }
};
var socket_default = UDPSocketPlus;

// src/client.js
var import_socket_udp2 = require("socket-udp");
var UDPClientPlus = class extends import_socket_udp2.UDPClient {
  #fragmentation = true;
  #packetSize;
  #encryptionEnabled = false;
  #encryptionFunction;
  #encryptionSecret;
  constructor({
    encryption,
    fragmentation = true,
    packetSize = 1280,
    ...udpClientOptions
  } = {}) {
    super(udpClientOptions);
    this.#packetSize = packetSize - ID_SIZE;
    this.#fragmentation = fragmentation;
    if (encryption) {
      if (typeof encryption === "string") {
        this.#packetSize = packetSize - IV_SIZE;
        this.#encryptionSecret = Buffer.from(encryption, "hex");
        this.#encryptionFunction = (data) => DEFAULT_ENCRYPT_FUNCTION(this.#encryptionSecret, data);
      } else if (encryption instanceof Function) {
        this.#encryptionFunction = encryption;
      }
      if (this.#encryptionFunction instanceof Function) {
        this.#encryptionEnabled = true;
      }
    }
  }
  write(buffer, encoding, cb) {
    if (this.#fragmentation) {
      return this.#sendInFragments(buffer, generateId(), encoding, cb);
    } else {
      if (this.#encryptionEnabled) {
        return super.write(this.#encryptionFunction(buffer), encoding, cb);
      } else {
        return super.write(buffer, encoding, cb);
      }
    }
  }
  #sendInFragments(payload, id, encoding, callback) {
    const total = Math.ceil(payload.length / this.#packetSize) - 1;
    const promises = [];
    const callbackExists = callback instanceof Function;
    let allowWrite = true;
    const createFragmentCallbackPromise = (fragment) => {
      return new Promise((resolve, reject) => {
        allowWrite = super.write(fragment, encoding, (err) => {
          if (err)
            reject(err);
          resolve();
        });
      });
    };
    for (let i = 0; i < payload.length; i += this.#packetSize) {
      let fragment = this.#markFragment(
        id,
        total,
        i / this.#packetSize,
        payload.subarray(i, i + this.#packetSize)
      );
      if (this.#encryptionEnabled) {
        fragment = this.#encryptionFunction(fragment);
      }
      if (allowWrite) {
        if (callbackExists) {
          promises.push(createFragmentCallbackPromise(fragment));
        } else {
          allowWrite = super.write(fragment, encoding);
        }
      } else {
        break;
      }
    }
    if (callbackExists) {
      Promise.all(promises).then(() => callback()).catch(callback);
    }
    return allowWrite;
  }
  #markFragment(id, total, index, chunk) {
    const resultChunk = Buffer.alloc(chunk.length + ID_SIZE);
    resultChunk.set(id, 0);
    setChunkMetaInfo(resultChunk, total, index);
    resultChunk.set(chunk, ID_SIZE);
    return resultChunk;
  }
};
var client_default = UDPClientPlus;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  DEFAULT_PORT,
  UDPClient,
  UDPSocket,
  WARNING_DECRYPTION_FAIL,
  WARNING_MISSING_MESSAGE,
  _constants,
  _identifier
});
