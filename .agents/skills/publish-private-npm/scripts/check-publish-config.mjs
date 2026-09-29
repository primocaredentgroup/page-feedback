#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  console.log("Usage: node check-publish-config.mjs <repository> [--mode stable] [--workflow path] [--clean-install]");
  process.exit(0);
}

function option(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

const repository = args.find((argument) => !argument.startsWith("--")) ?? ".";
const requestedMode = option("--mode");
const mode = "stable";
const workflowArgument = option("--workflow");
const cleanInstall = args.includes("--clean-install");
const root = path.resolve(repository);
const failures = [];
const warnings = [];
const passes = [];

function pass(message) {
  passes.push(message);
}
function warn(message) {
  warnings.push(message);
}
function fail(message) {
  failures.push(message);
}
function readFile(relativePath) {
  return fs.readFileSync(path.resolve(root, relativePath), "utf8");
}
function has(pattern, value) {
  return pattern.test(value);
}
function isLocalSpec(spec) {
  if (typeof spec !== "string") return false;
  if (spec.startsWith("file:") || spec.startsWith("link:") || spec.startsWith("workspace:")) return true;
  if (spec.endsWith(".tgz") && !/^https?:\/\/registry\.npmjs\.org\//.test(spec)) return true;
  return spec.startsWith("./") || spec.startsWith("../") || path.isAbsolute(spec) || /^[A-Za-z]:[\\/]/.test(spec);
}
function inspectDependencyMap(section, values, packageName) {
  for (const [name, spec] of Object.entries(values ?? {})) {
    if (name === packageName) fail(`${section} contains a dependency on the package itself (${name})`);
    if (isLocalSpec(spec)) fail(`${section}.${name} uses a local/external dependency specifier: ${spec}`);
  }
}

if (requestedMode && requestedMode !== "stable") {
  fail("only the stable release policy is supported; use a committed SemVer version");
}

let manifest;
let lockfile;
try {
  manifest = JSON.parse(readFile("package.json"));
  lockfile = JSON.parse(readFile("package-lock.json"));
} catch (error) {
  console.error(`FAIL package.json or package-lock.json is missing/invalid: ${error.message}`);
  process.exit(1);
}

const packageName = manifest.name;
if (typeof packageName === "string" && /^@[^/]+\/[a-z0-9._-]+$/.test(packageName)) {
  pass(`scoped package name: ${packageName}`);
} else {
  fail("package.json name must be a valid scoped name such as @org/package");
}
if (manifest.private === true) fail("package.json has private=true, which prevents npm publication");
if (manifest.publishConfig?.access === "restricted") pass("publishConfig.access is restricted");
else fail("package.json publishConfig.access must be restricted");
if (manifest.publishConfig?.registry === "https://registry.npmjs.org/") pass("publishConfig.registry targets npmjs.org");
else fail("package.json publishConfig.registry must be https://registry.npmjs.org/");
const lockRootVersion = lockfile.packages?.[""]?.version ?? lockfile.version;
if (lockRootVersion === manifest.version) pass("package.json and package-lock.json have the same root version");
else fail(`package-lock.json root version ${lockRootVersion} differs from package.json ${manifest.version}`);
if (manifest.scripts?.verify) pass("package exposes npm run verify");
else warn("package has no verify script; ensure build, typecheck, tests, and pack checks run before publish");
if (manifest.scripts?.prepublishOnly) pass("prepublishOnly protects direct npm publish calls");
else warn("package has no prepublishOnly safety check");

for (const [section, values] of Object.entries({
  dependencies: manifest.dependencies,
  devDependencies: manifest.devDependencies,
  optionalDependencies: manifest.optionalDependencies,
  peerDependencies: manifest.peerDependencies,
})) {
  inspectDependencyMap(section, values, packageName);
}

for (const [key, entry] of Object.entries(lockfile.packages ?? {})) {
  for (const field of ["version", "resolved", "link"]) {
    if (isLocalSpec(entry?.[field])) fail(`package-lock.json ${key}.${field} uses a local/external dependency: ${entry[field]}`);
  }
}
function inspectLockedDependencies(entries, location = "package-lock.json") {
  for (const [name, entry] of Object.entries(entries ?? {})) {
    if (name === packageName) fail(`${location} contains a dependency on the package itself (${name})`);
    if (isLocalSpec(entry?.version) || isLocalSpec(entry?.resolved)) {
      fail(`${location}.${name} uses a local/external dependency`);
    }
    inspectLockedDependencies(entry?.dependencies, `${location}.${name}.dependencies`);
  }
}
inspectLockedDependencies(lockfile.dependencies);
pass("manifest and lockfile contain no local tarball/path/self dependency");

let workflowPath = workflowArgument;
if (!workflowPath) {
  for (const candidate of [".github/workflows/publish-npm.yml", ".github/workflows/publish-npm.yaml"]) {
    if (fs.existsSync(path.resolve(root, candidate))) {
      workflowPath = candidate;
      break;
    }
  }
}
if (!workflowPath) {
  fail("publish workflow not found; pass --workflow <path>");
} else {
  let workflow;
  try {
    workflow = readFile(workflowPath);
    pass(`workflow found: ${workflowPath}`);
  } catch (error) {
    fail(`cannot read workflow ${workflowPath}: ${error.message}`);
  }

  if (workflow) {
    if (has(/npm\s+publish\b/, workflow)) pass("workflow invokes npm publish");
    else fail("workflow does not invoke npm publish");
    if (has(/npm\s+publish[^\n]*--access(?:=|\s+)restricted/, workflow)) pass("publish command preserves restricted access");
    else fail("npm publish must explicitly use --access restricted");
    if (has(/npm\s+publish[^\n]*--tag(?:=|\s+)[A-Za-z][A-Za-z0-9._-]*/, workflow)) pass("publish command uses an explicit dist-tag");
    else fail("npm publish must use an explicit --tag");
    if (has(/branches:\s*[\s\S]{0,100}-\s+(main|master)\b/, workflow)) pass("workflow listens to a conventional default branch");
    else warn("could not confirm a main/master push trigger");
    if (has(/github\.event\.repository\.default_branch/, workflow)) pass("job verifies the repository default branch");
    else warn("workflow does not visibly guard against a non-default branch");
    if (has(/concurrency:/, workflow) && has(/cancel-in-progress:\s*true/, workflow)) pass("workflow cancels superseded runs");
    else warn("workflow lacks a cancel-in-progress concurrency guard");
    if (has(/remote_sha|GITHUB_SHA/, workflow) && has(/git\s+rev-parse/, workflow)) pass("workflow checks the remote branch head before publication");
    else warn("workflow does not visibly prevent an old run from publishing after a newer commit");
    if (has(/npm\s+ci\b/, workflow)) pass("workflow performs npm ci");
    else fail("workflow must perform npm ci");

    const bumpsPatch = has(/npm\s+version\s+['\"]?patch\b/, workflow) || has(/run\([\"']npm[\"'],\s*\[\s*[\"']version[\"'],\s*[\"']patch[\"']/, workflow);
    const commitsRelease = has(/git\s+commit/, workflow) || has(/run\(["']git["'],\s*\[\s*["']commit["']/, workflow);
    const pushesRelease = has(/git\s+push/, workflow) || has(/run\(["']git["'],\s*\[\s*["']push["']/, workflow);
    if (bumpsPatch && commitsRelease && pushesRelease) pass("stable workflow commits the default patch release");
    else fail("stable workflow must bump patch, commit both manifest files, and push the release commit");
    if (has(/push:\s*[\s\S]{0,160}branches:/, workflow)) pass("stable workflow runs on default-branch pushes");
    else fail("stable workflow must run on pushes to the default branch");
    if (has(/fetch-depth:\s*2/, workflow)) pass("stable workflow fetches the previous commit for version comparison");
    else fail("stable workflow must use fetch-depth: 2 or more");
    if (has(/release-version|validate-release-version/, workflow) && has(/HEAD\^:package\.json/, workflow)) pass("stable workflow compares the previous committed version");
    else fail("stable workflow must compare against the previous committed version");
    if (has(/--tag(?:=|\s+)latest/, workflow)) pass("stable workflow publishes latest");
    else fail("stable workflow must publish stable releases with --tag latest");

    const usesNpmSecret = has(/secrets\.NPM_TOKEN/, workflow);
    const mapsNodeAuth = has(/NODE_AUTH_TOKEN:\s*\$\{\{\s*secrets\.NPM_TOKEN\s*\}\}/, workflow);
    const hasOidcPermission = has(/id-token:\s*write/, workflow);
    if (has(/contents:\s*write/, workflow)) pass("workflow can push the automatic release commit");
    else fail("workflow must grant contents: write for the automatic release commit");
    if (usesNpmSecret) {
      if (mapsNodeAuth) pass("token mode maps NPM_TOKEN to NODE_AUTH_TOKEN");
      else fail("NPM_TOKEN is referenced but not mapped to NODE_AUTH_TOKEN");
    } else if (hasOidcPermission) pass("OIDC mode grants id-token: write without a publish token secret");
    else fail("workflow has neither NPM_TOKEN authentication nor Trusted Publishing id-token permission");

    const codegenIndex = workflow.indexOf("npm run codegen");
    if (codegenIndex >= 0 && String(manifest.scripts?.codegen ?? "").includes("convex codegen")) {
      const initIndex = workflow.indexOf("convex init");
      if (initIndex >= 0 && initIndex < codegenIndex && has(/CONVEX_AGENT_MODE:\s*anonymous/, workflow)) pass("Convex codegen follows anonymous initialization");
      else fail("Convex codegen requires an earlier anonymous convex init step");
    }
  }
}

const npmrcPath = path.resolve(root, ".npmrc");
if (fs.existsSync(npmrcPath)) {
  const npmrc = fs.readFileSync(npmrcPath, "utf8");
  const authLines = npmrc.split(/\r?\n/).filter((line) => line.includes("_authToken="));
  if (authLines.some((line) => !line.includes("${") && line.split("=")[1]?.trim())) fail(".npmrc appears to contain a literal auth token");
  else pass(".npmrc contains no visible literal auth token");
}

if (cleanInstall) {
  console.log("Running npm ci in the target checkout; npm ci removes any existing node_modules first.");
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["ci"], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  if (result.status !== 0) fail(`clean npm ci failed with exit code ${result.status}`);
  else pass("clean npm ci completed");
}

console.log(`Private npm publish audit (${mode ?? "policy missing"}): ${root}`);
for (const message of passes) console.log(`PASS ${message}`);
for (const message of warnings) console.log(`WARN ${message}`);
for (const message of failures) console.log(`FAIL ${message}`);
console.log(`Summary: ${passes.length} passed, ${warnings.length} warnings, ${failures.length} failed`);
process.exit(failures.length === 0 ? 0 : 1);
