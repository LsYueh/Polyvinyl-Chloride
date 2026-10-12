import { EventEmitter } from 'node:events';
import type { Socket } from 'node:net';

import {afterEach, describe, expect, it, vi,} from 'vitest';

import { ConnectionBase } from '#server/utils/protocol/tcp/ConnectionBase';
import { SocketPacketParser } from '#server/utils/protocol/slm/SocketPacketParser';
import type { SocketPacket } from '#server/utils/protocol/slm/SocketPacket';

class FakeSocket extends EventEmitter {
  public readyState: Socket['readyState'] = 'opening';
  public destroyed = false;
  public writes: Buffer[] = [];
  public writeCallbacks: Array<
    (error?: Error | null) => void
  > = [];

  public holdWriteCallbacks = false;
  public autoClose = true;
  public connectError?: Error;

  public connect(): this {
    if (this.connectError) {
      throw this.connectError;
    }

    return this;
  }

  public setConnected(): void {
    this.readyState = 'open';
    this.emit('connect');
  }

  public destroy(): this {
    if (this.destroyed) return this;

    this.destroyed = true;
    this.readyState = 'closed';

    if (this.autoClose) {
      queueMicrotask(() => this.emit('close', false));
    }

    return this;
  }

  public write(
    data: Buffer,
    callback?: (error?: Error | null) => void,
  ): boolean {
    this.writes.push(Buffer.from(data));

    if (callback) {
      if (this.holdWriteCallbacks) {
        this.writeCallbacks.push(callback);
      } else {
        queueMicrotask(() => callback());
      }
    }

    return true;
  }

  public completeWrite(error?: Error): void {
    const callback = this.writeCallbacks.shift();

    if (!callback) {
      throw new Error('No pending write callback.');
    }

    callback(error);
  }
}

class TestConnection extends ConnectionBase {
  public errors: Error[] = [];
  public receivedPackets: SocketPacket[] = [];
  public connectedCount = 0;
  public disconnectedCount = 0;

  public constructor(
    socketFactory: () => FakeSocket,
    options: {
      autoReconnect?: boolean;
      reconnectDelay?: number;
      heartbeatInterval?: number;
    } = {},
  ) {
    super(
      'test-connection',
      '127.0.0.1',
      12345,
      options,
      socketFactory as unknown as () => Socket,
    );
  }

  protected createHeartbeatPacket(): Buffer {
    return Buffer.from([0x01]);
  }

  protected override async onConnected(): Promise<void> {
    this.connectedCount++;
  }

  protected override async onDisconnected(): Promise<void> {
    this.disconnectedCount++;
  }

  protected override async onReceived(
    packet: SocketPacket,
  ): Promise<void> {
    this.receivedPackets.push(packet);
  }

  protected override async onError(error: Error): Promise<void> {
    this.errors.push(error);
  }
}

