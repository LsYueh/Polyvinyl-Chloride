namespace Pvc.Api.Network;

/// <summary>
/// Socket Level Message (SLM)
/// </summary>
/// <param name="controlCode"></param>
/// <param name="payload"></param>
public sealed class SocketPacket(string controlCode, ReadOnlyMemory<byte>? payload)
{
    public const ushort HeaderCode = 0xFEFE;
    public const ushort TrailerCode = 0xEFEF;

    public string ControlCode { get; } = controlCode ?? throw new ArgumentNullException(nameof(controlCode));

    public ReadOnlyMemory<byte>? Payload { get; } = payload;

    public ushort Length => (ushort)(Payload?.Length ?? 0);
}
