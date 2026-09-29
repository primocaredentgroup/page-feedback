#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const githubOutput = args.includes("--github-output");
const rootArgument = args.find((argument) => !argument.startsWith("--")) ?? ".";
const root = path.resolve(rootArgument);
const stablePattern = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

function fail(message) {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function writeOutput(name, value) {
  if (!githubOutput) return;
  if (!process.env.GITHUB_OUTPUT) fail("--github-output requires GITHUB_OUTPUT");
  appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

let manifest;
let lockfile;
try {
  manifest = readJson("package.json");
  lockfile = readJson("package-lock.json");
} catch (error) {
  fail(`cannot read package.json or package-lock.json: ${error.message}`);
}

const current = manifest.version;
const lockVersion = lockfile.packages?.[""]?.version ?? lockfile.version;
if (!stablePattern.test(current)) fail(`package.json version must be stable SemVer: ${current}`);
if (lockVersion !== current) {
  fail(`package-lock.json version ${lockVersion} differs from package.json ${current}`);
}

let previous = null;
const previousResult = spawnSync("git", ["show", "HEAD^:package.json"], {
  cwd: root,
  encoding: "utf8",
});
if (previousResult.stdout?.trim()) {
  try {
    previous = JSON.parse(previousResult.stdout).version;
  } catch {
    fail("previous commit package.json is not valid JSON");
  }
}

if (previous === current) {
  console.log(`Version ${current} is unchanged; publication is a no-op.`);
  writeOutput("changed", "false");
  writeOutput("version", current);
  process.exit(0);
}

if (previous && stablePattern.test(previous)) {
  const currentParts = current.split(".").map(Number);
  const previousParts = previous.split(".").map(Number);
  const difference = currentParts.findIndex((part, index) => part !== previousParts[index]);
  if (difference >= 0 && currentParts[difference] < previousParts[difference]) {
    fail(`version downgrade ${previous} -> ${current} is not allowed`);
  }
}

console.log(`Stable release version: ${current}${previous ? ` (previous: ${previous})` : " (initial release)"}`);
writeOutput("changed", "true");
writeOutput("version", current);
