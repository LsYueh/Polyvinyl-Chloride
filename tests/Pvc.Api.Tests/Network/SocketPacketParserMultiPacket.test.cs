using System.Text;
using Pvc.Api.Network;

namespace Pvc.Api.Tests.Network;

[TestClass]
public class SocketPacketParserMultiPacketTest
{
    [TestMethod]
    public void TryParse_MultiplePacketsWithPartialEnd_ShouldParseCorrectly()
    {
        // Arrange: 三個封包
        var control = "10"u8.ToArray();
        var packet1 = new SocketPacket(control, Encoding.UTF8.GetBytes("Hello"));
        var packet2 = new SocketPacket(control, Encoding.UTF8.GetBytes("World"));
        var packet3 = new SocketPacket(control, Encoding.UTF8.GetBytes("!"));

        // 生成完整 byte[] 流
        var fullStream = packet1.ToBytes()
            .Concat(packet2.ToBytes())
            .Concat(packet3.ToBytes())
            .ToArray();

        // 模擬接收，每次拿隨機長度片段（模擬 TCP 粘包 / 斷包）
        int cursor = 0;
        byte[] buffer = []; // buffer 用來累積未解析的資料
        var parsedPackets = new List<SocketPacket>();

        var rand = new Random(1234);
        while (cursor < fullStream.Length)
        {
            // 模擬每次接收 1~10 bytes
            int chunkSize = Math.Min(rand.Next(1, 11), fullStream.Length - cursor);
            var chunk = new byte[buffer.Length + chunkSize];
            buffer.CopyTo(chunk, 0);
            Array.Copy(fullStream, cursor, chunk, buffer.Length, chunkSize);
            cursor += chunkSize;

            buffer = chunk;

            // TryParse 迴圈解析
            int offset = 0;
            while (offset < buffer.Length)
            {
                if (!SocketPacketParser.TryParse(buffer.AsSpan(offset), out int consumed, out var packet))
                    break;

                parsedPackets.Add(packet!);
                offset += consumed;
            }

            // 剩餘未解析的資料保留
            buffer = buffer.AsSpan(offset).ToArray();
        }

        // Assert
        Assert.AreEqual(3, parsedPackets.Count);
        CollectionAssert.AreEqual(parsedPackets[0].Payload!.Value.ToArray(), Encoding.UTF8.GetBytes("Hello"));
        CollectionAssert.AreEqual(parsedPackets[1].Payload!.Value.ToArray(), Encoding.UTF8.GetBytes("World"));
        CollectionAssert.AreEqual(parsedPackets[2].Payload!.Value.ToArray(), Encoding.UTF8.GetBytes("!"));

        // 最後 buffer 應該空
        Assert.AreEqual(0, buffer.Length);
    }
}