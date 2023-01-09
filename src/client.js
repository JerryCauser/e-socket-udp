import { UDPClient as BasicUDPClient } from 'socket-udp'
import { generateId, setChunkMetaInfo, ID_SIZE } from './identifier.js'
import { IV_SIZE, DEFAULT_ENCRYPT_FUNCTION } from './constants.js'

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

  /** @type {[Buffer, BufferEncoding][]} */
  #interruptedData = []

  #sendInterrupted = () => {
    let i
    for (i = 0; i < this.#interruptedData.length; ++i) {
      super.write(
        this.#interruptedData[i][0],
        this.#interruptedData[i][1]
      )

      if (this.allowWrite === false) break
    }

    this.#interruptedData.splice(0, i + 1)

    if (this.#interruptedData.length > 0) {
      this.once('_drain:internal', this.#sendInterrupted)
    } else if (this.allowWrite) {
      super.emit('drain')
    }
  }

  emit () {
    if (arguments[0] === 'drain' && this.#interruptedData.length > 0) {
      return super.emit('_drain:internal')
    }

    return super.emit.apply(this, arguments)
  }

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
          DEFAULT_ENCRYPT_FUNCTION(this.#encryptionSecret, data)
      } else if (encryption instanceof Function) {
        this.#encryptionFunction = encryption
      }

      if (this.#encryptionFunction instanceof Function) {
        this.#encryptionEnabled = true
      }
    }
  }

  write (buffer, encoding, cb) {
    if (this.#fragmentation) {
      this.#sendInFragments(buffer, generateId(), encoding, cb)
    } else {
      if (this.#encryptionEnabled) {
        super.write(
          this.#encryptionFunction(buffer),
          encoding,
          cb
        )
      } else {
        super.write(buffer, encoding, cb)
      }
    }

    if (this.allowWrite === false && this.#interruptedData.length > 0) {
      this.once('_drain:internal', this.#sendInterrupted)
    }

    return this.allowWrite
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

    const createFragmentCallbackPromise = (fragment) => {
      return new Promise((resolve, reject) => {
        super.write(fragment, encoding, (err) => {
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

      if (this.allowWrite) {
        if (callbackExists) {
          promises.push(createFragmentCallbackPromise(fragment))
        } else {
          super.write(fragment, encoding)
        }
      } else {
        this.#interruptedData.push([fragment, encoding])
      }
    }

    if (callbackExists) {
      Promise.all(promises)
        .then(() => callback())
        .catch(callback)
    }

    return this.allowWrite
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
