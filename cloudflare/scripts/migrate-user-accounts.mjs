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

const walletState = executeJson("PRAGMA table_info(user_wallet_state);");
const walletColumns = new Set((walletState?.[0]?.results ?? []).map((row) => row.name));
if (!walletColumns.has("status")) {
  execute("ALTER TABLE user_wallet_state ADD COLUMN status TEXT;");
}

execute(`CREATE TABLE IF NOT EXISTS user_trading_accounts (
  telegram_user_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending_link',
  auth_mode TEXT NOT NULL DEFAULT 'external_proxy',
  signature_type TEXT,
  account_label TEXT,
  signer_address TEXT,
  funder_address TEXT,
  deposit_address_evm TEXT,
  deposit_address_svm TEXT,
  deposit_address_btc TEXT,
  deposit_address_tron TEXT,
  builder_enabled INTEGER NOT NULL DEFAULT 0,
  last_verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);

const tradingAccountState = executeJson("PRAGMA table_info(user_trading_accounts);");
const tradingColumns = new Set((tradingAccountState?.[0]?.results ?? []).map((row) => row.name));
if (!tradingColumns.has("signature_type")) {
  execute("ALTER TABLE user_trading_accounts ADD COLUMN signature_type TEXT;");
}

execute(`CREATE TABLE IF NOT EXISTS user_trading_credentials (
  telegram_user_id TEXT PRIMARY KEY,
  encrypted_payload TEXT NOT NULL,
  encryption_version TEXT NOT NULL DEFAULT 'v1',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);

execute(`CREATE TABLE IF NOT EXISTS user_account_link_sessions (
  token_hash TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);

execute("CREATE INDEX IF NOT EXISTS idx_user_trading_accounts_status ON user_trading_accounts (status, updated_at DESC);");
execute("CREATE INDEX IF NOT EXISTS idx_user_account_link_sessions_user ON user_account_link_sessions (telegram_user_id, status, expires_at DESC);");
console.log("user account migration complete");
