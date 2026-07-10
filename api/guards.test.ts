// guards.test.ts
import { describe, it, expect } from '@jest/globals'
import { guards } from './guards.js'

describe('isCreateUploadSessionBody', () => {
  it('should return true when the body contains a valid Ethereum address', () => {
    const validBody = {
      creatorAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
    }
    expect(guards.isCreateUploadSessionBody(validBody)).toBe(true)
  })

  it('should return false for invalid or missing addresses', () => {
    const invalidBodies = [
      { creatorAddress: '0x123' },
      { creatorAddress: 'not-an-address' },
      { creatorAddress: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045' },
      { otherProperty: 'something' },
      { creatorAddress: 12345 },
      null,
      undefined,
      {}
    ]

    invalidBodies.forEach(body => {
      expect(guards.isCreateUploadSessionBody(body)).toBe(false)
    })
  })
})