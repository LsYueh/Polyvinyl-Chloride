namespace Pvc.Api.Network;

/// <summary>
/// Socket Level Message (SLM) Protocol
/// </summary>
public static class SocketProtocol
{
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

    public const int HeaderSize  = 2;
    public const int ControlSize = 2;
    public const int LengthSize  = 2;
    public const int TrailerSize = 2;

    /// <summary>
    /// Header + Control + Length
    /// </summary>
    public const int PrefixSize = HeaderSize + ControlSize + LengthSize;

    public const ushort HeaderCode  = 0xFEFE;
    public const ushort TrailerCode = 0xEFEF;

    /// <summary>
    /// Header + Control + Length + Trailer
    /// </summary>
    public const int MinPacketSize = PrefixSize + TrailerSize;
}
