// Computes the next calendar version (YYYY.MM.DD.N, N = release number of the
// day, UTC) for commits since the last v* tag, prepends a CHANGELOG.md entry and
// writes VERSION. Every push with new commits yields a release.
// Usage: node scripts/release.mjs [--dry-run]
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
for (const { subject } of commits) {
  const m = /^(\w+)(\([^)]*\))?(!)?:\s*(.+)$/.exec(subject);
  const type = m && SECTIONS.some(([k]) => k === m[1]) ? m[1] : "other";
  const text = m && type !== "other" ? m[4] : subject;
  if (!grouped.has(type)) grouped.set(type, []);
  grouped.get(type).push(text.charAt(0).toUpperCase() + text.slice(1));
}

const date = new Date().toISOString().slice(0, 10);
const day = date.replaceAll("-", ".");
const sameDay = git("tag", "--list", `v${day}.*`)
  .split("\n")
  .map((t) => Number(t.slice(`v${day}.`.length)))
  .filter(Number.isInteger);
const version = `${day}.${Math.max(0, ...sameDay) + 1}`;

const notes = SECTIONS.filter(([k]) => grouped.has(k))
  .map(([k, title]) => `### ${title}\n\n${grouped.get(k).map((t) => `- ${t}`).join("\n")}`)
  .join("\n\n");
const entry = `## [${version}] - ${date}\n\n${notes}\n`;

console.log(`${lastTag || "(none)"} -> v${version} (${commits.length} commits)\n\n${entry}`);
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

writeFileSync("version.json", JSON.stringify({ version }, null, 2) + "\n");

if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `version=${version}\n`);
