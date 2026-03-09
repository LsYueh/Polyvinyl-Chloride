using System.Buffers;
using System.Net.Sockets;

namespace Pvc.Api.Services;

public abstract class TcpConnectionBase(string id, string host, int port) : IDisposable
{
    private readonly TcpClient _client = new();
    private NetworkStream? _stream;

    private readonly CancellationTokenSource _cts = new();
    private readonly SemaphoreSlim _sendLock = new(1, 1);
    private readonly byte[] _recvBuffer = new byte[8192];
    private readonly ArrayPool<byte> _pool = ArrayPool<byte>.Shared;

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
    protected virtual Task OnReceivedAsync(ReadOnlyMemory<byte> payload) => Task.CompletedTask;

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

    public async Task SendAsync(ReadOnlyMemory<byte> payload)
    {
        if (_stream == null)
            throw new InvalidOperationException("Not connected");

        int len = payload.Length;
        
        byte[] buffer = _pool.Rent(len + 4);

        // 大端封包長度
        buffer[0] = (byte)(len >> 24);
        buffer[1] = (byte)(len >> 16);
        buffer[2] = (byte)(len >> 8);
        buffer[3] = (byte)len;

        payload.CopyTo(buffer.AsMemory(4));

        await _sendLock.WaitAsync();

        try
        {
            await _stream.WriteAsync(buffer.AsMemory(0, len + 4));
        }
        finally
        {
            _sendLock.Release();
            _pool.Return(buffer);
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
                    if (_buffered - offset < 4) break;

                    int len =
                        (_recvBuffer[offset] << 24) |
                        (_recvBuffer[offset + 1] << 16) |
                        (_recvBuffer[offset + 2] << 8) |
                        (_recvBuffer[offset + 3]);

                    if (_buffered - offset - 4 < len) break;

                    var msg = _pool.Rent(len);
                    Buffer.BlockCopy(_recvBuffer, offset + 4, msg, 0, len);
                    await OnReceivedAsync(msg.AsMemory(0, len));
                    _pool.Return(msg);

                    offset += 4 + len;
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
                await SendAsync(ReadOnlyMemory<byte>.Empty);
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
