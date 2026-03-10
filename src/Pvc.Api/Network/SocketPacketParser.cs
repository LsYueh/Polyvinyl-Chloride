using System.Buffers.Binary;

namespace Pvc.Api.Network;

/// <summary>
/// Socket Level Message (SLM) Parser
/// </summary>
public static class SocketPacketParser
{
    /// <summary>
    /// 2-byte length
    /// </summary>
    private const ushort MaxPacketSize = ushort.MaxValue; // 65535
    
    /// <summary>
    /// 交易所應該還是大型主機，Binary 解碼都用 BigEndian
    /// </summary>
    /// <param name="buffer"></param>
    /// <param name="consumed"></param>
    /// <param name="packet"></param>
    /// <returns></returns>
    /// <exception cref="InvalidDataException"></exception>
    public static bool TryParse(
        ReadOnlySpan<byte> buffer,
        out int consumed,
        out SocketPacket? packet)
    {
        consumed = 0;
        packet = null;

        if (buffer.Length < SocketProtocol.MinPacketSize)
            return false;

        // Header
        ushort header = BinaryPrimitives.ReadUInt16BigEndian(
            buffer[..SocketProtocol.HeaderSize]);

        if (header != SocketProtocol.HeaderCode)
            throw new InvalidDataException("Invalid header");

        // ControlCode
        var control = buffer.Slice(
            SocketProtocol.HeaderSize,
            SocketProtocol.ControlSize).ToArray();

        // Length
        ushort len = BinaryPrimitives.ReadUInt16BigEndian(
            buffer.Slice(SocketProtocol.HeaderSize + SocketProtocol.ControlSize, SocketProtocol.LengthSize));

        // 檢查安全上限
        if (len > MaxPacketSize)
            throw new InvalidDataException($"Packet length {len} exceeds MaxPacketSize {MaxPacketSize}");

        int packetSize = SocketProtocol.PrefixSize + len + SocketProtocol.TrailerSize;

        if (buffer.Length < packetSize)
            return false; // 等待更多資料

        // Trailer
        ushort trailer = BinaryPrimitives.ReadUInt16BigEndian(
            buffer.Slice(SocketProtocol.PrefixSize + len, SocketProtocol.TrailerSize));
        
        if (trailer != SocketProtocol.TrailerCode)
            throw new InvalidDataException("Invalid trailer");

        // Payload
        ReadOnlyMemory<byte>? payload = null;

        if (len > 0 )
            payload = buffer.Slice(SocketProtocol.PrefixSize, len).ToArray();

        packet = new SocketPacket(control, payload);

        consumed = packetSize;
        
        return true;
    }
}
