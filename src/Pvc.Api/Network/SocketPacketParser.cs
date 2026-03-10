using System.Buffers.Binary;
using System.Text;

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

        // 最小長度 = Header(2) + Control(2) + Length(2) + Trailer(2) = 8
        if (buffer.Length < 8)
            return false;

        ushort header = BinaryPrimitives.ReadUInt16BigEndian(buffer);
        if (header != SocketPacket.HeaderCode)
            throw new InvalidDataException("Invalid header");

        string control = Encoding.ASCII.GetString(buffer.Slice(2, 2));

        ushort len = BinaryPrimitives.ReadUInt16BigEndian(buffer.Slice(4, 2));

        // 檢查安全上限
        if (len > MaxPacketSize)
            throw new InvalidDataException($"Packet length {len} exceeds MaxPacketSize {MaxPacketSize}");

        int packetSize = 6 + len + 2;

        if (buffer.Length < packetSize)
            return false; // 等待更多資料

        ushort trailer = BinaryPrimitives.ReadUInt16BigEndian(buffer.Slice(6 + len, 2));
        if (trailer != SocketPacket.TrailerCode)
            throw new InvalidDataException("Invalid trailer");

        ReadOnlyMemory<byte>? payload = len > 0 
            ? buffer.Slice(6, len).ToArray() 
            : null;

        packet = new SocketPacket(control, payload);

        consumed = packetSize;
        
        return true;
    }
}
