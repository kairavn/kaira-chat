export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  const { ensureDemoWebSocketServer } = await import('./lib/demo/server/demo-websocket-server');
  await ensureDemoWebSocketServer();
}
