import { execFileSync } from "node:child_process";

const databaseName = "luna-bot-db";

function executeJson(command) {
  const output = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", databaseName, "--remote", "--json", "--command", command],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    },
  );
  return JSON.parse(output);
}

function execute(command) {
  execFileSync(
    "npx",
    ["wrangler", "d1", "execute", databaseName, "--remote", "--command", command],
    {
      cwd: process.cwd(),
      stdio: "inherit",
    },
  );
}

const result = executeJson("PRAGMA table_info(fee_ledger);");
const rows = result?.[0]?.results ?? [];
const columns = new Set(rows.map((row) => row.name));

const migrations = [
  {
    name: "settlement_batch_id",
    sql: "ALTER TABLE fee_ledger ADD COLUMN settlement_batch_id TEXT;",
  },
  {
    name: "settlement_tx_ref",
    sql: "ALTER TABLE fee_ledger ADD COLUMN settlement_tx_ref TEXT;",
  },
  {
    name: "settled_at",
    sql: "ALTER TABLE fee_ledger ADD COLUMN settled_at TEXT;",
  },
];

for (const migration of migrations) {
  if (columns.has(migration.name)) {
    console.log(`skip ${migration.name}`);
    continue;
  }
  console.log(`apply ${migration.name}`);
  execute(migration.sql);
}

execute("CREATE INDEX IF NOT EXISTS idx_fee_ledger_status_created_at ON fee_ledger (status, created_at DESC);");
console.log("fee_ledger migration complete");
