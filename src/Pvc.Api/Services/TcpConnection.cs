using System.Net.Sockets;
using System.Text;

namespace Pvc.Api.Services;

public class TcpConnection(string id, string host, int port)
{
    public string Id { get; } = id;

    private TcpClient? _client;
    private NetworkStream? _stream;

    private readonly string _host = host;
    private readonly int _port = port;

    public bool IsConnected => _client?.Connected ?? false;

    public string Host => _host;
    public int Port => _port;

    public async Task Connect()
    {
        _client = new TcpClient();
        await _client.ConnectAsync(_host, _port);

        _stream = _client.GetStream();
    }

    public async Task Send(string message)
    {
        if (_stream == null)
            throw new Exception("Not connected");

        var data = Encoding.UTF8.GetBytes(message);
        await _stream.WriteAsync(data);
    }

    public void Disconnect()
    {
        _stream?.Close();
        _client?.Close();
    }
}
