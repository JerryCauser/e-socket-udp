import crypto from 'node:crypto'
import assert from 'node:assert'
import { tryCountErrorHook } from './_main.js'

/** [x] here we need to check if encryption and decryption works */

async function constantsTests ({
  DEFAULT_DECRYPT_FUNCTION,
  DEFAULT_ENCRYPT_FUNCTION
}) {
  const alias = '  constants.js:'

  function testEncAndDec () {
    const caseAlias = `${alias} ENCRYPT and DECRYPT ->`
    const originData = crypto.randomBytes(1024)
    const secret = crypto.randomBytes(32)
    const encData = DEFAULT_ENCRYPT_FUNCTION(secret, originData)
    const decData = DEFAULT_DECRYPT_FUNCTION(secret, encData)

    assert.ok(
      encData instanceof Buffer,
      `${caseAlias} encrypted Data data isn't Buffer type`
    )

    assert.deepStrictEqual(
      decData,
      originData,
      `${caseAlias} e decrypted data isn't same as origin`
    )

    console.log(`${caseAlias} passed`)
  }

  const errors = tryCountErrorHook()

  await errors.try(testEncAndDec)

  if (errors.count === 0) {
    console.log('[constants.js] All test for  passed\n')
  } else {
    console.log(`[constants.js] Has ${errors.count} errors`)
  }

  return errors.count
}

export default constantsTests
