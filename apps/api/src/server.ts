import "dotenv/config";

import { buildApp } from "./app.js";
import { loadApiConfig } from "./config.js";
import { createDatabase } from "./db/client.js";

const config = loadApiConfig();
const database = createDatabase(config.databaseUrl);
const app = buildApp({ db: database.db, config, logger: true });

app.addHook("onClose", async () => {
  await database.pool.end();
});

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
