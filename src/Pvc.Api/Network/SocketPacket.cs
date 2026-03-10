using System.Buffers.Binary;
using System.Text;

namespace Pvc.Api.Network;

/// <summary>
/// Socket Level Message (SLM)
/// </summary>
/// <param name="controlCode"></param>
/// <param name="payload"></param>
public sealed class SocketPacket(string controlCode, ReadOnlyMemory<byte>? payload = null)
{
    public const ushort HeaderCode = 0xFEFE;
    public const ushort TrailerCode = 0xEFEF;

    public string ControlCode { get; } = controlCode ?? throw new ArgumentNullException(nameof(controlCode));

    public ReadOnlyMemory<byte>? Payload { get; } = payload;

    public ushort Length => (ushort)(Payload?.Length ?? 0);

    public byte[] ToBytes()
    {
        int payloadLength = Length;
        byte[] buffer = new byte[6 + payloadLength + 2];

        // Header
        BinaryPrimitives.WriteUInt16BigEndian(buffer.AsSpan(0, 2), HeaderCode);

        // ControlCode
        byte[] controlBytes = Encoding.ASCII.GetBytes(ControlCode);
        if (controlBytes.Length != 2)
            throw new InvalidDataException("ControlCode must be 2 bytes");

        controlBytes.CopyTo(buffer, 2);

        // Length
        BinaryPrimitives.WriteUInt16BigEndian(buffer.AsSpan(4, 2), (ushort)payloadLength);

        // Payload
        if (payloadLength > 0 && Payload.HasValue)
        {
            Payload.Value.CopyTo(buffer.AsMemory(6, payloadLength));
        }

        // Trailer
        BinaryPrimitives.WriteUInt16BigEndian(buffer.AsSpan(6 + payloadLength, 2), TrailerCode);

        return buffer;
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

        return $"SocketPacket {{ Header=0x{HeaderCode:X4}, Control={ControlCode}, Length={Length}, Payload={payloadStr}, Trailer=0x{TrailerCode:X4} }}";
    }
}
