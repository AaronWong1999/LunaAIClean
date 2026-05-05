import { spawn } from "node:child_process";

const mode = process.argv[2] ?? "build";
const steps = mode === "deploy"
  ? [
      ["node", "scripts/guarded-run.mjs", "wrangler", "deploy", "--config", "wrangler.jsonc"],
      ["node", "scripts/guarded-run.mjs", "wrangler", "deploy", "--config", "wrangler.app.jsonc"],
    ]
  : [
      ["node", "scripts/guarded-run.mjs", "wrangler", "deploy", "--dry-run", "--config", "wrangler.jsonc"],
      ["node", "scripts/guarded-run.mjs", "wrangler", "deploy", "--dry-run", "--config", "wrangler.app.jsonc"],
    ];

for (const step of steps) {
  await run(step[0], step.slice(1));
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      cwd: process.cwd(),
      env: process.env,
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
    child.on("error", reject);
  });
}
