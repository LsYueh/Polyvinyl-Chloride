import { Buffer } from 'node:buffer';
import { SocketProtocol } from './SocketProtocol';

/**
 * Socket Level Message (SLM)
 */
export class SocketPacket {
  /**
   * Control Code
   * - 00: 代表TMP訊息
   * - 10: 代表接受Socket訊息
   * - 11: 代表Heartbeat
   * - (其他): 代表錯誤訊息
   */
  readonly controlCode: Buffer;
  
  /**
   * (TMP 訊息內容)
   */
  readonly payload?: Buffer | null;

  get length(): number {
    return this.payload?.length ?? 0;
  }

  get packetSize(): number {
    return SocketProtocol.PREFIX_SIZE +
      this.length +
      SocketProtocol.TRAILER_SIZE;
  }

  /**
   * Socket Level Message (SLM)
   * @param controlCode 
   * @param payload 
   */
  constructor(controlCode: Buffer, payload?: Buffer | null) {
    if (controlCode.length !== 2) {
      throw new Error('ControlCode must be 2 bytes');
    }

    this.controlCode = controlCode;
    this.payload = payload;
  }

  toBytes(): Buffer {
    const buffer = Buffer.alloc(this.packetSize);

    let offset = 0;

    // Header
    buffer.writeUInt16BE(
      SocketProtocol.HEADER_CODE,
      offset
    );
    offset += SocketProtocol.HEADER_SIZE;

    // Control Code
    this.controlCode.copy(buffer, offset);
    offset += SocketProtocol.CONTROL_SIZE;

    // Payload Length
    buffer.writeUInt16BE(this.length, offset);
    offset += SocketProtocol.LENGTH_SIZE;

    // Payload
    if (this.payload) {
      this.payload.copy(buffer, offset);
      offset += this.payload.length;
    }

    // Trailer
    buffer.writeUInt16BE(
      SocketProtocol.TRAILER_CODE,
      offset
    );

    return buffer;
  }

  /**
   * 靜態工廠方法：使用 UTF8 字串作為 payload
   * @param controlCode 
   * @param textPayload 
   * @returns 
   */
  static fromPayload(
    controlCode: string,
    textPayload?: string | null
  ): SocketPacket {
    if (controlCode.length !== 2) {
      throw new Error('ControlCode must be 2 characters');
    }

    const controlBytes = Buffer.from(controlCode, 'ascii');

    const payload = textPayload
      ? Buffer.from(textPayload, 'utf8')
      : null;

    return new SocketPacket(controlBytes, payload);
  }

  toString(): string {
    let payloadStr: string;

    if (!this.payload || this.payload.length === 0) {
      payloadStr = '(null)';
    } else {
      const length = Math.min(16, this.payload.length);

      payloadStr = this.payload
        .subarray(0, length)
        .toString('hex')
        .match(/.{1,2}/g)!
        .join('-')
        .toUpperCase();

      if (this.payload.length > length) {
        payloadStr += '...';
      }
    }

    return `SocketPacket { Header=0x${SocketProtocol.HEADER_CODE.toString(16).toUpperCase().padStart(4, '0')}, Control=${this.controlCode.toString('ascii')}, Length=${this.length}, Payload=${payloadStr}, Trailer=0x${SocketProtocol.TRAILER_CODE.toString(16).toUpperCase().padStart(4, '0')} }`;
  }
}