import { writeFile } from 'node:fs/promises';
import { buildApp } from '../src/app.js';

const { app } = await buildApp({
  database: async () => {},
  storage: async () => {},
  timeoutMs: 1000,
});
await app.ready();
await writeFile(
  new URL('../openapi.json', import.meta.url),
  JSON.stringify(app.swagger(), null, 2) + '\n',
);
await app.close();
