using Pvc.Api.Network;

namespace Pvc.Api.Services.Tcp;

public class Connection(string id, string host, int port) : ConnectionBase(id, host, port)
{
    protected override Task OnConnectedAsync()
    {
        Console.WriteLine($"{Id} connected to {Host}:{Port}");
        return Task.CompletedTask;
    }

    protected override Task OnDisconnectedAsync()
    {
        Console.WriteLine($"{Id} disconnected");
        return Task.CompletedTask;
    }

    protected override Task OnReceivedAsync(SocketPacket packet)
    {
        int len = packet.Payload.HasValue ? packet.Payload.Value.Span.Length : 0;
        
        Console.WriteLine($"{Id} received: {packet}");
        return Task.CompletedTask;
    }

    protected override Task OnErrorAsync(Exception ex)
    {
        Console.WriteLine($"{Id} error: {ex.Message}");
        return Task.CompletedTask;
    }
}
