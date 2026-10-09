import { SocketProtocol } from './SocketProtocol'
import { SocketPacket } from './SocketPacket'

/**
 * Socket Level Message (SLM) Parser
 */
export class SocketPacketParser {
  /**
   * 2-byte unsigned length
   */
  static readonly MAX_PACKET_SIZE = 0xFFFF;

  /**
   * 交易所應該還是大型主機，Binary 解碼都用 BigEndian
   *
   * @returns null when the buffer does not contain a complete packet.
   * @throws Error when the packet format is invalid.
   */
  static tryParse(buffer: Buffer): {
    consumed: number
    packet: SocketPacket
  } | null {
    if (buffer.length < SocketProtocol.MIN_PACKET_SIZE) {
      return null;
    }

    // Header
    const header = buffer.readUInt16BE(0);

    if (header !== SocketProtocol.HEADER_CODE) {
      throw new Error('Invalid header');
    }

    // Control Code
    const controlStart = SocketProtocol.HEADER_SIZE
    const controlEnd   = controlStart + SocketProtocol.CONTROL_SIZE
    const control      = Buffer.from(buffer.subarray(controlStart, controlEnd));

    // Length
    const len = buffer.readUInt16BE(SocketProtocol.HEADER_SIZE + SocketProtocol.CONTROL_SIZE)

    // 檢查安全上限
    if (len > SocketPacketParser.MAX_PACKET_SIZE) {
      throw new Error(
        `Packet length ${len} exceeds MaxPacketSize ${SocketPacketParser.MAX_PACKET_SIZE}`
      );
    }

    const packetSize = SocketProtocol.PREFIX_SIZE + len + SocketProtocol.TRAILER_SIZE;

    if (buffer.length < packetSize) {
      return null; // Wait for more data
    }

    // Trailer
    const trailer = buffer.readUInt16BE(SocketProtocol.PREFIX_SIZE + len);

    if (trailer !== SocketProtocol.TRAILER_CODE) {
      throw new Error('Invalid trailer');
    }

    // Payload
    let payload: Buffer | null = null;

    if (len > 0) {
      payload = Buffer.from(
        buffer.subarray(
          SocketProtocol.PREFIX_SIZE,
          SocketProtocol.PREFIX_SIZE + len
        )
      );
    }

    const packet = new SocketPacket(control, payload);

    return {
      consumed: packetSize,
      packet,
    };
  }
}