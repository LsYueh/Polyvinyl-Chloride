using System.Buffers.Binary;
using System.Net.Sockets;
using Pvc.Api.Network;

namespace Pvc.Api.Services.Tcp;

public abstract class ConnectionBase(string id, string host, int port) : IDisposable
{
    private readonly TcpClient _client = new();
    private NetworkStream? _stream;

    private readonly CancellationTokenSource _cts = new();
    private readonly SemaphoreSlim _sendLock = new(1, 1);
    private readonly byte[] _recvBuffer = new byte[8192];

    private int _buffered;

    // 心跳 / 重連
    public bool AutoReconnect { get; set; } = true;
    public TimeSpan ReconnectDelay { get; set; } = TimeSpan.FromSeconds(5);
    public TimeSpan HeartbeatInterval { get; set; } = TimeSpan.FromSeconds(45);

    public string Id { get; } = id;
    public string Host { get; } = host;
    public int Port { get; } = port;

    public bool Connected => _client.Connected;

    #region 事件 / 可覆寫方法

    /// <summary>
    /// 連線成功
    /// </summary>
    protected virtual Task OnConnectedAsync() => Task.CompletedTask;

    /// <summary>
    /// 斷線
    /// </summary>
    protected virtual Task OnDisconnectedAsync() => Task.CompletedTask;

    /// <summary>
    /// 收到資料
    /// </summary>
    protected virtual Task OnReceivedAsync(SocketPacket packet) => Task.CompletedTask;

    /// <summary>
    /// 發生例外
    /// </summary>
    protected virtual Task OnErrorAsync(Exception ex) => Task.CompletedTask;

    #endregion

    #region Connect / Disconnect

    public async Task ConnectAsync()
    {
        await ConnectInternalAsync();
    }

    private async Task ConnectInternalAsync()
    {
        try
        {
            await _client.ConnectAsync(Host, Port);
            _stream = _client.GetStream();

            await OnConnectedAsync();

            _ = Task.Run(ReceiveLoopAsync);
            _ = Task.Run(HeartbeatLoopAsync);
        }
        catch (Exception ex)
        {
            await OnErrorAsync(ex);
            throw;
        }
    }

    public void Disconnect()
    {
        _cts.Cancel();

        try
        {
            _stream?.Close();
            _client.Close();
        }
        catch { }

        _ = OnDisconnectedAsync();
    }

    #endregion

    #region 發送資料

    public async Task SendAsync(SocketPacket packet)
    {
        if (_stream == null)
            throw new InvalidOperationException("Not connected");

        byte[] buffer = packet.ToBytes();

        await _sendLock.WaitAsync();

        try
        {
            await _stream.WriteAsync(buffer);
        }
        finally
        {
            _sendLock.Release();
        }
    }

    #endregion

    #region 接收 / Heartbeat / Reconnect

    private async Task ReceiveLoopAsync()
    {
        try
        {
            while (!_cts.IsCancellationRequested)
            {
                if (_stream == null)
                    break;

                int read = await _stream.ReadAsync(_recvBuffer.AsMemory(_buffered), _cts.Token);
                if (read == 0)
                    break;

                _buffered += read;
                int offset = 0;

                while (true)
                {
                    if (!SocketPacketParser.TryParse(
                        _recvBuffer.AsSpan(offset, _buffered - offset),
                        out int consumed,
                        out var packet))
                        break;

                    await OnReceivedAsync(packet!);

                    offset += consumed;
                }

                if (offset > 0)
                {
                    Buffer.BlockCopy(_recvBuffer, offset, _recvBuffer, 0, _buffered - offset);
                    _buffered -= offset;
                }
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception ex)
        {
            await OnErrorAsync(ex);
        }

        await OnDisconnectedAsync();

        if (AutoReconnect && !_cts.IsCancellationRequested)
        {
            await Task.Delay(ReconnectDelay);
            try
            {
                await ConnectInternalAsync();
            }
            catch { }
        }
    }

    private async Task HeartbeatLoopAsync()
    {
        while (!_cts.IsCancellationRequested)
        {
            await Task.Delay(HeartbeatInterval, _cts.Token);

            if (_client.Connected)
            {
                // SLM-030
                var packet = SocketPacket.FromPayload("11", string.Empty);
                await SendAsync(packet);
            }
        }
    }

    #endregion

    #region Dispose

    public void Dispose()
    {
        Dispose(disposing: true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (disposing)
        {
            // 釋放託管資源
            Disconnect();
            _cts.Dispose();
            _sendLock.Dispose();
        }

        // 如果有非託管資源，可在這裡釋放
    }

    #endregion

    // 選擇性加入 Finalizer，如果子類可能使用非託管資源
    // ~TcpConnectionBase()
    // {
    //     Dispose(disposing: false);
    // }
}
