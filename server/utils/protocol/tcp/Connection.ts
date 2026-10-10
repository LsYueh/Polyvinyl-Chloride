import { ConnectionBase } from "./ConnectionBase";
import { SocketPacket } from '#server/utils/protocol/slm/SocketPacket';

export class Connection extends ConnectionBase {
  constructor(id: string, host: string, port: number) {
    super(id, host, port, {
      autoReconnect: true,
      reconnectDelay: 5000,
      heartbeatInterval: 45000,
    });
  }

  protected override createHeartbeatPacket(): Buffer {
    // SLM-030 
    return SocketPacket.fromPayload('11', '').toBytes();
  }

  protected override async onConnected(): Promise<void> {
    console.log(`[${this.id}] Connected`);
  }

  protected override async onDisconnected(): Promise<void> {
    console.log(`[${this.id}] Disconnected`);
  }

  protected override async onReceived(
    packet: SocketPacket,
  ): Promise<void> {
    console.log(`[${this.id}] Packet received`, packet);
  }

  protected override async onError(error: Error): Promise<void> {
    console.error(`[${this.id}]`, error);
  }
}