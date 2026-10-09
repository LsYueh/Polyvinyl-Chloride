import { describe, it, expect } from 'vitest'
import { SocketPacket } from '#server/utils/protocol/SocketPacket'
import { SocketPacketParser } from '#server/utils/protocol/SocketPacketParser'
import { SocketProtocol } from '#server/utils/protocol/SocketProtocol'

describe('SocketPacketParserFragment', () => {
  it.each([
    {
      splitIndex: 5,
      caseName: '不完整封包'
    },
    {
      splitIndex: SocketProtocol.MIN_PACKET_SIZE + 1,
      caseName: '完整的 SLM Header + 不完整的 Body',
    },
  ])('TryParse_FragmentedPacket_ShouldWaitUntilComplete：$caseName', ({ splitIndex }) => {
    // Arrange
    const payload = Buffer.from('HelloWorld', 'utf8')
    const control = Buffer.from('10', 'ascii')
    const packet = new SocketPacket(control, payload)
    const fullBuffer = packet.toBytes()

    // 模擬拆成兩段接收
    const fragment1 = fullBuffer.subarray(0, splitIndex)
    const fragment2 = fullBuffer.subarray(splitIndex)

    // Act 1：先解析第一段
    const result1 = SocketPacketParser.tryParse(fragment1)

    // Assert 1：封包不完整，應等待剩餘資料
    expect(result1).toBeNull()

    // Arrange 2：合併兩段資料
    const combined = Buffer.concat([fragment1, fragment2])

    // Act 2：重新解析完整封包
    const result2 = SocketPacketParser.tryParse(combined)

    // Assert 2
    expect(result2).not.toBeNull()
    expect(result2!.consumed).toBe(combined.length)
    expect(result2!.packet.controlCode).toEqual(control)
    expect(result2!.packet.payload).toEqual(payload)
  })
})