import { gzipSync } from "node:zlib";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, normalize, relative as pathRelative, resolve, sep } from "node:path";

const distDir = resolve(process.cwd(), "dist");
const kib = 1024;
const budgets = {
  initialJsGzip: readBudget("BUDGET_INITIAL_JS_GZIP_KIB", 240) * kib,
  largestJsGzip: readBudget("BUDGET_LARGEST_JS_GZIP_KIB", 120) * kib,
  precacheRaw: readBudget("BUDGET_PRECACHE_RAW_KIB", 2700) * kib,
};

if (!existsSync(distDir)) {
  fail("dist/ does not exist. Run the production build before checking budgets.");
}

const initialJsFiles = collectInitialJsFiles();
const allJsFiles = collectDistFiles("assets", (file) => file.endsWith(".js"));
const precacheFiles = collectPrecacheFiles();

const initialJsGzip = sumGzip(initialJsFiles);
const largestJs = largestGzip(allJsFiles);
const precacheRaw = sumRaw(precacheFiles);

printMetric("Initial JS gzip", initialJsGzip, budgets.initialJsGzip);
printMetric("Largest JS chunk gzip", largestJs.size, budgets.largestJsGzip, largestJs.file);
printMetric("Service-worker precache raw", precacheRaw, budgets.precacheRaw);

const failures = [];
if (initialJsGzip > budgets.initialJsGzip) {
  failures.push(`Initial JS gzip exceeds budget: ${formatBytes(initialJsGzip)}`);
}
if (largestJs.size > budgets.largestJsGzip) {
  failures.push(
    `Largest JS chunk exceeds budget: ${formatBytes(largestJs.size)} (${relative(largestJs.file)})`,
  );
}
if (precacheRaw > budgets.precacheRaw) {
  failures.push(`Service-worker precache exceeds budget: ${formatBytes(precacheRaw)}`);
}

if (failures.length > 0) {
  fail(failures.join("\n"));
}

function readBudget(name, fallbackKib) {
  const raw = process.env[name];
  if (!raw) return fallbackKib;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    fail(`${name} must be a positive number of KiB. Received: ${raw}`);
  }
  return parsed;
}

function collectInitialJsFiles() {
  const indexPath = join(distDir, "index.html");
  if (!existsSync(indexPath)) fail("dist/index.html does not exist.");

  const html = readFileSync(indexPath, "utf8");
  const refs = new Set();
  const refRegex = /<(?:script|link)\b[^>]+(?:src|href)="([^"]+\.js)"/g;
  let match;

  while ((match = refRegex.exec(html))) {
    refs.add(toDistPath(match[1]));
  }

  return [...refs].filter((file) => existsSync(file));
}

function collectDistFiles(subdir, predicate) {
  const dir = join(distDir, subdir);
  if (!existsSync(dir)) return [];

  return readFileTree(dir).filter(predicate);
}

function collectPrecacheFiles() {
  const swPath = join(distDir, "sw.js");
  if (!existsSync(swPath)) return [];

  const sw = readFileSync(swPath, "utf8");
  const refs = new Set();
  const urlRegex = /url:\s*["']([^"']+)["']/g;
  let match;

  while ((match = urlRegex.exec(sw))) {
    const file = toDistPath(match[1]);
    if (existsSync(file)) refs.add(file);
  }

  return [...refs];
}

function readFileTree(dir) {
  const entries = [];
  const stack = [dir];

  while (stack.length > 0) {
    const current = stack.pop();
    const children = statSync(current).isDirectory()
      ? readdirSync(current).map((name) => join(current, name))
      : [];

    for (const child of children) {
      if (statSync(child).isDirectory()) stack.push(child);
      else entries.push(child);
    }
  }

  return entries;
}

function toDistPath(url) {
  const clean = url.split("?")[0].replace(/^\/+/, "");
  const resolved = resolve(distDir, clean);
  const relativePath = pathRelative(distDir, resolved);

  if (relativePath.startsWith("..") || relativePath.includes(`..${sep}`)) {
    fail(`Refusing to read build artifact outside dist/: ${url}`);
  }

  return resolved;
}

function sumGzip(files) {
  return files.reduce((sum, file) => sum + gzipSize(file), 0);
}

function sumRaw(files) {
  return files.reduce((sum, file) => sum + statSync(file).size, 0);
}

function largestGzip(files) {
  return files.reduce(
    (largest, file) => {
      const size = gzipSize(file);
      return size > largest.size ? { file, size } : largest;
    },
    { file: "", size: 0 },
  );
}

function gzipSize(file) {
  return gzipSync(readFileSync(file)).length;
}

function printMetric(label, actual, budget, detail) {
  const suffix = detail ? ` (${relative(detail)})` : "";
  console.log(`${label}: ${formatBytes(actual)} / ${formatBytes(budget)}${suffix}`);
}

function relative(file) {
  if (!file) return "n/a";
  return normalize(file)
    .slice(normalize(process.cwd()).length + 1)
    .replace(/\\/g, "/");
}

function formatBytes(bytes) {
  return `${(bytes / kib).toFixed(2)} KiB`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
