import { describe, expect, it } from 'vitest'
import { SocketPacket } from '#server/utils/protocol/SocketPacket'
import { SocketPacketParser } from '#server/utils/protocol/SocketPacketParser'
import { SocketProtocol } from '#server/utils/protocol/SocketProtocol'
import { Buffer } from 'node:buffer'

const controlCode = Buffer.from('10', 'utf8')

describe('SocketPacket', () => {
  it('Constructor_NullPayload_LengthIsZero', () => {
    const packet = new SocketPacket(controlCode, null)

    expect(packet.controlCode).toEqual(controlCode)
    expect(packet.length).toBe(0)
    expect(packet.payload).toBeNull()
  })

  it('ToBytes_WithPayload_CorrectFormat', () => {
    const payload = Buffer.from('Hello', 'utf8')
    const packet = new SocketPacket(controlCode, payload)
    const bytes = packet.toBytes()

    // Header
    expect(bytes[0]).toBe(0xfe)
    expect(bytes[1]).toBe(0xfe)

    // Control
    expect(bytes.subarray(2, 4)).toEqual(controlCode)

    // Length (Big Endian)
    expect(bytes[4]).toBe(0)
    expect(bytes[5]).toBe(5)

    // Payload
    expect(bytes.subarray(6, 11)).toEqual(payload)

    // Trailer
    expect(bytes[11]).toBe(0xef)
    expect(bytes[12]).toBe(0xef)
  })

  it('ToBytes_WithPayload_ShouldAssembleCorrectly', () => {
    const payload = Buffer.from('Hello', 'utf8')
    const packet = new SocketPacket(controlCode, payload)

    const bytes = packet.toBytes()

    // 檢查長度
    expect(bytes.length).toBe(6 + payload.length + 2)

    // Header
    const header = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    ).getUint16(0, false)

    expect(header).toBe(SocketProtocol.HEADER_CODE)

    // Control code
    expect(bytes.subarray(2, 4)).toEqual(controlCode)

    // Length
    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    )
    const length = view.getUint16(4, false)

    expect(length).toBe(payload.length)

    // Payload
    expect(bytes.subarray(6, 6 + payload.length)).toEqual(payload)

    // Trailer
    const trailer = view.getUint16(6 + payload.length, false)

    expect(trailer).toBe(SocketProtocol.TRAILER_CODE)
  })

  it('ToBytes_ParseRoundTrip_ShouldMatchOriginal', () => {
    const packet = SocketPacket.fromPayload('10', 'Hello World')
    const bytes = packet.toBytes()

    const parsed = SocketPacketParser.tryParse(bytes)

    expect(parsed).not.toBeNull()
    expect(parsed?.consumed).toBe(bytes.length)

    expect(parsed?.packet).toBeDefined()
    const result = parsed?.packet!
    
    expect(result.controlCode).toEqual(packet.controlCode)
    expect(result.length).toBe(packet.length)
    expect(result.payload).toEqual(packet.payload)
  })

  it('ToBytes_NullPayload_ShouldProduceMinimalPacket', () => {
    const packet = new SocketPacket(controlCode, null)
    const bytes = packet.toBytes()

    // Header + Control + Length + Trailer = 8 bytes
    expect(bytes.length).toBe(8)

    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    )

    // Header
    expect(view.getUint16(0, false)).toBe(SocketProtocol.HEADER_CODE)

    // Control code
    expect(bytes.subarray(2, 4)).toEqual(controlCode)

    // Length
    expect(view.getUint16(4, false)).toBe(0)

    // Trailer
    expect(view.getUint16(6, false)).toBe(SocketProtocol.TRAILER_CODE)
  })

  it('ToBytes_EmptyPayload_ShouldProduceMinimalPacket', () => {
    const payload = Buffer.alloc(0)
    const packet = new SocketPacket(controlCode, payload)

    const bytes = packet.toBytes()

    // Empty payload 與 null payload 的封包長度相同
    expect(bytes.length).toBe(8)

    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    )

    expect(view.getUint16(4, false)).toBe(0)
  })

  it('FromPayload_NullTextPayload_ShouldBeNull_01', () => {
    const packet = SocketPacket.fromPayload('10')

    expect(packet.payload).toBeNull()
    expect(packet.length).toBe(0)
  })

  it('FromPayload_NullTextPayload_ShouldBeNull_02', () => {
    const packet = SocketPacket.fromPayload('10', '')

    expect(packet.payload).toBeNull()
    expect(packet.length).toBe(0)
  })

  it.each(['', null])(
    'FromPayload_NullTextPayload_ShouldBeNull_03 (%s)',
    (textPayload) => {
      const packet = SocketPacket.fromPayload('10', textPayload)

      expect(packet.payload).toBeNull()
      expect(packet.length).toBe(0)
    },
  )

  it('ToString_LongPayload_ShouldTruncate', () => {
    const bytes = Buffer.from(
      Array.from({ length: 20 }, (_, index) => index),
    )

    const packet = new SocketPacket(controlCode, bytes)
    const str = packet.toString()

    expect(str).toContain('Length=20,')
    expect(str).toContain(
      'Payload=00-01-02-03-04-05-06-07-08-09-0A-0B-0C-0D-0E-0F...',
    )
  })

  it('ToString_LongPayload_ShouldNull', () => {
    const packet = new SocketPacket(controlCode)
    const str = packet.toString()

    expect(str).toContain('Length=0,')
    expect(str).toContain('Payload=(null),')
  })
})
