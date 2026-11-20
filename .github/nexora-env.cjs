// Managed by NexoraEdge — applies build environment variables to the job.
// Values are written with heredoc delimiters so multi-line secrets survive.
const fs = require("fs");
const raw = process.env.NEXORA_ENV_VARS || "";
if (!raw.trim()) {
  console.log("NexoraEdge: no build environment variables set");
  process.exit(0);
}
let vars;
try {
  vars = JSON.parse(raw);
} catch (err) {
  console.error("NexoraEdge: invalid environment variable payload");
  process.exit(1);
}
const githubEnv = process.env.GITHUB_ENV;
let applied = 0;
for (const [key, value] of Object.entries(vars)) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
  if (typeof value !== "string") continue;
  if (!githubEnv) {
    process.env[key] = value;
    applied++;
    continue;
  }
  fs.appendFileSync(githubEnv, key + "<<NEXORA_" + key + "\n" + value + "\nNEXORA_" + key + "\n");
  applied++;
}
console.log("NexoraEdge: applied " + applied + " environment variable(s) to the build");
