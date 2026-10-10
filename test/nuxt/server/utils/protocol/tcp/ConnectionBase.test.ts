import { EventEmitter } from 'node:events';
import type { Socket } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ConnectionBase,
  type ConnectionOptions,
  type SocketFactory,
} from '#server/utils/protocol/tcp/ConnectionBase';

class FakeSocket extends EventEmitter {
  readyState: Socket['readyState'] = 'opening';

  connect = vi.fn();

  destroy = vi.fn(() => this);

  write = vi.fn();

  /** 模擬 TCP 連線成功 */
  setConnected(): void {
    this.readyState = 'open';
    this.emit('connect');
  }
}

class TestConnection extends ConnectionBase {
  public connectedHookCalled = 0;
  public disconnectedHookCalled = 0;

  constructor(
    options: ConnectionOptions = {},
    socketFactory?: SocketFactory,
  ) {
    super(
      'test-device',
      '127.0.0.1',
      9000,
      options,
      socketFactory,
    );
  }

  protected override createHeartbeatPacket(): Buffer {
    return Buffer.from('heartbeat');
  }

  protected override async onConnected(): Promise<void> {
    this.connectedHookCalled++;
  }

  protected override async onDisconnected(): Promise<void> {
    this.disconnectedHookCalled++;
  }
}

describe('ConnectionBase', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should use default connection options', () => {
    const connection = new TestConnection();

    expect(connection.id).toBe('test-device');
    expect(connection.host).toBe('127.0.0.1');
    expect(connection.port).toBe(9000);

    expect(connection.autoReconnect).toBe(true);
    expect(connection.reconnectDelay).toBe(5000);
    expect(connection.heartbeatInterval).toBe(45000);

    expect(connection.isConnected).toBe(false);

    connection.dispose();
  });

  it('should apply custom connection options', () => {
    const connection = new TestConnection({
      autoReconnect: false,
      reconnectDelay: 1000,
      heartbeatInterval: 2000,
    });

    expect(connection.autoReconnect).toBe(false);
    expect(connection.reconnectDelay).toBe(1000);
    expect(connection.heartbeatInterval).toBe(2000);

    connection.dispose();
  });

  it('should create a socket and start connecting', async () => {
    const socket = new FakeSocket();

    const socketFactory = vi.fn(
      () => socket as unknown as Socket,
    );

    const connection = new TestConnection(
      {},
      socketFactory,
    );

    // 開始連線，但尚未觸發 connect 事件
    const connectPromise = connection.connectAsync();

    // 確認已開始連線
    expect(socketFactory).toHaveBeenCalledOnce();
    expect(socket.connect).toHaveBeenCalledWith({
      host: '127.0.0.1',
      port: 9000,
    });
    expect(connection.isConnected).toBe(false);

    // 取消連線並處理預期的 Promise rejection
    connection.dispose();

    return expect(connectPromise).rejects.toThrow(
      'Connection was cancelled.',
    );
  });

  it('should resolve when connected', async () => {
    const socket = new FakeSocket();
    const connection = new TestConnection(
      {},
      () => socket as unknown as Socket,
    );

    const promise = connection.connectAsync();

    socket.setConnected();

    await expect(promise).resolves.toBeUndefined();
    expect(connection.isConnected).toBe(true);

    connection.dispose();
  });

  it('should reject when connection fails', async () => {
    const socket = new FakeSocket();
    const connection = new TestConnection(
      {},
      () => socket as unknown as Socket,
    );

    const promise = connection.connectAsync();

    socket.emit('error', new Error('Connection refused'));

    await expect(promise).rejects.toThrow('Connection refused');
    expect(connection.isConnected).toBe(false);

    connection.dispose();
  });

  it('should reject when connection is cancelled', async () => {
    const socket = new FakeSocket();
    const connection = new TestConnection(
      {},
      () => socket as unknown as Socket,
    );

    const promise = connection.connectAsync();

    connection.disconnect();

    await expect(promise).rejects.toThrow(
      'Connection was cancelled.',
    );
  });

  it('should become connected after connect event', async () => {
    const socket = new FakeSocket();

    const connection = new TestConnection(
      { autoReconnect: false },
      () => socket as unknown as Socket,
    );

    const connectPromise = connection.connectAsync();

    socket.setConnected();

    await connectPromise;

    expect(connection.isConnected).toBe(true);
    expect(connection.connectedHookCalled).toBe(1);

    connection.dispose();
  });

  it('should close the socket on disconnect', async () => {
    const socket = new FakeSocket();

    const connection = new TestConnection(
      { autoReconnect: false },
      () => socket as unknown as Socket,
    );

    const connectPromise =  connection.connectAsync();

    socket.setConnected();

    await connectPromise;

    // 中斷連線
    connection.disconnect();

    expect(socket.destroy).toHaveBeenCalledOnce();
    expect(connection.isConnected).toBe(false);

    connection.dispose();
  });

  it('should not allow reconnect after dispose', async () => {
    const socketFactory = vi.fn(
      () => new FakeSocket() as unknown as Socket,
    );

    const connection = new TestConnection(
      {},
      socketFactory,
    );

    connection.dispose();

    await expect(
      connection.connectAsync(),
    ).rejects.toThrow('Connection has been stopped.');

    expect(socketFactory).not.toHaveBeenCalled();
  });
});
