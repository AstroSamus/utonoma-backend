import { createReadStream } from 'fs'
// @ts-ignore
import Hash from 'ipfs-only-hash'
import bs58 from 'bs58'

export type CidV0 = `Qm${string}`
type HashType = {
  of: (
    content: Buffer | NodeJS.ReadableStream,
    options?: { cidVersion?: number }
  ) => Promise<CidV0>
}

const ipfsOptions = {
  cidVersion: 0,
}

export async function simulateIpfsCid(
  filePath: string
): Promise<[Error | null, CidV0]> {
  const stream = createReadStream(filePath)
  const hash: HashType = Hash as HashType
  try {
    const cid = await hash.of(stream, ipfsOptions)
    return [null, convertIpfsCidToBytes32(cid)]
  } catch (error) {
    return [error as Error, '' as CidV0]
  }
}

export function convertIpfsCidToBytes32(cid: CidV0) : CidV0 {
  const arrayBase8 = bs58.decode(cid)
  const reducedTo32Bytes = arrayBase8.slice(2)
  const res = "0x" + Buffer.from(reducedTo32Bytes).toString('hex')
  return res as CidV0
}