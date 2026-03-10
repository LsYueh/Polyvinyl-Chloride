using System.Text;
using Pvc.Api.Network;

namespace Pvc.Api.Tests.Network;

[TestClass]
public class SocketPacketParserFragmentTest
{
    [DataTestMethod]
    [DataRow(5, DisplayName = "不完整封包"), ]
    [DataRow(SocketProtocol.MinPacketSize+1, DisplayName = "完整的 SLM Header + 不完整的 Body")]
    public void TryParse_FragmentedPacket_ShouldWaitUntilComplete(int splitIndex)
    {
        // Arrange
        var payload = Encoding.UTF8.GetBytes("HelloWorld");
        var control = "10"u8.ToArray();
        var packet = new SocketPacket(control, payload);
        var fullBuffer = packet.ToBytes();

        // 模擬拆成兩段接收
        var fragment1 = fullBuffer.AsSpan(0, splitIndex).ToArray();
        var fragment2 = fullBuffer.AsSpan(splitIndex).ToArray();

        // Act & Assert

        // 先解析 fragment1 → 不足封包，應返回 false
        bool result1 = SocketPacketParser.TryParse(fragment1, out int consumed1, out var parsed1);
        Assert.IsFalse(result1);
        Assert.AreEqual(0, consumed1);
        Assert.IsNull(parsed1);

        // 合併 fragment1 + fragment2
        var combined = new byte[fragment1.Length + fragment2.Length];
        Buffer.BlockCopy(fragment1, 0, combined, 0, fragment1.Length);
        Buffer.BlockCopy(fragment2, 0, combined, fragment1.Length, fragment2.Length);

        // 再解析 → 完整封包應返回 true
        bool result2 = SocketPacketParser.TryParse(combined, out int consumed2, out var parsed2);
        Assert.IsTrue(result2);
        Assert.IsNotNull(parsed2);
        Assert.AreEqual(combined.Length, consumed2);
        CollectionAssert.AreEqual(parsed2!.ControlCode.Span.ToArray(), control);
        CollectionAssert.AreEqual(parsed2.Payload!.Value.Span.ToArray(), payload);
    }
}
