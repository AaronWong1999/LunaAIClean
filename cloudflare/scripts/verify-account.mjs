import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const guardPath = path.join(projectRoot, "account.guard.json");
const accountEnvPath = path.join(projectRoot, ".cf-account.env");

function fail(message) {
  console.error(`Cloudflare account guard failed: ${message}`);
  process.exit(1);
}

function parseEnvFile(content) {
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    env[key] = value;
  }
  return env;
}

async function loadProjectCfEnv() {
  if (!existsSync(accountEnvPath)) return {};
  return parseEnvFile(await readFile(accountEnvPath, "utf8"));
}

const guard = JSON.parse(await readFile(guardPath, "utf8"));
const projectCfEnv = await loadProjectCfEnv();
const wranglerEnv = {
  ...process.env,
  ...projectCfEnv,
};

const configuredAccountId =
  wranglerEnv.CLOUDFLARE_ACCOUNT_ID ||
  wranglerEnv.CF_ACCOUNT_ID;

if (configuredAccountId && configuredAccountId !== guard.expectedAccountId) {
  fail(`project account id ${configuredAccountId} does not match guard ${guard.expectedAccountId}`);
}

const whoami = spawnSync("npx", ["wrangler", "whoami", "--json"], {
  cwd: projectRoot,
  encoding: "utf8",
  env: wranglerEnv,
});

if (whoami.status !== 0) {
  fail(whoami.stderr || whoami.stdout || "wrangler whoami failed");
}

let payload;
try {
  payload = JSON.parse(whoami.stdout);
} catch {
  fail("wrangler whoami returned non-JSON output");
}

if (!payload.loggedIn) {
  fail("wrangler is not authenticated");
}

const account = Array.isArray(payload.accounts)
  ? payload.accounts.find((item) => item.id === guard.expectedAccountId)
  : undefined;

if (!account) {
  const visible = (payload.accounts || []).map((item) => `${item.name} (${item.id})`).join(", ");
  fail(`expected account ${guard.expectedAccountId} is not available. Visible accounts: ${visible || "none"}`);
}

const reportedEmail = (payload.email || "").toLowerCase();
const expectedEmail = String(guard.expectedEmail || "").toLowerCase();
const usingProjectToken = Boolean(projectCfEnv.CLOUDFLARE_API_TOKEN || projectCfEnv.CF_API_TOKEN);

if (!usingProjectToken && reportedEmail !== expectedEmail) {
  fail(`expected email ${guard.expectedEmail}, got ${payload.email}`);
}

if (account.name !== guard.expectedAccountName) {
  fail(`expected account name ${guard.expectedAccountName}, got ${account.name}`);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      project: guard.project,
      authMode: projectCfEnv.CLOUDFLARE_API_TOKEN || projectCfEnv.CF_API_TOKEN ? "project-token" : "wrangler-login",
      email: payload.email,
      accountId: account.id,
      accountName: account.name,
      accountEnvPath: existsSync(accountEnvPath) ? accountEnvPath : null,
    },
    null,
    2,
  ),
);
