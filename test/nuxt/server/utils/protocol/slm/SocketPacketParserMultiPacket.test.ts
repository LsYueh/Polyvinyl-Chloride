import { describe, it, expect } from 'vitest'
import { SocketPacket } from '#server/utils/protocol/slm/SocketPacket'
import { SocketPacketParser } from '#server/utils/protocol/slm/SocketPacketParser'

describe('SocketPacketParserMultiPacket', () => {
  it('TryParse_MultiplePacketsWithPartialEnd_ShouldParseCorrectly', () => {
    // Arrange：三個封包
    const control = Buffer.from('10', 'ascii')
    const packet1 = new SocketPacket(control, Buffer.from('Hello', 'utf8'))
    const packet2 = new SocketPacket(control, Buffer.from('World', 'utf8'))
    const packet3 = new SocketPacket(control, Buffer.from('!', 'utf8'))

    // 生成完整 byte stream
    const fullStream = Buffer.concat([
      packet1.toBytes(),
      packet2.toBytes(),
      packet3.toBytes(),
    ])

    // 模擬接收，每次拿隨機長度片段（模擬 TCP 粘包 / 斷包）
    let cursor = 0
    let buffer = Buffer.alloc(0) // buffer 用來累積未解析的資料
    const parsedPackets: SocketPacket[] = []

    // 固定亂數種子，確保測試結果可重現
    let seed = 1234
    const nextRandom = () => {
      seed = (seed * 16807) % 2147483647
      return seed / 2147483647
    }

    while (cursor < fullStream.length) {
      // 模擬每次接收 1～10 bytes
      const chunkSize = Math.min(
        Math.floor(nextRandom() * 10) + 1,
        fullStream.length - cursor,
      )

      const chunk = fullStream.subarray(cursor, cursor + chunkSize)
      cursor += chunkSize

      // 累積尚未解析的資料
      buffer = Buffer.concat([buffer, chunk])

      // TryParse 迴圈解析
      let offset = 0

      while (offset < buffer.length) {
        const result = SocketPacketParser.tryParse(
          buffer.subarray(offset),
        )

        if (result === null) {
          break
        }

        parsedPackets.push(result.packet)
        offset += result.consumed
      }

      // 保留未解析的資料
      buffer = buffer.subarray(offset)
    }

    // Assert
    expect(parsedPackets).toHaveLength(3)

    expect(parsedPackets[0]!.payload).toEqual(Buffer.from('Hello', 'utf8'))
    expect(parsedPackets[1]!.payload).toEqual(Buffer.from('World', 'utf8'))
    expect(parsedPackets[2]!.payload).toEqual(Buffer.from('!', 'utf8'))

    // 最後 buffer 應該為空
    expect(buffer.length).toBe(0)
  })
})