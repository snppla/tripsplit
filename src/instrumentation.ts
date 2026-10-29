export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.SKIP_MIGRATIONS !== "true") {
    const { runMigrations } = await import("./db/migrate");
    await runMigrations();
    console.log("Database migrations applied");
  }
}
