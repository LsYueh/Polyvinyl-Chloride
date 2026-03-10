using System.Buffers.Binary;
using System.Text;

namespace Pvc.Api.Network;

/// <summary>
/// Socket Level Message (SLM)
/// </summary>
/// <param name="controlCode"></param>
/// <param name="payload"></param>
public sealed class SocketPacket
{
    public ReadOnlyMemory<byte> ControlCode { get; }

    public ReadOnlyMemory<byte>? Payload { get; }

    public ushort Length => (ushort)(Payload?.Length ?? 0);

    public int PacketSize => SocketProtocol.PrefixSize + Length + SocketProtocol.TrailerSize;

    public SocketPacket(ReadOnlyMemory<byte> controlCode, ReadOnlyMemory<byte>? payload = null)
    {
        if (controlCode.Length != 2)
            throw new ArgumentException("ControlCode must be 2 bytes", nameof(controlCode));

        ControlCode = controlCode;
        Payload = payload;
    }

    public byte[] ToBytes()
    {
        int payloadLength = Length;
        byte[] buffer = new byte[SocketProtocol.PrefixSize + payloadLength + SocketProtocol.TrailerSize];

        // Header
        BinaryPrimitives.WriteUInt16BigEndian(buffer.AsSpan(0, SocketProtocol.HeaderSize), SocketProtocol.HeaderCode);

        // ControlCode
        ControlCode.Span.CopyTo(buffer.AsSpan(SocketProtocol.HeaderSize, SocketProtocol.ControlSize));

        // Length
        BinaryPrimitives.WriteUInt16BigEndian(
            buffer.AsSpan(SocketProtocol.HeaderSize + SocketProtocol.ControlSize, SocketProtocol.LengthSize), (ushort)payloadLength);

        // Payload
        if (payloadLength > 0 && Payload.HasValue)
        {
            Payload.Value.CopyTo(buffer.AsMemory(SocketProtocol.PrefixSize, payloadLength));
        }

        // Trailer
        BinaryPrimitives.WriteUInt16BigEndian(
            buffer.AsSpan(SocketProtocol.PrefixSize + payloadLength, SocketProtocol.TrailerSize), SocketProtocol.TrailerCode);

        return buffer;
    }

    /// <summary>
    /// 靜態工廠方法：使用 UTF8 字串作為 payload
    /// </summary>
    public static SocketPacket FromPayload(string controlCode, string? textPayload = null)
    {        
        if (controlCode.Length != 2)
            throw new ArgumentException("ControlCode must be 2 characters", nameof(controlCode));

        
        ReadOnlyMemory<byte> controlBytes = Encoding.ASCII.GetBytes(controlCode);

        ReadOnlyMemory<byte>? payload = null;

        if (!string.IsNullOrEmpty(textPayload))
            payload = Encoding.UTF8.GetBytes(textPayload).AsMemory();
        
        return new SocketPacket(controlBytes, payload);
    }

    public override string ToString()
    {
        string payloadStr;

        if (!Payload.HasValue || Payload.Value.Length == 0)
        {
            payloadStr = "(null)";
        }
        else
        {
            var span = Payload.Value.Span;
            int len = Math.Min(16, span.Length);
            payloadStr = BitConverter.ToString(span[..len].ToArray());
            if (span.Length > len)
                payloadStr += "...";
        }

        return $"SocketPacket {{ Header=0x{SocketProtocol.HeaderCode:X4}, Control={ControlCode}, Length={Length}, Payload={payloadStr}, Trailer=0x{SocketProtocol.TrailerCode:X4} }}";
    }
}
