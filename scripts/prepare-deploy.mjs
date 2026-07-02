import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const deployDir = path.join(rootDir, ".deploy");

const rootFiles = [
  "ads.txt",
  "article-gift-guide.html",
  "article-home-checklist.html",
  "article-season-picks.html",
  "contact.html",
  "index.html",
  "netlify.toml",
  "privacy.html",
  "robots.txt",
  "script.js",
  "sitemap.xml",
  "styles.css",
];

const rootDirs = ["assets", "posts"];

await fs.rm(deployDir, { recursive: true, force: true });
await fs.mkdir(deployDir, { recursive: true });

for (const file of rootFiles) {
  await copyIfExists(path.join(rootDir, file), path.join(deployDir, file));
}

for (const dir of rootDirs) {
  await copyDirIfExists(path.join(rootDir, dir), path.join(deployDir, dir));
}

console.log(`[DailyPicker] 배포용 폴더 준비 완료: ${path.relative(rootDir, deployDir)}`);

async function copyIfExists(from, to) {
  try {
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(from, to);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function copyDirIfExists(from, to) {
  try {
    const entries = await fs.readdir(from, { withFileTypes: true });
    await fs.mkdir(to, { recursive: true });

    for (const entry of entries) {
      const sourcePath = path.join(from, entry.name);
      const targetPath = path.join(to, entry.name);

      if (entry.isDirectory()) {
        await copyDirIfExists(sourcePath, targetPath);
      } else if (entry.isFile()) {
        await copyIfExists(sourcePath, targetPath);
      }
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
