using System.Collections.Concurrent;

using Pvc.Api.Models;
using Pvc.Api.Network;

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

        // SLM-020
        var packet = SocketPacket.FromPayload("00", message);

        await conn.SendAsync(packet);
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