async function flushEvents(): Promise<void> {
  // 等待 Promise queue 與 close 事件完成。
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('ConnectionBase lifecycle', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should reject a pending connection when the socket errors', async () => {
    const socket = new FakeSocket();

    const connection = new TestConnection(
      () => socket,
      { autoReconnect: false },
    );

    const promise = connection.connectAsync();

    socket.emit('error', new Error('Connection failed'));

    await expect(promise).rejects.toThrow('Connection failed');

    await flushEvents();

    expect(socket.destroyed).toBe(true);
    expect(connection.isConnected).toBe(false);

    connection.dispose();
  });

  it('should reconnect after a synchronous connect failure', async () => {
    vi.useFakeTimers();

    const firstSocket = new FakeSocket();
    firstSocket.connectError = new Error('Synchronous failure');

    const secondSocket = new FakeSocket();
    const sockets = [firstSocket, secondSocket];
    const socketFactory = vi.fn(
      () => sockets.shift()!, // 每次呼叫 socketFactory 都取得下一個 Socket
    );

    const connection = new TestConnection(
      socketFactory,
      {
        autoReconnect: true,
        reconnectDelay: 1000,
      },
    );

    const promise = connection.connectAsync();

    await expect(promise).rejects.toThrow(
      'Synchronous failure',
    );

    expect(firstSocket.destroyed).toBe(true);

    await vi.advanceTimersByTimeAsync(1000);

    expect(socketFactory).toHaveBeenCalledTimes(2);

    secondSocket.setConnected();

    expect(connection.isConnected).toBe(true);

    connection.dispose();
  });

  it('should reconnect after an initial socket error', async () => {
    vi.useFakeTimers();

    const firstSocket = new FakeSocket();
    const secondSocket = new FakeSocket();
    const sockets = [firstSocket, secondSocket];

    const connection = new TestConnection(
      () => sockets.shift()!, // 每次呼叫 socketFactory 都取得下一個 Socket
      {
        autoReconnect: true,
        reconnectDelay: 1000,
      },
    );

    const promise = connection.connectAsync();

    firstSocket.emit('error', new Error('Initial error'));

    await expect(promise).rejects.toThrow('Initial error');

    await vi.advanceTimersByTimeAsync(1000);

    expect(connection.isConnected).toBe(false);

    // 第二個 Socket 已建立，模擬 TCP 連線成功。
    secondSocket.setConnected();

    expect(connection.isConnected).toBe(true);

    connection.dispose();
  });

  it('should not let an old socket close event clear a new connection', async () => {
    const firstSocket = new FakeSocket();
    firstSocket.autoClose = false;

    const secondSocket = new FakeSocket();
    const sockets = [firstSocket, secondSocket];

    const connection = new TestConnection(
      () => sockets.shift()!, // 每次呼叫 socketFactory 都取得下一個 Socket
      { autoReconnect: false },
    );

    const firstConnect = connection.connectAsync();
    firstSocket.setConnected();
    await firstConnect;

    connection.disconnect();

    const secondConnect = connection.connectAsync();
    secondSocket.setConnected();
    await secondConnect;

    // 延遲送出舊 Socket 的 close 事件。
    firstSocket.emit('close', false);

    expect(connection.isConnected).toBe(true);
    expect(connection.disconnectedCount).toBe(0);

    connection.dispose();
  });

  it('should reject queued writes belonging to an old socket', async () => {
    const firstSocket = new FakeSocket();
    firstSocket.holdWriteCallbacks = true;

    const secondSocket = new FakeSocket();
    const sockets = [firstSocket, secondSocket];

    const connection = new TestConnection(
      () => sockets.shift()!, // 每次呼叫 socketFactory 都取得下一個 Socket
      { autoReconnect: false },
    );

    const firstConnect = connection.connectAsync();
    firstSocket.setConnected();
    await firstConnect;

    const firstSend = connection.sendAsync(
      Buffer.from('first'),
    );

    // 確保第一筆已開始寫入，並卡在 write callback。
    await vi.waitFor(() => {
      expect(firstSocket.writeCallbacks).toHaveLength(1);
    });

    // 第二筆仍在佇列中，尚未取得發送機會。
    const secondSend = connection.sendAsync(
      Buffer.from('second'),
    );

    connection.disconnect();

    const secondConnect = connection.connectAsync();
    secondSocket.setConnected();
    await secondConnect;

    // 第一筆寫入完成，讓第二筆開始執行。
    firstSocket.completeWrite();

    await firstSend;

    await expect(secondSend).rejects.toThrow(
      'Not connected.',
    );

    expect(firstSocket.writes).toHaveLength(1);
    expect(secondSocket.writes).toHaveLength(0);

    connection.dispose();
  });

  it('should destroy the socket when packet parsing throws', async () => {
    const socket = new FakeSocket();

    const connection = new TestConnection(
      () => socket,
      { autoReconnect: false },
    );

    const connectPromise = connection.connectAsync();
    socket.setConnected();
    await connectPromise;

    vi.spyOn(
      SocketPacketParser,
      'tryParse',
    ).mockImplementation(() => {
      throw new Error('Invalid packet');
    });

    socket.emit('data', Buffer.from([0x00]));

    await vi.waitFor(() => {
      expect(socket.destroyed).toBe(true);
    });

    await flushEvents();

    expect(connection.errors).toContainEqual(
      expect.objectContaining({
        message: 'Invalid packet',
      }),
    );

    expect(connection.isConnected).toBe(false);

    connection.dispose();
  });

  it('should not let an old heartbeat error destroy a new socket', async () => {
    vi.useFakeTimers();

    const firstSocket = new FakeSocket();
    firstSocket.holdWriteCallbacks = true;

    const secondSocket = new FakeSocket();
    const sockets = [firstSocket, secondSocket];

    const connection = new TestConnection(
      () => sockets.shift()!,
      {
        autoReconnect: false,
        heartbeatInterval: 1000,
      },
    );

    const firstConnect = connection.connectAsync();
    firstSocket.setConnected();
    await firstConnect;

    // 觸發舊 Socket 的 Heartbeat，但不等待寫入完成。
    vi.advanceTimersByTime(1000);
    await Promise.resolve();
    await Promise.resolve();

    expect(firstSocket.writeCallbacks).toHaveLength(1);

    connection.disconnect();

    const secondConnect = connection.connectAsync();
    secondSocket.setConnected();
    await secondConnect;

    // 舊 Heartbeat 的發送回呼才回報錯誤。
    firstSocket.completeWrite(new Error('Heartbeat failed'));
    
    // 等待 Heartbeat 的 catch 區塊執行。
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(firstSocket.destroyed).toBe(true);
    expect(secondSocket.destroyed).toBe(false);
    expect(connection.isConnected).toBe(true);

    connection.dispose();
  });

  it('should not reconnect after dispose when an old socket closes', async () => {
    vi.useFakeTimers();

    const socket = new FakeSocket();
    socket.autoClose = false;

    const socketFactory = vi.fn(() => socket);

    const connection = new TestConnection(
      socketFactory,
      {
        autoReconnect: true,
        reconnectDelay: 1000,
      },
    );

    const connectPromise = connection.connectAsync();
    socket.setConnected();
    await connectPromise;

    connection.dispose();

    // 模擬 dispose 後才收到 close。
    socket.emit('close', false);

    await vi.advanceTimersByTimeAsync(5000);

    expect(socketFactory).toHaveBeenCalledTimes(1);
    expect(connection.isConnected).toBe(false);
  });
});
