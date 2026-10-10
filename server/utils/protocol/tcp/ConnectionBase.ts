import { Socket } from 'node:net';
import { SocketPacket } from '#server/utils/protocol/slm/SocketPacket';
import { ParsedPacket, SocketPacketParser } from '#server/utils/protocol/slm/SocketPacketParser'

export type SocketFactory = () => Socket;

const defaultSocketFactory: SocketFactory = () => new Socket();

export interface ConnectionOptions {
  autoReconnect?: boolean;
  reconnectDelay?: number;
  heartbeatInterval?: number;
}

export abstract class ConnectionBase {
  private socket?: Socket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private heartbeatTimer?: ReturnType<typeof setTimeout>;

  private stopped    = false;
  private connecting = false;
  private connected  = false;

  private receiveBuffer = Buffer.alloc(0);

  private sendQueue: Promise<void> = Promise.resolve();

  // 心跳 / 重連
  public autoReconnect: boolean;
  public reconnectDelay: number;
  public heartbeatInterval: number;

  protected constructor(
    public readonly id: string,
    public readonly host: string,
    public readonly port: number,
    options: ConnectionOptions = {},
    private readonly socketFactory: SocketFactory = defaultSocketFactory,
  ) {
    this.autoReconnect     = options.autoReconnect     ?? true;
    this.reconnectDelay    = options.reconnectDelay    ?? 5000;
    this.heartbeatInterval = options.heartbeatInterval ?? 45000;
  }

  public get isConnected(): boolean {
    return this.connected && this.socket?.readyState === 'open';
  }

  protected abstract createHeartbeatPacket(): Buffer;

  // Lifecycle hooks

  /** 連線成功 */
  protected async onConnected(): Promise<void> { }
  /** 斷線 */
  protected async onDisconnected(): Promise<void> { }
  /** 收到資料 */
  protected async onReceived(packet: SocketPacket): Promise<void> { }
  /** 發生例外 */
  protected async onError(error: Error): Promise<void> { }

  // Connect / Disconnect

  public async connectAsync(): Promise<void> {
    if (this.stopped) {
      throw new Error('Connection has been stopped.');
    }

    if (this.isConnected || this.connecting) {
      return;
    }

    this.connecting = true;

    const socket = this.socketFactory();
    this.socket = socket;

    this.receiveBuffer = Buffer.alloc(0);

    let wasConnected = false;

    socket.on('connect', () => {
      if (this.socket !== socket || this.stopped) {
        socket.destroy();
        return;
      }

      wasConnected = true;
      this.connected = true;
      this.connecting = false;

      void this.runHook(() => this.onConnected());
      this.scheduleHeartbeat();
    });

    socket.on('data', (data: Buffer) => {
      if (this.socket !== socket) return;

      void this.handleData(data);
    });

    socket.on('error', (error: Error) => {
      void this.runHook(() => this.onError(error));
    });

    socket.on('close', () => {
      if (this.socket !== socket) return;

      this.socket = undefined;
      this.connected = false;
      this.connecting = false;

      this.clearHeartbeat();
      this.receiveBuffer = Buffer.alloc(0);

      if (wasConnected) {
        void this.runHook(() => this.onDisconnected());
      }

      if (!this.stopped && this.autoReconnect) {
        this.scheduleReconnect();
      }
    });

    socket.connect({
      host: this.host,
      port: this.port,
    });
  }

  public disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.clearHeartbeat();

    const socket = this.socket;
    this.socket = undefined;
    this.connected = false;
    this.connecting = false;
    this.receiveBuffer = Buffer.alloc(0);

    socket?.destroy();
  }

  public dispose(): void {
    this.stopped = true;
    this.disconnect();
  }

  // 發送資料

  public sendAsync(data: Buffer): Promise<void> {
    const task = this.sendQueue.then(async () => {
      const socket = this.socket;

      if (
        !socket ||
        socket.readyState !== 'open' ||
        !this.connected
      ) {
        throw new Error('Not connected.');
      }

      await new Promise<void>((resolve, reject) => {
        socket.write(data, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    });

    // 避免單次發送失敗後，整條 Promise queue 永久失敗
    this.sendQueue = task.catch(() => { });

    return task;
  }

  // 接收 / Heartbeat / Reconnect / ...

  private async handleData(data: Buffer): Promise<void> {
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, data,]);

    while (this.receiveBuffer.length > 0) {
      let result: ParsedPacket | null;

      try {
        result = SocketPacketParser.tryParse(this.receiveBuffer);
      } catch (error) {
        await this.runHook(() =>
          this.onError(this.toError(error)),
        );

        this.socket?.destroy();
        return;
      }

      // 資料不足，等待下一次 data 事件
      if (!result) {
        break;
      }

      if (
        result.consumed <= 0 ||
        result.consumed > this.receiveBuffer.length
      ) {
        await this.runHook(() =>
          this.onError(
            new Error('Invalid parser consumed length.'),
          ),
        );

        this.socket?.destroy();
        return;
      }

      this.receiveBuffer = this.receiveBuffer.subarray(result.consumed);

      await this.runHook(() =>
        this.onReceived(result.packet),
      );
    }
  }

  private scheduleHeartbeat(): void {
    this.clearHeartbeat();

    if (this.stopped || !this.isConnected) return;

    this.heartbeatTimer = setTimeout(async () => {
      if (!this.isConnected || this.stopped) return;

      try {
        await this.sendAsync(
          this.createHeartbeatPacket(),
        );
      } catch (error) {
        await this.runHook(() =>
          this.onError(this.toError(error)),
        );

        this.socket?.destroy();
        return;
      }

      this.scheduleHeartbeat();
    }, this.heartbeatInterval);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;

      if (this.stopped) return;

      void this.connectAsync().catch((error: unknown) =>
        this.runHook(() =>
          this.onError(this.toError(error)),
        ),
      );
    }, this.reconnectDelay);
  }

  /**
   * 
   * @param callback 
   */
  private async runHook(
    callback: () => Promise<void>,
  ): Promise<void> {
    try {
      await callback();
    } catch (error) {
      console.error(
        `[${this.id}] Connection hook failed:`,
        error,
      );
    }
  }

  private toError(error: unknown): Error {
    return error instanceof Error
      ? error
      : new Error(String(error));
  }
}