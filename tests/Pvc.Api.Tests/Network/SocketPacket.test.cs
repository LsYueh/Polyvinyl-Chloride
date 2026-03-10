using System.Buffers.Binary;
using System.Text;
using Pvc.Api.Network;

namespace Pvc.Api.Tests.Network;

[TestClass]
public class SocketPacketTest
{
    private readonly ReadOnlyMemory<byte> controlCode = "10"u8.ToArray();
    
    [TestMethod]
    public void Constructor_NullPayload_LengthIsZero()
    {
        var packet = new SocketPacket(controlCode, null);
        
        Assert.AreEqual(controlCode, packet.ControlCode);
        Assert.AreEqual(0, packet.Length);
        Assert.IsNull(packet.Payload);
    }

    [TestMethod]
    public void ToBytes_WithPayload_CorrectFormat()
    {
        var payload = Encoding.UTF8.GetBytes("Hello").AsMemory();
        var packet = new SocketPacket(controlCode, payload);
        var bytes = packet.ToBytes();

        // Header
        Assert.AreEqual(0xFE, bytes[0]);
        Assert.AreEqual(0xFE, bytes[1]);

        // Control
        Assert.AreEqual((byte)'1', bytes[2]);
        Assert.AreEqual((byte)'0', bytes[3]);

        // Length
        Assert.AreEqual(0, bytes[4]);
        Assert.AreEqual(5, bytes[5]);

        // Payload
        CollectionAssert.AreEqual(payload.ToArray(), bytes[6..11]);

        // Trailer
        Assert.AreEqual(0xEF, bytes[11]);
        Assert.AreEqual(0xEF, bytes[12]);
    }

    [TestMethod]
    public void ToBytes_WithPayload_ShouldAssembleCorrectly()
    {
        var payload = Encoding.UTF8.GetBytes("Hello").AsMemory();
        var packet = new SocketPacket(controlCode, payload);

        var bytes = packet.ToBytes();

        // 檢查長度
        Assert.AreEqual(6 + payload.Length + 2, bytes.Length);

        // Header
        ushort header = BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(0, 2));
        Assert.AreEqual(SocketProtocol.HeaderCode, header);

        // Control code
        var control = bytes.AsSpan(2, 2);
        CollectionAssert.AreEqual(controlCode.ToArray(), control.ToArray());

        // Length
        ushort length = BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(4, 2));
        Assert.AreEqual(payload.Length, length);

        // Payload
        CollectionAssert.AreEqual(payload.ToArray(), bytes[6..(6 + payload.Length)]);

        // Trailer
        ushort trailer = BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(6 + payload.Length, 2));
        Assert.AreEqual(SocketProtocol.TrailerCode, trailer);
    }

    [TestMethod]
    public void ToBytes_ParseRoundTrip_ShouldMatchOriginal()
    {
        var packet = SocketPacket.FromPayload("10", "Hello World");
        var bytes = packet.ToBytes();

        bool parsed = SocketPacketParser.TryParse(bytes, out int consumed, out var result);
        
        Assert.IsTrue(parsed);
        Assert.AreEqual(bytes.Length, consumed);
        CollectionAssert.AreEqual(packet.ControlCode.ToArray(), result!.ControlCode.ToArray());
        Assert.AreEqual(packet.Length, result.Length);
        
        CollectionAssert.AreEqual(packet.Payload?.ToArray(), result.Payload?.ToArray());
    }

    [TestMethod]
    public void ToBytes_NullPayload_ShouldProduceMinimalPacket()
    {
        var packet = new SocketPacket(controlCode, null);

        var bytes = packet.ToBytes();

        // Header + Control + Length + Trailer = 2 + 2 + 2 + 2 = 8
        Assert.AreEqual(8, bytes.Length);

        // Header
        ushort header = BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(0, 2));
        Assert.AreEqual(SocketProtocol.HeaderCode, header);

        // Control code
        var control = bytes.AsSpan(2, 2);
        CollectionAssert.AreEqual(controlCode.ToArray(), control.ToArray());

        // Length
        ushort length = BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(4, 2));
        Assert.AreEqual(0, length);

        // Trailer
        ushort trailer = BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(6, 2));
        Assert.AreEqual(SocketProtocol.TrailerCode, trailer);
    }

    [TestMethod]
    public void ToBytes_EmptyPayload_ShouldProduceMinimalPacket()
    {
        var payload = Array.Empty<byte>().AsMemory();
        var packet = new SocketPacket(controlCode, payload);

        var bytes = packet.ToBytes();

        // 空 payload 與 null payload 封包長度相同
        Assert.AreEqual(8, bytes.Length);

        // Length = 0
        ushort length = BinaryPrimitives.ReadUInt16BigEndian(bytes.AsSpan(4, 2));
        Assert.AreEqual(0, length);
    }

    [TestMethod]
    public void FromPayload_NullTextPayload_ShouldBeNull_01()
    {
        var packet = SocketPacket.FromPayload("10");

        Assert.IsNull(packet.Payload);
        Assert.AreEqual(0, packet.Length);
    }

    [TestMethod]
    public void FromPayload_NullTextPayload_ShouldBeNull_02()
    {
        var packet = SocketPacket.FromPayload("10", string.Empty);

        Assert.IsNull(packet.Payload);
        Assert.AreEqual(0, packet.Length);
    }

    [DataTestMethod]
    [DataRow("")]
    [DataRow(null)]
    public void FromPayload_NullTextPayload_ShouldBeNull_03(string? textPayload)
    {
        var packet = SocketPacket.FromPayload("10", textPayload);

        Assert.IsNull(packet.Payload);
        Assert.AreEqual(0, packet.Length);
    }

    [TestMethod]
    public void ToString_LongPayload_ShouldTruncate()
    {
        var bytes = new byte[20];
        for(int i=0;i<20;i++) bytes[i]=(byte)i;

        var packet = new SocketPacket(controlCode, bytes.AsMemory());
        var str = packet.ToString();

        StringAssert.Contains(str, "Length=20,");
        StringAssert.Contains(str, "Payload=00-01-02-03-04-05-06-07-08-09-0A-0B-0C-0D-0E-0F...");
    }

    [TestMethod]
    public void ToString_LongPayload_ShouldNull()
    {
        var packet = new SocketPacket(controlCode);
        var str = packet.ToString();

        StringAssert.Contains(str, "Length=0,");
        StringAssert.Contains(str, "Payload=(null),");
    }
}