import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const env = await loadEnv(path.join(rootDir, ".env"));
const netlifySiteId = env.NETLIFY_SITE_ID || "6bb4af2f-7707-45cb-9c15-4848c3017c34";

if (dryRun) {
  run(process.execPath, ["scripts/auto-blog.mjs", "--dry-run"]);
  run(process.execPath, ["scripts/prepare-deploy.mjs"]);
  console.log(`[DailyPicker] Netlify token=${env.NETLIFY_AUTH_TOKEN ? "configured" : "missing"}`);
  console.log(`[DailyPicker] Netlify site=${netlifySiteId}`);
  process.exit(0);
}

run(process.execPath, ["scripts/auto-blog.mjs"]);
run(process.execPath, ["scripts/prepare-deploy.mjs"]);

const changedBeforeAdd = git(["status", "--porcelain"]);
if (changedBeforeAdd.trim()) {
  git(["add", "."]);

  const changedAfterAdd = git(["diff", "--cached", "--name-only"]);
  if (changedAfterAdd.trim()) {
    ensureGitIdentity();
    git(["commit", "-m", `Auto blog update ${formatLocalStamp(new Date())}`], { stdio: "inherit" });

    if (env.SKIP_GIT_PUSH === "1") {
      console.log("[DailyPicker] SKIP_GIT_PUSH=1 이라 GitHub 푸시는 건너뜁니다.");
    } else {
      git(["push", "origin", "main"], { stdio: "inherit" });
    }
  }
} else {
  console.log("[DailyPicker] GitHub에 올릴 새 변경분이 없습니다.");
}

if (!env.NETLIFY_AUTH_TOKEN) {
  console.log("[DailyPicker] NETLIFY_AUTH_TOKEN이 없어 Netlify 배포를 건너뜁니다.");
  process.exit(0);
}

if (env.SKIP_NETLIFY_DEPLOY === "1") {
  console.log("[DailyPicker] SKIP_NETLIFY_DEPLOY=1 이라 Netlify 배포는 건너뜁니다.");
  process.exit(0);
}

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
run(
  npx,
  [
    "--yes",
    "netlify-cli@latest",
    "deploy",
    "--prod",
    "--dir",
    ".deploy",
    "--site",
    netlifySiteId,
    "--auth",
    env.NETLIFY_AUTH_TOKEN,
  ],
  { stdio: "inherit" },
);

console.log("[DailyPicker] Netlify 배포까지 완료되었습니다.");

async function loadEnv(filePath) {
  const loaded = { ...process.env };

  try {
    const text = await fs.readFile(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      loaded[key] = value;
    }
  } catch {
    // Local .env is optional. GitHub Actions uses secrets and variables.
  }

  return loaded;
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: rootDir,
    env: { ...process.env, ...env },
    encoding: "utf8",
    stdio: options.stdio || "pipe",
  });

  if (result.error) {
    console.error(`[DailyPicker] 실행 실패: ${command} ${commandArgs.join(" ")}`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (result.status !== 0) {
    if (options.allowFailure) {
      return result.stdout || "";
    }
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }

  if (options.stdio === "inherit") return "";
  return result.stdout || "";
}

function git(commandArgs, options = {}) {
  return run("git", commandArgs, options);
}

function ensureGitIdentity() {
  const name = git(["config", "--get", "user.name"], { allowFailure: true }).trim();
  const email = git(["config", "--get", "user.email"], { allowFailure: true }).trim();

  if (!name) git(["config", "user.name", "DailyPicker Bot"]);
  if (!email) git(["config", "user.email", "bot@dailypicker.kr"]);
}

function formatLocalStamp(date) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}
