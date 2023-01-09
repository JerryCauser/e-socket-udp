import EventEmitter from 'node:events'
import { WARNING_MISSING_MESSAGE } from './constants.js'

export class ArrayIndexed extends Array {
  size = 0
  contentLength = 0

  set (index, value) {
    if (value === undefined) return

    if (this[index] === undefined) {
      this[index] = value

      this.contentLength += value.length
      ++this.size
    }

    return this.size
  }

  clear () {
    this.length = 0
  }
}

class Collector extends EventEmitter {
  /** @type {CollectorMap} data */
  #collector = new Map()

  /** @type {number} */
  #gcIntervalId

  /** @type {number} */
  #gcIntervalTime

  /** @type {number} */
  #gcExpirationTime

  #gcFunction = () => {
    const dateNow = Date.now()

    for (const [id, payload] of this.#collector) {
      if (payload[1] + this.#gcExpirationTime < dateNow) {
        this.#collector.delete(id)

        this.emit('warning', {
          type: WARNING_MISSING_MESSAGE,
          id,
          date: payload[2]
        })
      }
    }
  }

  constructor ({
    gcIntervalTime = 5000,
    gcExpirationTime = 10000,
    ...eventEmitterOptions
  }) {
    super(eventEmitterOptions)
    this.#gcIntervalTime = gcIntervalTime
    this.#gcExpirationTime = gcExpirationTime
  }

  start () {
    this.#collector.clear()
    this.#gcIntervalId = setInterval(this.#gcFunction, this.#gcIntervalTime)
  }

  stop () {
    clearInterval(this.#gcIntervalId)
    this.#collector.clear()
  }

  /**
   * @param {string} id
   * @param {CollectorElem} payload
   * @return {Map<string, CollectorElem>}
   */
  set (id, payload) {
    return this.#collector.set(id, payload)
  }

  /**
   * @param {string} id
   * @return {CollectorElem}
   */
  get (id) {
    return this.#collector.get(id)
  }

  /**
   * @param {string} id
   * @return {boolean}
   */
  delete (id) {
    return this.#collector.delete(id)
  }
}

export default Collector
