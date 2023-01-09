import { UDPSocket as BasicUDPSocket } from 'socket-udp'
import Collector, { ArrayIndexed } from './collector.js'
import { ID_SIZE, parseId } from './identifier.js'
import {
  DEFAULT_DECRYPT_FUNCTION,
  WARNING_DECRYPTION_FAIL
} from './constants.js'

/**
 * @class
 * @param {UDPSocketOptions} [options={}]
 */
class UDPSocketPlus extends BasicUDPSocket {
  /** @type {undefined|function(Buffer): Buffer} */
  #decryptionFunction

  /** @type {undefined|Buffer} */
  #decryptionSecret

  /** @type {boolean} */
  #decryptionEnabled = false

  /** @type {boolean} */
  #fragmentation = true

  /** @type {CollectorInstance} */
  #collector

  /** @type {(WarningMessage) => boolean} */
  #collectorWarningHandler = (message) => this.emit('warning', message)

  /**
   * @param {UDPSocketOptions} [options]
   */
  constructor ({
    decryption,
    fragmentation = true,
    gcIntervalTime = 5000,
    gcExpirationTime = 10000,
    ...udpSocketOptions
  } = {}) {
    super(udpSocketOptions)

    this.#collector = new Collector({ gcIntervalTime, gcExpirationTime })
    this.#fragmentation = fragmentation

    if (decryption) {
      if (typeof decryption === 'string') {
        this.#decryptionSecret = Buffer.from(decryption, 'hex')

        this.#decryptionFunction = (data) =>
          DEFAULT_DECRYPT_FUNCTION(this.#decryptionSecret, data)
      } else if (decryption instanceof Function) {
        this.#decryptionFunction = decryption
      }

      if (this.#decryptionFunction instanceof Function) {
        this.#decryptionEnabled = true
      }
    }
  }

  _construct (callback) {
    this.#collector.start?.()
    this.#collector.on?.('warning', this.#collectorWarningHandler)

    super._construct(callback)
  }

  _destroy (error, callback) {
    super._destroy(error, callback)

    this.#collector.off?.('warning', this.#collectorWarningHandler)
    this.#collector.stop?.()
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
      } catch (e) {
        this.emit('warning', { type: WARNING_DECRYPTION_FAIL })
      }
    }

    if (this.#fragmentation !== true) {
      head.size = body.byteLength

      return super.handleMessage(body, head)
    }

    const [date, idBuffer, total, index] = parseId(body.subarray(0, ID_SIZE))
    const id = idBuffer.toString('hex')

    /** @type {CollectorElem} */
    let data = this.#collector.get(id)
    if (!data) {
      data = [new ArrayIndexed(total + 1), Date.now(), date, id, 0]
      this.#collector.set(id, data)
    }

    data[0].set(index, body.subarray(ID_SIZE))

    if (this.#decryptionEnabled) {
      data[4] += head.originSize
    } else {
      data[4] += body.byteLength
    }

    if (data[0].size === total + 1) {
      this.#collector.delete(id)
      const compiledBody = this.#compileMessage(data[0])
      head.originSize = data[4]
      head.size = compiledBody.length
      head.id = id
      head.sentDate = date

      return super.handleMessage(compiledBody, head)
    }

    return this.allowPush
  }

  /**
   * @param {ArrayIndexed<Buffer>} body
   * @return {Buffer}
   */
  #compileMessage (body) {
    let bodyBuffered

    if (body.length > 1) {
      bodyBuffered = Buffer.alloc(body.contentLength)

      for (let offset = 0, i = 0; i < body.length; ++i) {
        bodyBuffered.set(body[i], offset)
        offset += body[i].length
      }
    } else {
      bodyBuffered = body[0]
    }

    return bodyBuffered
  }
}

export default UDPSocketPlus
