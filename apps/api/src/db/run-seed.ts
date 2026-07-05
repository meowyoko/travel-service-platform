import "dotenv/config";

import { loadApiConfig } from "../config.js";
import { createDatabase } from "./client.js";
import { seedDatabase } from "./seed.js";

const config = loadApiConfig();
const database = createDatabase(config.databaseUrl);

try {
  await seedDatabase(database.db);
  console.log("Mock 种子数据写入完成");
} finally {
  await database.pool.end();
}
