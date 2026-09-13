import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import createApp from '../server/app';

export interface RunningServer {
  readonly baseUrl: string;
  close(): Promise<void>;
}

export function startTestServer(): Promise<RunningServer> {
  return new Promise((resolve) => {
    const server: Server = createApp().listen(0, () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}
