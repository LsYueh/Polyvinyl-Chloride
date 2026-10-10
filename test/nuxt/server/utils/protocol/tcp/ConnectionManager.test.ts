import { describe, expect, it } from 'vitest'
import { ConnectionManager } from '#server/utils/protocol/tcp/ConnectionManager'

describe('TCP Connection Manager', () => {
    it('should register a device', () => {
        const manager = new ConnectionManager();

        manager.register('device-01', '127.0.0.1', 9000);

        expect(manager.getConnections()).toContain('device-01');

        expect(manager.getDeviceStatus('device-01')).toEqual({
            id: 'device-01',
            host: '127.0.0.1',
            port: 9000,
            connected: false,
        });

        manager.dispose();
    });

    it('should reject duplicate registration', () => {
        const manager = new ConnectionManager();

        manager.register('device-01', '127.0.0.1', 9000);

        expect(() => {
            manager.register('device-01', '127.0.0.1', 9001);
        }).toThrow('Connection already registered: device-01');

        manager.dispose();
    });
});