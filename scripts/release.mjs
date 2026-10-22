// Computes the next version from commits since the last v* tag, prepends a
// CHANGELOG.md entry and bumps package.json / package-lock.json.
// Every push with new commits yields a release: feat -> minor, breaking -> major,
// anything else -> patch. Usage: node scripts/release.mjs [--dry-run]
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const dry = process.argv.includes("--dry-run");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

let lastTag = "";
try {
  lastTag = git("describe", "--tags", "--abbrev=0", "--match", "v*");
} catch {
  // no tag yet: treat all history as new, base version from package.json
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const base = (lastTag ? lastTag.slice(1) : pkg.version).split(".").map(Number);

const raw = git("log", lastTag ? `${lastTag}..HEAD` : "HEAD", "--format=%s%x1f%b%x1e");
const commits = raw
  .split("\x1e")
  .map((c) => c.trim())
  .filter(Boolean)
  .map((c) => {
    const [subject, body = ""] = c.split("\x1f");
    return { subject: subject.trim(), body };
  })
  .filter((c) => !c.subject.startsWith("chore(release)"));

if (commits.length === 0) {
  console.log("No new commits since " + (lastTag || "start") + ", nothing to release.");
  process.exit(0);
}

const SECTIONS = [
  ["feat", "Features"],
  ["fix", "Fixes"],
  ["perf", "Performance"],
  ["refactor", "Refactoring"],
  ["docs", "Documentation"],
  ["other", "Changes"],
];
const grouped = new Map();
let bump = "patch";
for (const { subject, body } of commits) {
  const m = /^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/.exec(subject);
  const type = m && SECTIONS.some(([k]) => k === m[1]) ? m[1] : "other";
  const text = m && type !== "other" ? m[4] : subject;
  if ((m && m[3]) || /^BREAKING CHANGE:/m.test(body)) bump = "major";
  else if (type === "feat" && bump !== "major") bump = "minor";
  if (!grouped.has(type)) grouped.set(type, []);
  grouped.get(type).push(text.charAt(0).toUpperCase() + text.slice(1));
}

let [maj, min, pat] = base;
if (bump === "major") [maj, min, pat] = [maj + 1, 0, 0];
else if (bump === "minor") [min, pat] = [min + 1, 0];
else pat += 1;
const version = `${maj}.${min}.${pat}`;
const date = new Date().toISOString().slice(0, 10);

const notes = SECTIONS.filter(([k]) => grouped.has(k))
  .map(([k, title]) => `### ${title}\n\n${grouped.get(k).map((t) => `- ${t}`).join("\n")}`)
  .join("\n\n");
const entry = `## [${version}] - ${date}\n\n${notes}\n`;

console.log(`${lastTag || "(none)"} -> v${version} (${bump}, ${commits.length} commits)\n\n${entry}`);
if (dry) process.exit(0);

const HEADER = "# Changelog\n\nAll notable changes to AutopilotSnap. Generated on every push to `main` by `scripts/release.mjs`.\n";
let log = "";
try {
  log = readFileSync("CHANGELOG.md", "utf8");
} catch {
  // first run
}
const rest = log.includes("\n## [") ? log.slice(log.indexOf("\n## [") + 1) : "";
writeFileSync("CHANGELOG.md", `${HEADER}\n${entry}${rest ? "\n" + rest : ""}`);
writeFileSync("release-notes.md", notes + "\n");

pkg.version = version;
writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
lock.version = version;
if (lock.packages?.[""]) lock.packages[""].version = version;
writeFileSync("package-lock.json", JSON.stringify(lock, null, 2) + "\n");

if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
