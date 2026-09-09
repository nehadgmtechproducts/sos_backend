import app from './app.js';
import { env } from './config/env.js';
import { ensureSessionSchema, verifyDatabaseConnection } from './store/database.store.js';

async function start() {
  await verifyDatabaseConnection();
  await ensureSessionSchema();
  app.listen(env.PORT, () => {
    console.log(`SOS API listening on http://localhost:${env.PORT}  [${env.NODE_ENV}]`);
  });
}

start().catch((error) => {
  console.error('Could not connect to PostgreSQL:', error instanceof Error ? error.message : error);
  process.exit(1);
});
