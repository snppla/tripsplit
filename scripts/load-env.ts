import { existsSync } from "node:fs";

/**
 * Loads the same dev env files Next does, for scripts that run outside Next.
 * Earlier files win, and real environment variables beat both.
 */
export function loadDevEnv() {
  for (const file of [".env.development.local", ".env.local", ".env.development", ".env"]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}
