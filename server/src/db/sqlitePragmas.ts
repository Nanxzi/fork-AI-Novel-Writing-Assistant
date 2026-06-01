import Database from "better-sqlite3";

export interface SqliteRuntimePragmaOptions {
  busyTimeoutMs: number;
}

export function configureSqliteRuntimePragmas(
  databasePath: string,
  options: SqliteRuntimePragmaOptions,
): void {
  if (process.env.SQLITE_ENABLE_WAL === "false") {
    return;
  }

  const database = new Database(databasePath);
  try {
    database.pragma(`busy_timeout = ${Math.max(0, options.busyTimeoutMs)}`);
    const journalMode = database.pragma("journal_mode = WAL", { simple: true });
    database.pragma("synchronous = NORMAL");
    database.pragma("wal_autocheckpoint = 1000");
    if (journalMode !== "wal") {
      console.warn(`[sqlite] expected WAL journal mode, got ${JSON.stringify(journalMode)}.`);
    }
  } finally {
    database.close();
  }
}
