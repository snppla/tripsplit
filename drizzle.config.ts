import { loadDevEnv } from "./scripts/load-env";
import { defineConfig } from "drizzle-kit";

// Pick up DATABASE_URL from .env.development etc., as Next does.
loadDevEnv();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
