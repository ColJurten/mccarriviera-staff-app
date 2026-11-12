import { buildApp } from './app.js';
import { readConfig } from './config.js';
import { createDatabase } from './db.js';
import { createStorage } from './storage.js';
import { createAuthentication } from './auth.js';

try {
  const config = readConfig();
  const database = createDatabase(
    config.DATABASE_URL,
    config.HEALTH_TIMEOUT_MS,
  );
  const storage = createStorage(config);
  const { app } = await buildApp({
    database: database.probe,
    storage: storage.probe,
    timeoutMs: config.HEALTH_TIMEOUT_MS,
    trustedProxyIp: config.TRUSTED_PROXY_IP,
    auth: createAuthentication(database.db, config),
  });
  app.addHook('onClose', async () => {
    await database.close();
    storage.close();
  });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void app.close();
    });
  }
  // Fastify's listen message is a fixed bound address, never configuration URLs.
  await app.listen({ host: '0.0.0.0', port: config.API_PORT });
} catch {
  process.stderr.write('{"level":50,"event":"startup_failed"}\n');
  process.exitCode = 1;
}
