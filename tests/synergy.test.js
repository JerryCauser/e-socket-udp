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

  let defaultPort = 45007
  const GET_PORT = () => ++defaultPort
  const PACKET_SIZE = 508

  const createReader = ({ data, fast }) => {
    const reader = new Readable({
      read (size) {
        if (process.env.NODE_ENV === 'git') {
          delay(5).then(() => reader.emit('readyToRead'))
        } else {
          reader.emit('readyToRead')
        }
      }
    })

    reader.pushedSize = 0

    const sliceMethod = typeof data === 'string' ? 'slice' : 'subarray'

    reader.startReading = async () => {
      while (data.length !== 0) {
        const chunkSize = Math.min(
          data.length,
          Math.round(PACKET_SIZE / 2 + Math.random() * 20 * PACKET_SIZE)
        )

        const chunk = data[sliceMethod](0, chunkSize)

        const pushResult = reader.push(chunk)

        data = data[sliceMethod](chunkSize)

        reader.pushedSize += chunk.length

        if (pushResult === false && data.length > 0) {
          await once(reader, 'readyToRead')
        }

        if (!fast) await delay(10)
      }

      await delay(100)
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

  async function testSynergy (port, fast, payloadSize) {
    const caseAlias = `${alias} sending messages fast=${
      fast ? 1 : 0
    }, payloadSize=${payloadSize} ->`
    const results = { fails: [] }

    const writer = createWriter()
    const client = new UDPClient({ port, packetSize: PACKET_SIZE })
    const socket = new UDPSocket({ port })

    socket.pipe(writer)

    const payload = crypto.randomBytes(payloadSize)
    const reader = createReader({ data: payload, fast })

    reader.pipe(client)
    await reader.startReading()

    const message = Buffer.concat(writer.result)

    checkOnlyMessage({
      caseAlias,
      message,
      results,
      payload
    })

    console.log({
      payload: payload.length,
      message: message.length,
      pushed: reader.pushedSize
    })

    socket.destroy()
    client.destroy()

    await Promise.all([once(socket, 'close'), once(client, 'close')])

    checkResults(results, caseAlias)
  }

  const errors = tryCountErrorHook()

  console.log(process.env.NODE_ENV)

  await errors.try(() => testSynergy(GET_PORT(), false, 2 ** 8))
  await errors.try(() => testSynergy(GET_PORT(), false, 2 ** 15))
  await errors.try(() => testSynergy(GET_PORT(), false, 2 ** 17)) // 128kb
  await errors.try(() => testSynergy(GET_PORT(), true, 2 ** 8))
  await errors.try(() => testSynergy(GET_PORT(), true, 2 ** 15))
  await errors.try(() => testSynergy(GET_PORT(), true, 2 ** 17)) // 128kb
  await errors.try(() => testSynergy(GET_PORT(), true, 2 ** 20)) // 1mb
  await errors.try(() => testSynergy(GET_PORT(), true, 2 ** 24)) // 16mb

  if (errors.count === 0) {
    console.log('[synergy.js] All test for passed\n')
  } else {
    console.log(`[synergy.js] Has ${errors.count} errors`)
  }

  return errors.count
}

export default synergyTest
