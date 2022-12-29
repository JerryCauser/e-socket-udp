import { Buffer } from 'node:buffer'
import { UDPClient as BasicUDPClient } from 'socket-udp'
import { generateId, setChunkMetaInfo, ID_SIZE } from './identifier.js'
import { IV_SIZE, DEFAULT_ENCRYPT_FUNCTION } from './constants.js'

/**
 * @typedef {object} UDPClientOptions
 * @property {string} [type='udp4']
 * @property {number} [port=44002]
 * @property {string} [host=('127.0.0.1'|'::1')]
 * @property {string | ((payload: Buffer) => Buffer)} [encryption]
 *                    if passed string - will be applied aes-256-ctr encryption with passed string as secret;
 *                    if passed function - will be used that function to encrypt every message;
 * @property {boolean} [fragmentation=true] enables fragmentation.
 *                    Useful to transfer large messages in parallel without messing them up
 * @property {number} [packetSize=1280] in bytes. Used when fragmentation enabled
 */

/**
 * @param {UDPClientOptions} [options={}]
 * @constructor
 */
class UDPClientPlus extends BasicUDPClient {
  /** @type {boolean} */
  #fragmentation = true

  /** @type {number} */
  #packetSize

  /** @type {boolean} */
  #encryptionEnabled = false

  /** @type {(Buffer) => Buffer} */
  #encryptionFunction

  /** @type {Buffer} */
  #encryptionSecret

  /**
   * @param {UDPClientOptions} [options]
   */
  constructor ({
    encryption,
    fragmentation = true,
    packetSize = 1280,
    ...udpClientOptions
  } = {}) {
    super(udpClientOptions)

    this.#packetSize = packetSize - ID_SIZE // max 65507 - ID_SIZE
    this.#fragmentation = fragmentation

    if (encryption) {
      if (typeof encryption === 'string') {
        this.#packetSize = packetSize - IV_SIZE
        this.#encryptionSecret = Buffer.from(encryption, 'hex')

        this.#encryptionFunction = (data) =>
          DEFAULT_ENCRYPT_FUNCTION(data, this.#encryptionSecret)
      } else if (encryption instanceof Function) {
        this.#encryptionFunction = encryption
      }

      if (this.#encryptionFunction instanceof Function) {
        this.#encryptionEnabled = true
      }
    }
  }

  /**
   * @param {Buffer} buffer
   * @param {BufferEncoding} encoding
   * @param {function} cb
   * @returns {boolean}
   */
  write (buffer, encoding, cb) {
    if (this.#fragmentation) {
      return this.#sendInFragments(buffer, generateId(), encoding, cb)
    } else {
      if (this.#encryptionEnabled) {
        return super.write(this.#encryptionFunction(buffer), encoding, cb)
      } else {
        return super.write(buffer, encoding, cb)
      }
    }
  }

  /**
   * @param {Buffer} payload
   * @param {Buffer} id
   * @param {BufferEncoding} encoding
   * @param {function} callback
   * @returns {boolean}
   */
  #sendInFragments (payload, id, encoding, callback) {
    const total = Math.ceil(payload.length / this.#packetSize) - 1
    const promises = []
    const callbackExists = callback instanceof Function

    let allowWrite = true

    const createFragmentCallbackPromise = (fragment) => {
      return new Promise((resolve, reject) => {
        allowWrite = super.write(fragment, encoding, err => {
          if (err) reject(err)

          resolve()
        })
      })
    }

    for (let i = 0; i < payload.length; i += this.#packetSize) {
      let fragment = this.#markFragment(
        id,
        total,
        i / this.#packetSize,
        payload.subarray(i, i + this.#packetSize)
      )

      if (this.#encryptionEnabled) {
        fragment = this.#encryptionFunction(fragment)
      }

      if (allowWrite) {
        if (callbackExists) {
          promises.push(createFragmentCallbackPromise(fragment))
        } else {
          allowWrite = super.write(fragment, encoding)
        }
      } else {
        break
      }
    }

    if (callbackExists) {
      Promise.all(promises)
        .then(() => callback())
        .catch(callback)
    }

    return allowWrite
  }

  /**
   * @param {Buffer} id
   * @param {number} total
   * @param {number} index
   * @param {Buffer} chunk
   * @returns {Buffer}
   */
  #markFragment (id, total, index, chunk) {
    const resultChunk = Buffer.alloc(chunk.length + ID_SIZE)

    resultChunk.set(id, 0)
    setChunkMetaInfo(resultChunk, total, index)
    resultChunk.set(chunk, ID_SIZE)

    return resultChunk
  }
}

export default UDPClientPlus
