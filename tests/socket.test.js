import dgram from 'node:dgram'
import assert from 'node:assert'
import crypto from 'node:crypto'
import { once } from 'node:events'
import { tryCountErrorHook, assertTry, checkResults } from './_main.js'

/**
 * Test fragmentation=false
 * [x] send message and receive it correctly
 *   [x] send second message and receive it correctly
 * [x] test with encryption 'string'
 * [x] test with encryption 'function'
 *
 * Testing fragmentation=true
 * [x] send message and receive it correctly
 *   [x] then send second message and receive it correctly
 * [x] send big message and receive it correctly
 *   [x] then send second big message and receive it correctly
 *   [x] then send third small message and receive it correctly
 * [x] send not all chunks. handle warning "missing"
 *   [x] then send one more message and everything is working
 * [x] test with encryption 'string'
 * [x] test with encryption 'function'
 */

const TIMEOUT_SYMBOL = Symbol('timeout')
const delay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms, TIMEOUT_SYMBOL))

/**
 * @returns {Promise<Socket & {stop: (() => Promise<void>)}>}
 */
const createUDPClient = async () => {
  const socket = Object.create(
    dgram.createSocket({ type: 'udp4', reuseAddr: true })
  )

  socket.stop = async () => {
    socket.removeAllListeners()
    socket.close()
    await once(socket, 'close')
  }

  return socket
}

/**
 *
 * @param {UDPSocket} UDPSocket
 * @param {object} identifier
 * @param {object} constants
 * @returns {Promise<number>}
 */
