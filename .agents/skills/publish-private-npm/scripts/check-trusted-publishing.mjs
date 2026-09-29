#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const packageName = option("--package");
const repository = option("--repo");
const workflow = option("--workflow");
const root = path.resolve(option("--root") ?? ".");
const registry = option("--registry") ?? "https://registry.npmjs.org/";

function fail(message, code = 1) {
  console.error(`FAIL ${message}`);
  process.exit(code);
}

if (!packageName || !repository || !workflow) {
  fail("usage: check-trusted-publishing.mjs --package @ORG/PACKAGE --repo ORG/REPOSITORY --workflow publish-npm.yml");
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
} catch (error) {
  fail(`cannot read package.json: ${error.message}`);
}

if (manifest.name !== packageName) {
  fail(`package.json name ${manifest.name} does not match --package ${packageName}`);
}

const expectedRepositoryUrl = `https://github.com/${repository}`;
const actualRepositoryUrl = String(manifest.repository?.url ?? "")
  .replace(/^git\+/, "")
  .replace(/\.git$/, "");
if (actualRepositoryUrl !== expectedRepositoryUrl) {
  fail(`repository.url must be ${expectedRepositoryUrl}; found ${manifest.repository?.url ?? "missing"}`);
}

if (path.basename(workflow) !== workflow || !/\.ya?ml$/.test(workflow)) {
  fail("--workflow must be only a .yml/.yaml filename, such as publish-npm.yml");
}

const workflowPath = path.join(root, ".github", "workflows", workflow);
if (!existsSync(workflowPath)) fail(`workflow not found at .github/workflows/${workflow}`);
const workflowText = readFileSync(workflowPath, "utf8");

if (!/contents:\s*write/.test(workflowText)) fail("workflow is missing contents: write for the automatic patch commit");
if (!/id-token:\s*write/.test(workflowText)) fail("workflow is missing id-token: write");
if (!/runs-on:\s*(ubuntu|windows|macos)-latest/.test(workflowText) || /self-hosted/.test(workflowText)) {
  fail("Trusted Publishing requires a GitHub-hosted runner");
}
if (/NODE_AUTH_TOKEN:[\s\S]{0,100}secrets\.NPM_TOKEN/.test(workflowText)) {
  fail("OIDC workflow still maps NPM_TOKEN to NODE_AUTH_TOKEN");
}
if (!/npm\s+publish[^\n]*--access(?:=|\s+)restricted/.test(workflowText)) {
  fail("workflow must publish with --access restricted");
}
if (!/npm\s+publish[^\n]*--tag(?:=|\s+)latest/.test(workflowText)) {
  fail("stable OIDC workflow must publish with --tag latest");
}

function run(command, commandArgs) {
  return spawnSync(command, commandArgs, {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const whoami = run("npm", ["whoami", "--registry", registry]);
if (whoami.status !== 0) {
  fail("npm whoami failed (usually E401); run npm login --scope=@ORG --registry=https://registry.npmjs.org/ before continuing", 2);
}
console.log("PASS npm identity is authenticated");

const view = run("npm", ["view", packageName, "version", "--json", "--registry", registry]);
if (view.status !== 0 || !view.stdout.trim()) {
  fail("npm view could not confirm the package exists; do not configure Trusted Publishing yet", 2);
}
console.log(`PASS package is visible in the registry: ${packageName}`);

const nodeVersion = process.versions.node.split(".").map(Number);
if (nodeVersion[0] < 22 || (nodeVersion[0] === 22 && nodeVersion[1] < 14)) {
  fail(`Node ${process.versions.node} is too old; Trusted Publishing requires Node 22.14+`);
}

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const trustHelp = run(npxCommand, ["--yes", "npm@11.15.0", "trust", "--help"]);
if (trustHelp.status !== 0) {
  fail("could not verify npm@11.15.0 trust support; do not propose the npm trust command", 2);
}
console.log("PASS npm@11.15.0 exposes npm trust");
console.log("PASS account-level 2FA and package write permission must still be confirmed by npm");
console.log(`Ready (external mutation not executed): npx --yes npm@11.15.0 trust github ${packageName} --repo ${repository} --file ${workflow} --allow-publish`);
