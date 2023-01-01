import crypto from 'node:crypto'

export const DEFAULT_PORT = 44302
export const IV_SIZE = 16

const DEFAULT_ENCRYPTION = 'aes-256-ctr'

/**
 * @param {Buffer} payload
 * @param {Buffer} secret
 * @returns {Buffer}
 */
export const DEFAULT_ENCRYPT_FUNCTION = (secret, payload) => {
  const iv = crypto.randomBytes(IV_SIZE).subarray(0, IV_SIZE)
  const cipher = crypto.createCipheriv(DEFAULT_ENCRYPTION, secret, iv)
  const beginChunk = cipher.update(payload)
  const finalChunk = cipher.final()

  return Buffer.concat(
    [iv, beginChunk, finalChunk],
    IV_SIZE + beginChunk.length + finalChunk.length
  )
}

/**
 * @param {Buffer} secret
 * @param {Buffer} buffer
 * @returns {Buffer}
 */
export const DEFAULT_DECRYPT_FUNCTION = (secret, buffer) => {
  const iv = buffer.subarray(0, IV_SIZE)
  const payload = buffer.subarray(IV_SIZE)
  const decipher = crypto.createDecipheriv(DEFAULT_ENCRYPTION, secret, iv)
  const beginChunk = decipher.update(payload)
  const finalChunk = decipher.final()

  return Buffer.concat(
    [beginChunk, finalChunk],
    beginChunk.length + finalChunk.length
  )
}
