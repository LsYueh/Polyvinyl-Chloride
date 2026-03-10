using System.Text;
using Pvc.Api.Network;

namespace Pvc.Api.Tests.Network;

[TestClass]
public class SocketPacketParserTest
{
    [TestMethod]
    public void TryParse_ValidPacket_ShouldReturnTrue()
    {
        // Arrange
        var payload = Encoding.UTF8.GetBytes("Hello");
        var control = "10"u8.ToArray();
        var packet = new SocketPacket(control, payload);
        var buffer = packet.ToBytes(); // 使用 ToBytes 生成合法封包

        // Act
        bool result = SocketPacketParser.TryParse(buffer, out int consumed, out var parsedPacket);

        // Assert
        Assert.IsTrue(result);
        Assert.IsNotNull(parsedPacket);
        Assert.AreEqual(buffer.Length, consumed);
        CollectionAssert.AreEqual(parsedPacket!.ControlCode.Span.ToArray(), control);
        CollectionAssert.AreEqual(parsedPacket.Payload!.Value.Span.ToArray(), payload);
    }

    [TestMethod]
    public void TryParse_PayloadNull_ShouldReturnTrue()
    {
        // Arrange
        var control = "10"u8.ToArray();
        var packet = new SocketPacket(control, null);
        var buffer = packet.ToBytes();

        // Act
        bool result = SocketPacketParser.TryParse(buffer, out int consumed, out var parsedPacket);

        // Assert
        Assert.IsTrue(result);
        Assert.IsNotNull(parsedPacket);
        Assert.AreEqual(buffer.Length, consumed);
        CollectionAssert.AreEqual(parsedPacket!.ControlCode.Span.ToArray(), control);
        Assert.IsNull(parsedPacket.Payload);
    }

    [TestMethod]
    public void TryParse_InsufficientData_ShouldReturnFalse()
    {
        // Arrange
        var buffer = new byte[] { 0xFE, 0xFE, (byte)'1' }; // 不足最小封包

        // Act
        bool result = SocketPacketParser.TryParse(buffer, out int consumed, out var parsedPacket);

        // Assert
        Assert.IsFalse(result);
        Assert.AreEqual(0, consumed);
        Assert.IsNull(parsedPacket);
    }

    [TestMethod]
    [ExpectedException(typeof(InvalidDataException))]
    public void TryParse_InvalidHeader_ShouldThrow()
    {
        // Arrange
        var buffer = new byte[] { 0x00, 0x00, (byte)'1', (byte)'0', 0, 0, 0xEF, 0xEF };

        // Act
        SocketPacketParser.TryParse(buffer, out _, out _);
    }

    [TestMethod]
    [ExpectedException(typeof(InvalidDataException))]
    public void TryParse_InvalidTrailer_ShouldThrow()
    {
        // Arrange
        var payload = Encoding.UTF8.GetBytes("A");
        var control = "10"u8.ToArray();
        var packet = new SocketPacket(control, payload);
        var buffer = packet.ToBytes();

        // Corrupt trailer
        buffer[^1] = 0x00;

        // Act
        SocketPacketParser.TryParse(buffer, out _, out _);
    }
}
