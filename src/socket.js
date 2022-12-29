import { Buffer } from 'node:buffer'
import { UDPSocket as BasicUDPSocket } from 'socket-udp'
import { ID_SIZE, parseId } from './identifier.js'
import { DEFAULT_DECRYPT_FUNCTION } from './constants.js'

/**
 * @typedef {object} UDPSocketOptions
 * @property {string} [type='udp4']
 * @property {number} [port=44002]
 * @property {string} [host=('127.0.0.1'|'::1')]
 * @property {string | ((payload: Buffer) => Buffer)} [decryption]
 *    if passed string - will be applied aes-256-ctr encryption with passed string as secret, so it should be 64char long;
 *    if passed function - will be used that function to encrypt every message;
 *    if passed undefined - will not use any kind of encryption
 * @property {number?} [fragmentation=true] enables fragmentation mode
 * @property {number?} [gcIntervalTime=5_000] how often instance will check internal buffer to delete expired messages
 * @property {number?} [gcExpirationTime=10_000] how long chunks can await all missing chunks in internal buffer
 *
 * @extends {ReadableOptions}
 */

/**
 * @class
 * @param {UDPSocketOptions} [options={}]
 */
class UDPSocketPlus extends BasicUDPSocket {
  /** @type {undefined|function(Buffer): Buffer} */
  #decryptionFunction

  /** @type {undefined|string} */
  #decryptionSecret

  /** @type {boolean} */
  #decryptionEnabled = false

  /** @type {Map<string, [logBodyMap:Map, lastUpdate:number, logDate:Date, logId:string]>} data */
  #collector = new Map()

  /** @type {number} */
  #gcIntervalId

  /** @type {boolean} */
  #fragmentation = true

  /** @type {number} */
  #gcIntervalTime

  /** @type {number} */
  #gcExpirationTime

  /**
   * @param {UdpSocketOptions} [options]
   */
  constructor ({
    decryption,
    fragmentation = true,
    gcIntervalTime = 5000,
    gcExpirationTime = 10000,
    ...udpSocketOptions
  } = {}) {
    super(udpSocketOptions)

    this.#gcIntervalTime = gcIntervalTime
    this.#gcExpirationTime = gcExpirationTime

    this.#fragmentation = fragmentation

    if (decryption) {
      if (typeof decryption === 'string') {
        this.#decryptionSecret = Buffer.from(decryption, 'hex')

        this.#decryptionFunction = (data) =>
          DEFAULT_DECRYPT_FUNCTION(data, this.#decryptionSecret)
      } else if (decryption instanceof Function) {
        this.#decryptionFunction = decryption
      }

      if (this.#decryptionFunction instanceof Function) {
        this.#decryptionEnabled = true
      }
    }
  }

  _construct (callback) {
    this.#collector.clear()
    this.#gcIntervalId = setInterval(this.#gcFunction, this.#gcIntervalTime)

    super._construct(callback)
  }

  _destroy (error, callback) {
    super._destroy(error, callback)

    clearInterval(this.#gcIntervalId)
    this.#collector.clear()
  }

  /**
   * @param {Buffer} body
   * @param {MessageHead} head
   */
  handleMessage (body, head) {
    if (this.#decryptionEnabled) {
      try {
        body = this.#decryptionFunction(body)
        head.originSize = head.size
        head.size = body.byteLength
      } catch (e) {
        this.emit('warning', { message: 'decryption_fail' })
      }
    }

    if (this.#fragmentation !== true) {
      return super.handleMessage(body, head)
    }

    const [date, id, total, index] = parseId(body.subarray(0, ID_SIZE))

    /** @type {[logBodyMap:Map, lastUpdate:number, logDate:Date, logId:string]} */
    let data = this.#collector.get(id)
    if (!data) {
      data = [new Map(), Date.now(), date, id]
      this.#collector.set(id, data)
    }

    data[0].set(index, body.subarray(ID_SIZE))

    if (data[0].size === total + 1) {
      this.#collector.delete(id)
      const compiledBody = this.#compileMessage(data[0], data[2], data[3])
      head.size = compiledBody.length

      return super.handleMessage(compiledBody, head)
    }

    return this.allowPush
  }

  #gcFunction = () => {
    const dateNow = Date.now()

    for (const [id, payload] of this.#collector) {
      if (payload[1] + this.#gcExpirationTime < dateNow) {
        this.#collector.delete(id)
        this.emit('warning', {
          message: 'missing_message',
          id,
          date: payload[2]
        })
      }
    }
  }

  /**
   * @param {Map<number, Buffer>} body
   * @param {Date|number} date
   * @param {string} id
   */
  #compileMessage (body, date, id) {
    let bodyBuffered

    if (body.size > 1) {
      const sortedBuffers = [...body.entries()]
        .sort((a, b) => a[0] - b[0])
        .map((n) => n[1])

      bodyBuffered = Buffer.concat(sortedBuffers)
    } else {
      bodyBuffered = [...body.values()][0]
    }

    const idAsBuffer = Buffer.from(id, 'hex')

    const result = Buffer.alloc(idAsBuffer.length + bodyBuffered.length)
    result.set(idAsBuffer, 0)
    result.set(bodyBuffered, idAsBuffer.length)

    return result
  }
}

export default UDPSocketPlus
