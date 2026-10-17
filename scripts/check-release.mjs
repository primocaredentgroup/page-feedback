import process from "node:process";
import console from "node:console";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
assert.equal(pkg.name, "@primocaredent/page-feedback");
assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
assert.equal(lock.name, pkg.name);
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[""].name, pkg.name);
assert.equal(lock.packages[""].version, pkg.version);
assert.equal(pkg.publishConfig.access, "public");
assert.equal(
  pkg.repository.url,
  "git+https://github.com/primocaredentgroup/page-feedback.git",
);
if (process.env.EXPECTED_VERSION)
  assert.equal(pkg.version, process.env.EXPECTED_VERSION);
for (const deps of [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
]) {
  for (const [name, spec] of Object.entries(pkg[deps] ?? {})) {
    assert.notEqual(name, pkg.name, "Self dependency");
    assert.ok(
      !/^(file:|link:|workspace:|\/|\.\.)|\.tgz$/.test(spec),
      `Local dependency: ${name}`,
    );
  }
}
for (const path of [
  "dist/client/index.js",
  "dist/client/index.d.ts",
  "dist/react/index.js",
  "dist/component/convex.config.js",
  "dist/component/_generated/component.d.ts",
  "src/component/convex.config.ts",
  "src/component/url.ts",
  "src/test.ts",
]) {
  assert.ok(existsSync(path), `Missing package export: ${path}`);
}
console.log(`Release contract OK: ${pkg.name}@${pkg.version}`);
