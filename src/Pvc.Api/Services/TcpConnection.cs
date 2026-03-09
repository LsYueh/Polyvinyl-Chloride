namespace Pvc.Api.Services;

public class TcpConnection(string id, string host, int port) : TcpConnectionBase(id, host, port)
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

    protected override Task OnReceivedAsync(ReadOnlyMemory<byte> payload)
    {
        Console.WriteLine($"{Id} received {payload.Length} bytes");
        return Task.CompletedTask;
    }

    protected override Task OnErrorAsync(Exception ex)
    {
        Console.WriteLine($"{Id} error: {ex.Message}");
        return Task.CompletedTask;
    }
}
