using System.Collections.Concurrent;

using Pvc.Api.Models;

namespace Pvc.Api.Services;

public class TcpConnectionManager
{
    private readonly ConcurrentDictionary<string, TcpConnection> _connections
        = new();

    public async Task Connect(string id, string host, int port)
    {
        if (_connections.ContainsKey(id))
            throw new Exception("Already connected");

        var conn = new TcpConnection(id, host, port);

        await conn.Connect();

        _connections[id] = conn;
    }

    public async Task Send(string id, string message)
    {
        if (!_connections.TryGetValue(id, out var conn))
            throw new Exception("Device not connected");

        await conn.Send(message);
    }

    public void Disconnect(string id)
    {
        if (_connections.TryRemove(id, out var conn))
        {
            conn.Disconnect();
        }
    }

    public List<string> GetConnections()
    {
        return [.. _connections.Keys];
    }

    public List<DeviceStatus> GetStatus()
    {
        return [.. _connections.Select(x => new DeviceStatus
        {
            Id = x.Key,
            Host = x.Value.Host,
            Port = x.Value.Port,
            Connected = x.Value.IsConnected
        })];
    }

    public DeviceStatus? GetDeviceStatus(string id)
    {
        if (!_connections.TryGetValue(id, out var conn))
            return null;

        return new DeviceStatus
        {
            Id = id,
            Host = conn.Host,
            Port = conn.Port,
            Connected = conn.IsConnected
        };
    }
}
