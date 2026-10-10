export const SocketProtocol = {
  // +------------------------------------------------+----------------+--------------+
  // |                    Header                      |     [Body]     |   Trailer    |
  // +-------------+--------------+-------------------+----------------+--------------+
  // | Header Code | Control Code | AP-Message Length |     Payload    | Trailer code |
  // +-------------+--------------+-------------------+----------------+--------------+
  // | 2 bytes     | 2 bytes      | 2 bytes           | variable (0~N) | 2 bytes      |
  // +-------------+--------------+-------------------+----------------+--------------+
  // | 0xFEFE      | ASCII '10'   | payloadLen        |  payload bytes | 0xEFEF       |
  // +-------------+--------------+-------------------+----------------+--------------+

  // Legend:
  // - Header      : 固定值 0xFEFE (2 bytes)
  // - ControlCode : ASCII, 2 bytes (如 "10")
  // - Length      : 2-byte unsigned integer, 表示 payload 長度
  // - Payload     : 可為 null 或 variable 長度 (0 ~ MaxPacketSize)
  // - Trailer     : 固定值 0xEFEF (2 bytes)

  HEADER_SIZE : 2,
  CONTROL_SIZE: 2,
  LENGTH_SIZE : 2,
  TRAILER_SIZE: 2,

  /**
   * Header + Control + Length
   */
  PREFIX_SIZE: 2 + 2 + 2,

  HEADER_CODE : 0xFEFE,
  TRAILER_CODE: 0xEFEF,

  /**
   * Header + Control + Length + Trailer
   */
  MIN_PACKET_SIZE: 2 + 2 + 2 + 2,
} as const;