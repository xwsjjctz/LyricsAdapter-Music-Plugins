import type { PluginHost, PluginLogger } from './sdk';
let host: PluginHost;
export function configureHost(value: PluginHost): void { host = value; }
export const logger: PluginLogger = {
  debug: (...args) => host.logger.debug(...args), info: (...args) => host.logger.info(...args),
  warn: (...args) => host.logger.warn(...args), error: (...args) => host.logger.error(...args),
};
// Transport registration is private to the plugin; it never registers Electron IPC.
type Handler = (event: undefined, ...args: any[]) => unknown;
const handlers = new Map<string, Handler>();
export const ipcMain = { handle(action: string, handler: Handler): void { handlers.set(action, handler); } };
export async function invoke(action: string, args: unknown[]): Promise<unknown> {
  const handler = handlers.get(action);
  if (!handler) throw new Error(`Unsupported plugin action: ${action}`);
  return handler(undefined, ...args);
}
