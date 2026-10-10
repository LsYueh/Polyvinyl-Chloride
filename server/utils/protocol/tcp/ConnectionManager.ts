import { Connection } from './Connection';
import { SocketPacket } from '#server/utils/protocol/slm/SocketPacket';

export interface DeviceStatus {
  id: string;
  host: string;
  port: number;
  connected: boolean;
}

export class TcpConnectionManager {
  private readonly _connections = new Map<string, Connection>();

  public register(
    id: string,
    host: string,
    port: number,
  ): void {
    if (this._connections.has(id)) {
      throw new Error(`Connection already registered: ${id}`);
    }

    this._connections.set(
      id,
      new Connection(id, host, port),
    );
  }

  public async connect(id: string): Promise<void> {
    const conn = this._getConnection(id);

    if (conn.isConnected) {
      return;
    }

    await conn.connectAsync();
  }

  public async connectAll(): Promise<void> {
    const results = await Promise.allSettled(
      [...this._connections.values()].map(
        conn => conn.connectAsync(),
      ),
    );

    const errors = results
      .filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      )
      .map(result => result.reason);

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        'One or more connections failed',
      );
    }
  }

  public async send(
    id: string,
    message: string,
  ): Promise<void> {
    const conn = this._connections.get(id);

    if (!conn) {
      throw new Error(`Device not found: ${id}`);
    }

    if (!conn.isConnected) {
      throw new Error(`Device is not connected: ${id}`);
    }

    // SLM-020，Control Code = "00"
    const packet = SocketPacket.fromPayload('00', message);

    await conn.sendAsync(packet.toBytes());
  }

  public disconnect(id: string): void {
    const conn = this._connections.get(id);

    if (!conn) {
      return;
    }

    this._connections.delete(id);
    conn.disconnect();
  }

  public disconnectAll(): void {
    const connections = [...this._connections.values()];
    this._connections.clear();

    for (const conn of connections) {
      conn.disconnect();
    }
  }

  public unregister(id: string): void {
    const conn = this._connections.get(id);

    if (!conn) {
      return;
    }

    this._connections.delete(id);
    conn.dispose();
  }

  public getConnections(): string[] {
    return [...this._connections.keys()];
  }

  public getStatus(): DeviceStatus[] {
    return [...this._connections.values()].map(conn => ({
      id: conn.id,
      host: conn.host,
      port: conn.port,
      connected: conn.isConnected,
    }));
  }

  public getDeviceStatus(id: string): DeviceStatus | undefined {
    const conn = this._connections.get(id);

    if (!conn) {
      return undefined;
    }

    return {
      id: conn.id,
      host: conn.host,
      port: conn.port,
      connected: conn.isConnected,
    };
  }

  public dispose(): void {
    this.disconnectAll();
  }

  private _getConnection(id: string): Connection {
    const conn = this._connections.get(id);

    if (!conn) {
      throw new Error(`Device not registered: ${id}`);
    }

    return conn;
  }
}
