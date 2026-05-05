import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(process.cwd(), "..");
const envPath = path.join(projectRoot, ".env");
const outputPath = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : path.resolve(process.cwd(), "secrets.json");

const raw = fs.readFileSync(envPath, "utf8");
const values = Object.fromEntries(
  raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx), line.slice(idx + 1)];
    }),
);

const filtered = Object.fromEntries(
  Object.entries({
    TELEGRAM_BOT_TOKEN: values.TELEGRAM_BOT_TOKEN,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    INTERNAL_ADMIN_SECRET: process.env.INTERNAL_ADMIN_SECRET,
    POLYMARKET_PRIVATE_KEY: values.POLYMARKET_PRIVATE_KEY,
    POLYMARKET_API_KEY: values.POLYMARKET_API_KEY,
    POLYMARKET_API_SECRET: values.POLYMARKET_API_SECRET,
    POLYMARKET_API_PASSPHRASE: values.POLYMARKET_API_PASSPHRASE,
    POLYMARKET_FUNDER_ADDRESS: values.POLYMARKET_FUNDER_ADDRESS,
    POLYMARKET_USER_ADDRESS: values.POLYMARKET_USER_ADDRESS,
  }).filter(([, value]) => typeof value === "string" && value.length > 0),
);

fs.writeFileSync(outputPath, `${JSON.stringify(filtered, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
