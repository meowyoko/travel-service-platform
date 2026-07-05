import "dotenv/config";

import { loadApiConfig } from "../config.js";
import { createDatabase } from "./client.js";
import { migrateDatabase } from "./migrate.js";

const config = loadApiConfig();
const database = createDatabase(config.databaseUrl);

try {
  await migrateDatabase(database.db);
  console.log("数据库迁移完成");
} finally {
  await database.pool.end();
}