async function socketTest (UDPSocket, identifier, constants) {
  const alias = '  socket.js: '

  const { generateId, setChunkMetaInfo, ID_SIZE, DATE_SIZE } = identifier
  const { DEFAULT_ENCRYPT_FUNCTION, WARNING_MISSING_MESSAGE } = constants

  const DEFAULT_PORT = 45007
  const SMALL_PACKET_SIZE = 300
  const BIG_PACKET_SIZE = 500

  /**
   * @param {UDPSocketOptions} options
   * @returns {Promise<UDPSocket & {messages:Buffer[], stop: (() => Promise<void>)}>}
   */
  const createUDPSocket = async ({ port = DEFAULT_PORT, ...opts } = {}) => {
    const socket = new UDPSocket({ ...opts, port })

    const error = await Promise.race([
      once(socket, 'ready'),
      once(socket, 'error')
    ])

    /** @type {Buffer[]} */
    socket.messages = []

    socket.on('data', (buffer) => socket.messages.push(buffer))

    if (error instanceof Error) throw Error

    /** @type {(() => Promise<void>)} */
    socket.stop = async () => {
      socket.removeAllListeners()
      socket.destroy(null)
      await once(socket, 'close')
    }

    return socket
  }

  function checkMessage (caseAlias, message, results, payload) {
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

  async function testSocketSmall (fragmentation) {
    const caseAlias = `${alias} sending small message with fragmentation=${
      fragmentation ? 'true' : 'false'
    } ->`
    const results = { fails: [] }

    const client = await createUDPClient()
    const socket = await createUDPSocket({
      port: DEFAULT_PORT,
      fragmentation
    })

    let payloadOne, payloadTwo, chunkOne, chunkTwo

    if (fragmentation) {
      payloadOne = crypto.randomBytes(SMALL_PACKET_SIZE - ID_SIZE)
      payloadTwo = crypto.randomBytes(SMALL_PACKET_SIZE - ID_SIZE)

      const dateNowOne = Date.now()
      const dateNowTwo = Date.now()

      const payloadOneId = generateId()
      const payloadTwoId = generateId()

      payloadOneId.writeUintBE(dateNowOne, 0, DATE_SIZE)
      payloadTwoId.writeUintBE(dateNowTwo, 0, DATE_SIZE)

      chunkOne = Buffer.concat([payloadOneId, payloadOne])
      chunkTwo = Buffer.concat([payloadTwoId, payloadTwo])

      setChunkMetaInfo(chunkOne, 0, 0)
      setChunkMetaInfo(chunkTwo, 0, 0)
    } else {
      payloadOne = chunkOne = crypto.randomBytes(SMALL_PACKET_SIZE)
      payloadTwo = chunkTwo = crypto.randomBytes(SMALL_PACKET_SIZE)
    }

    client.send(chunkOne, DEFAULT_PORT)

    await delay(5)

    assertTry(
      () =>
        assert.strictEqual(
          socket.messages.length,
          1,
          `${caseAlias} 1 message should be received by socket`
        ),
      results
    )

    const messageOne = fragmentation ? socket.messages[0] : socket.messages[0]

    checkMessage(caseAlias, messageOne, results, payloadOne)

    client.send(chunkTwo, DEFAULT_PORT)

    await delay(5)

    assertTry(
      () =>
        assert.strictEqual(
          socket.messages.length,
          2,
          `${caseAlias} 2 message should be received by socket`
        ),
      results
    )

    const messageTwo = fragmentation ? socket.messages[1] : socket.messages[1]

    checkMessage(caseAlias, messageTwo, results, payloadTwo)

    await Promise.all([socket.stop(), client.stop()])

    checkResults(results, caseAlias)
  }

  async function testSocketFragLarge () {
    const caseAlias = `${alias} sending large message ->`
    const results = { fails: [] }

    const client = await createUDPClient()
    const socket = await createUDPSocket({
      port: DEFAULT_PORT,
      fragmentation: true
    })

    const payload1 = crypto.randomBytes(BIG_PACKET_SIZE - ID_SIZE)
    const payload2 = crypto.randomBytes(
      BIG_PACKET_SIZE - (Math.random() * BIG_PACKET_SIZE) / 2 - ID_SIZE
    )

    const dateNow = Date.now()
    const payloadId = generateId()
    payloadId.writeUintBE(dateNow, 0, DATE_SIZE)

    const chunk1 = Buffer.concat([payloadId, payload1])
    const chunk2 = Buffer.concat([payloadId, payload2])

    setChunkMetaInfo(chunk1, 1, 0)
    setChunkMetaInfo(chunk2, 1, 1)

    client.send(chunk1, DEFAULT_PORT)
    await delay(0)
    client.send(chunk2, DEFAULT_PORT)

    await delay(5)

    assertTry(
      () =>
        assert.strictEqual(
          socket.messages.length,
          1,
          `${caseAlias} 1 message should be received by socket`
        ),
      results
    )

    checkMessage(
      caseAlias,
      socket.messages[0],
      results,
      Buffer.concat([payload1, payload2])
    )

    const payload3 = crypto.randomBytes(BIG_PACKET_SIZE - ID_SIZE)
    const payload4 = crypto.randomBytes(BIG_PACKET_SIZE - ID_SIZE)

    const dateNow2 = Date.now()
    const payloadId2 = generateId()
    payloadId.writeUintBE(dateNow2, 0, DATE_SIZE)

    const chunk3 = Buffer.concat([payloadId2, payload3])
    const chunk4 = Buffer.concat([payloadId2, payload4])

    setChunkMetaInfo(chunk3, 1, 0)
    setChunkMetaInfo(chunk4, 1, 1)

    client.send(chunk4, DEFAULT_PORT)
    await delay(0)
    client.send(chunk3, DEFAULT_PORT)

    await delay(5)

    assertTry(
      () =>
        assert.strictEqual(
          socket.messages.length,
          2,
          `${caseAlias} 2 message should be received by socket`
        ),
      results
    )

    checkMessage(
      caseAlias,
      socket.messages[1],
      results,
      Buffer.concat([payload3, payload4])
    )

    const payload5 = crypto.randomBytes(BIG_PACKET_SIZE - ID_SIZE)

    const dateNow3 = Date.now()
    const payloadId3 = generateId()
    payloadId.writeUintBE(dateNow3, 0, DATE_SIZE)

    const chunk5 = Buffer.concat([payloadId3, payload5])

    setChunkMetaInfo(chunk5, 0, 0)

    client.send(chunk5, DEFAULT_PORT)

    await delay(5)

    assertTry(
      () =>
        assert.strictEqual(
          socket.messages.length,
          3,
          `${caseAlias} 3 message should be received by socket`
        ),
      results
    )

    checkMessage(caseAlias, socket.messages[2], results, payload5)

    await Promise.all([socket.stop(), client.stop()])

    checkResults(results, caseAlias)
  }

  async function testSocketFragWarningMissing () {
    const caseAlias = `${alias} handling warning Missing ->`
    const results = { fails: [] }

    const client = await createUDPClient()
    const socket = await createUDPSocket({
      fragmentation: true,
      gcExpirationTime: 6,
      gcIntervalTime: 3,
      port: DEFAULT_PORT
    })

    const dateNow = Date.now()
    const payloadId = generateId()
    payloadId.writeUintBE(dateNow, 0, DATE_SIZE)

    const payload = crypto.randomBytes(BIG_PACKET_SIZE - ID_SIZE)
    const chunk = Buffer.concat([payloadId, payload])
    setChunkMetaInfo(chunk, 1, 0)

    let missingWarningAppeared = false

    socket.once('warning', (message) => {
      if (message.type === WARNING_MISSING_MESSAGE) {
        missingWarningAppeared = true
      }
    })

    client.send(chunk, DEFAULT_PORT)

    const delayResult = await Promise.race([
      delay(10),
      once(socket, 'warning')
    ])

    if (delayResult === TIMEOUT_SYMBOL) await delay(5)

    assertTry(
      () =>
        assert.strictEqual(
          socket.messages.length,
          0,
          `${caseAlias} messages length invalid`
        ),
      results
    )

    assertTry(
      () =>
        assert.strictEqual(
          missingWarningAppeared,
          true,
          `${caseAlias} Incorrect message should raise missing warning`
        ),
      results
    )

    const secondChunk = Buffer.concat([payloadId, payload])
    setChunkMetaInfo(chunk, 1, 0)
    setChunkMetaInfo(secondChunk, 1, 1)

    client.send(chunk, DEFAULT_PORT)
    await delay(1)
    client.send(secondChunk, DEFAULT_PORT)

    await delay(5)

    assertTry(
      () =>
        assert.strictEqual(
          socket.messages.length,
          1,
          `${caseAlias} messages length invalid`
        ),
      results
    )

    checkMessage(
      caseAlias,
      socket.messages[0],
      results,
      Buffer.concat([payload, payload])
    )

    await Promise.all([socket.stop(), client.stop()])

    checkResults(results, caseAlias)
  }

  async function testSocketEncFunction (encType, fragmentation) {
    const caseAlias = `${alias} check decryption via Function with fragmentation=${
      fragmentation ? 'true' : 'false'
    } ->`
    const results = { fails: [] }

    let enc, dec

    if (encType === 'string') {
      enc = dec = (buf) => buf.map((b) => b ^ 0x81)
    } else if (encType === 'function') {
      const secret = crypto.randomBytes(32)

      dec = secret.toString('hex')
      enc = (data) => DEFAULT_ENCRYPT_FUNCTION(secret, data)
    }

    const client = await createUDPClient()
    const socket = await createUDPSocket({
      port: DEFAULT_PORT,
      fragmentation,
      decryption: dec
    })

    let payloadOne, payloadTwo, chunkOne, chunkTwo

    if (fragmentation) {
      payloadOne = crypto.randomBytes(BIG_PACKET_SIZE - ID_SIZE)
      payloadTwo = crypto.randomBytes(BIG_PACKET_SIZE - ID_SIZE)

      const dateNow = Date.now()
      const payloadId = generateId()
      payloadId.writeUintBE(dateNow, 0, DATE_SIZE)

      chunkOne = Buffer.concat([payloadId, payloadOne])
      chunkTwo = Buffer.concat([payloadId, payloadTwo])

      setChunkMetaInfo(chunkOne, 1, 0)
      setChunkMetaInfo(chunkTwo, 1, 1)
    } else {
      payloadOne = chunkOne = crypto.randomBytes(BIG_PACKET_SIZE)
      payloadTwo = chunkTwo = crypto.randomBytes(BIG_PACKET_SIZE)
    }

    client.send(enc(chunkOne), DEFAULT_PORT)
    client.send(enc(chunkTwo), DEFAULT_PORT)

    await delay(5)

    if (fragmentation) {
      assertTry(
        () =>
          assert.strictEqual(
            socket.messages.length,
            1,
            `${caseAlias} 1 message should be received by socket`
          ),
        results
      )

      checkMessage(
        caseAlias,
        socket.messages[0],
        results,
        Buffer.concat([payloadOne, payloadTwo])
      )
    } else {
      assertTry(
        () =>
          assert.strictEqual(
            socket.messages.length,
            2,
            `${caseAlias} 2 message should be received by socket`
          ),
        results
      )

      checkMessage(caseAlias, socket.messages[0], results, payloadOne)

      checkMessage(caseAlias, socket.messages[1], results, payloadTwo)
    }

    await Promise.all([socket.stop(), client.stop()])

    checkResults(results, caseAlias)
  }

  const errors = tryCountErrorHook()

  await errors.try(() => testSocketSmall(false))
  await errors.try(() => testSocketEncFunction('function', false))
  await errors.try(() => testSocketEncFunction('string', false))

  await errors.try(() => testSocketSmall(true))
  await errors.try(testSocketFragLarge)
  await errors.try(testSocketFragWarningMissing)
  await errors.try(() => testSocketEncFunction('function', true))
  await errors.try(() => testSocketEncFunction('string', true))

  if (errors.count === 0) {
    console.log('[socket.js] All test for passed\n')
  } else {
    console.log(`[socket.js] Has ${errors.count} errors`)
  }

  return errors.count
}

export default socketTest
