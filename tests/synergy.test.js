import assert from 'node:assert'
import crypto from 'node:crypto'
import { once } from 'node:events'
import { Readable, Writable } from 'node:stream'
import { tryCountErrorHook, assertTry, checkResults } from './_main.js'

/**
 * [x] emulate fast writing
 * [x] emulate slow writing
 */

const TIMEOUT_SYMBOL = Symbol('timeout')
const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms, TIMEOUT_SYMBOL))

/**
 *
 * @param {UDPSocket} UDPSocket
 * @param {UDPClient} UDPClient
 * @returns {Promise<number>}
 */
async function synergyTest (UDPSocket, UDPClient) {
  const alias = '  synergy.js: '

  const DEFAULT_PORT = 45007
  const PACKET_SIZE = 540
  const PAYLOAD_SIZE = 2 ** 17

  const createReader = ({ data, fast }) => {
    const reader = new Readable({
      read (size) {
        reader.readyToRead = true
      }
    })

    const interval = fast ? 1 : 10

    reader.startReading = async () => {
      while (true) {
        if (reader.readyToRead === true) break
        await delay(5)
      }

      while (data.length !== 0) {
        const chunkSize = Math.min(data.length, Math.round(PACKET_SIZE / 2 + Math.random() * 4 * PACKET_SIZE))
        const chunk = data.subarray(0, chunkSize)
        data = data.subarray(chunkSize)

        reader.push(chunk)

        await delay(interval)
      }

      await delay(5)
    }

    return reader
  }

  const createWriter = () => {
    const writer = new Writable({
      write (chunk, encoding, callback) {
        writer.result.push(chunk)
        callback()
      }
    })

    writer.result = []

    return writer
  }

  function checkOnlyMessage ({ caseAlias, message, results, payload }) {
    assertTry(
      () =>
        assert.deepStrictEqual(
          message,
          payload,
          `${caseAlias} received message should be the same as sent one`
        ),
      results
    )
  }

  async function testSynergy (port) {
    const caseAlias = `${alias} sending messages ->`
    const results = { fails: [] }

    const writer = createWriter()
    const client = new UDPClient({ port, packetSize: PACKET_SIZE })
    const socket = new UDPSocket({ port })

    socket.pipe(writer)

    const slowPayload = crypto.randomBytes(PAYLOAD_SIZE)
    const slowReader = createReader({ data: slowPayload, fast: false })

    slowReader.pipe(client)
    await slowReader.startReading()

    const slowMessage = Buffer.concat(writer.result)

    checkOnlyMessage({
      caseAlias,
      message: slowMessage,
      results,
      payload: slowPayload
    })

    writer.result.length = 0

    const fastPayload = crypto.randomBytes(PAYLOAD_SIZE)
    const fastReader = createReader({ data: fastPayload, fast: true })

    fastReader.pipe(client)
    await fastReader.startReading()

    const fastMessage = Buffer.concat(writer.result)

    checkOnlyMessage({
      caseAlias,
      message: fastMessage,
      results,
      payload: fastPayload
    })

    socket.destroy()
    client.destroy()

    await Promise.all([once(socket, 'close'), once(client, 'close')])

    checkResults(results, caseAlias)
  }

  const errors = tryCountErrorHook()

  await errors.try(() => testSynergy(DEFAULT_PORT))

  if (errors.count === 0) {
    console.log('[synergy.js] All test for passed\n')
  } else {
    console.log(`[synergy.js] Has ${errors.count} errors`)
  }

  return errors.count
}

export default synergyTest
