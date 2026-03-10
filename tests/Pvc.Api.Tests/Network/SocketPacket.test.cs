using System.Text;
using Pvc.Api.Network;

namespace Pvc.Api.Tests.Network;

[TestClass]
public class SocketPacketTest
{
    [TestMethod]
    public void Constructor_NullPayload_LengthIsZero()
    {
        var packet = new SocketPacket("10", null);
        
        Assert.AreEqual("10", packet.ControlCode);
        Assert.AreEqual(0, packet.Length);
        Assert.IsNull(packet.Payload);
    }

    [TestMethod]
    public void ToBytes_WithPayload_CorrectFormat()
    {
        var payload = Encoding.UTF8.GetBytes("Hello").AsMemory();
        var packet = new SocketPacket("10", payload);
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

        var packet = new SocketPacket("10", bytes.AsMemory());
        var str = packet.ToString();

        Assert.IsTrue(str.Contains("00-01-02-03-04-05-06-07-08-09-0A-0B-0C-0D-0E-0F..."));
    }

    [TestMethod]
    public void ToBytes_ParseRoundTrip_ShouldMatchOriginal()
    {
        var packet = SocketPacket.FromPayload("10", "Hello World");
        var bytes = packet.ToBytes();

        bool parsed = SocketPacketParser.TryParse(bytes, out int consumed, out var result);
        
        Assert.IsTrue(parsed);
        Assert.AreEqual(bytes.Length, consumed);
        Assert.AreEqual(packet.ControlCode, result!.ControlCode);
        Assert.AreEqual(packet.Length, result.Length);
        
        CollectionAssert.AreEqual(packet.Payload?.ToArray(), result.Payload?.ToArray());
    }
}