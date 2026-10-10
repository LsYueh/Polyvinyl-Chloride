import { describe, expect, it } from 'vitest'
import { SocketPacket } from '#server/utils/protocol/slm/SocketPacket'
import { SocketPacketParser } from '#server/utils/protocol/slm/SocketPacketParser'

describe('SocketPacketParser', () => {
  it('TryParse_ValidPacket_ShouldReturnTrue', () => {
    // Arrange
    const payload = Buffer.from('Hello', 'utf8')
    const control = Buffer.from('10', 'ascii')
    const packet = new SocketPacket(control, payload)
    const buffer = packet.toBytes()

    // Act
    const result = SocketPacketParser.tryParse(buffer)

    // Assert
    expect(result).not.toBeNull()
    expect(result!.consumed).toEqual(buffer.length)
    expect(result!.packet.controlCode).toEqual(control)
    expect(result!.packet.payload).toEqual(payload)
  })

  it('TryParse_PayloadNull_ShouldReturnTrue', () => {
    // Arrange
    const control = Buffer.from('10', 'ascii')
    const packet = new SocketPacket(control, null)
    const buffer = packet.toBytes()

    // Act
    const result = SocketPacketParser.tryParse(buffer)

    // Assert
    expect(result).not.toBeNull()
    expect(result!.consumed).toEqual(buffer.length)
    expect(result!.packet.controlCode).toEqual(control)
    expect(result!.packet.payload).toBeNull()
  })

  it('TryParse_InsufficientData_ShouldReturnFalse', () => {
    // Arrange
    const buffer = Buffer.from([0xFE, 0xFE, 0x31])

    // Act
    const parsedPacket = SocketPacketParser.tryParse(buffer)

    // Assert
    expect(parsedPacket).toBeNull()
  })

  it('TryParse_InvalidHeader_ShouldThrow', () => {
    // Arrange
    const buffer = Buffer.from([
      0x00, 0x00, 0x31, 0x30, 0x00, 0x00, 0xEF, 0xEF,
    ])

    // Act & Assert
    expect(() => {
      SocketPacketParser.tryParse(buffer)
    }).toThrow()
  })

  it('TryParse_InvalidTrailer_ShouldThrow', () => {
    // Arrange
    const payload = Buffer.from('A', 'utf8')
    const control =  Buffer.from('10', 'ascii')
    const packet = new SocketPacket(control, payload)
    const buffer = packet.toBytes()

    // Corrupt trailer
    buffer[buffer.length - 1] = 0x00

    // Act & Assert
    expect(() => {
      SocketPacketParser.tryParse(buffer)
    }).toThrow()
  })
})
