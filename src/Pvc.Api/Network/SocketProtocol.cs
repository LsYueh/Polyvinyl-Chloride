namespace Pvc.Api.Network;

public static class SocketProtocol
{
    // The Magic numbers

    public const int HeaderSize = 2;
    public const int ControlSize = 2;
    public const int LengthSize = 2;
    public const int TrailerSize = 2;

    /// <summary>
    /// Header + Control + Length
    /// </summary>
    public const int PrefixSize = HeaderSize + ControlSize + LengthSize;

    public const ushort HeaderCode = 0xFEFE;
    public const ushort TrailerCode = 0xEFEF;

    /// <summary>
    /// Header + Control + Length + Trailer
    /// </summary>
    public const int MinPacketSize = PrefixSize + TrailerSize;
}
