using System.Collections.Concurrent;

using Pvc.Api.Models;

namespace Pvc.Api.Services.Tcp;

public class ConnectionManager
{
    private readonly ConcurrentDictionary<string, Connection> _connections
        = new();

    public async Task Connect(string id, string host, int port)
    {
        if (_connections.ContainsKey(id))
            throw new Exception("Already connected");

        var conn = new Connection(id, host, port);

        await conn.ConnectAsync();

        _connections[id] = conn;
    }

    public async Task Send(string id, string message)
    {
        if (!_connections.TryGetValue(id, out var conn))
            throw new Exception("Device not connected");

        // 將 string 轉成 byte[]，這裡使用 UTF-8
        var payload = System.Text.Encoding.UTF8.GetBytes(message);

        await conn.SendAsync(payload);
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
            Connected = x.Value.Connected
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
            Connected = conn.Connected
        };
    }
}
