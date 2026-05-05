import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const accountEnvPath = path.join(projectRoot, ".cf-account.env");

const [, , command, ...args] = process.argv;

if (!command) {
  console.error("Usage: node scripts/guarded-run.mjs <command> [...args]");
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

const projectCfEnv = existsSync(accountEnvPath)
  ? parseEnvFile(readFileSync(accountEnvPath, "utf8"))
  : {};

const childEnv = {
  ...process.env,
  ...projectCfEnv,
};

const verify = spawnSync(process.execPath, [path.join(__dirname, "verify-account.mjs")], {
  cwd: projectRoot,
  stdio: "inherit",
  env: childEnv,
});

if (verify.status !== 0) {
  process.exit(verify.status ?? 1);
}

let executable = command;
let finalArgs = args;

if (command === "wrangler") {
  executable = "npx";
  finalArgs = ["wrangler", ...args];
} else if (command === "node") {
  executable = process.execPath;
}

const child = spawnSync(executable, finalArgs, {
  cwd: projectRoot,
  stdio: "inherit",
  env: childEnv,
});

process.exit(child.status ?? 1);
