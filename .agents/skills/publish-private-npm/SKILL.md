---
name: publish-private-npm
description: Configure, audit, and operate GitHub Actions workflows that publish private scoped npm packages, including reusable Convex components. Use when setting up npm Trusted Publishing/OIDC or bootstrap tokens, preparing stable SemVer releases, validating clean npm installs and local dependencies, comparing release versions, monitoring runs, or troubleshooting private-package publication.
---

# Publish private npm packages

Set up a least-privilege stable-release path from a repository to a private npm organization package. Preserve existing changes, never expose credentials, and do not publish or change npm settings without explicit authorization.

## Stable release policy

Use stable SemVer releases only. The default release bump is `patch`; use `minor` or `major` only when the user explicitly runs the corresponding command:

```bash
npm version patch --no-git-tag-version  # default, for a fix
npm version minor --no-git-tag-version  # explicit, for a backwards-compatible feature
npm version major --no-git-tag-version  # explicit, for a breaking change
```

`package.json` and `package-lock.json` are the source of truth after the workflow's release commit. When the incoming commit leaves the version unchanged, the runner executes `npm version patch --no-git-tag-version`, commits both manifest files, and publishes that committed patch. When the incoming commit already changed the version, the runner respects the explicit `minor` or `major` bump and does not apply another patch.

Read [references/versioning.md](references/versioning.md) and use the matching template:

- OIDC: [assets/publish-oidc-stable.yml](assets/publish-oidc-stable.yml)
- Bootstrap/fallback token: [assets/publish-token-bootstrap.yml](assets/publish-token-bootstrap.yml)

## Discover and validate the repository

1. Read `package.json`, `package-lock.json`, `.npmrc*`, `.gitignore`, and `.github/workflows/*`.
2. For a Convex component, read the repository's Convex instructions before changing component code. Keep the anonymous `convex init` step before CI codegen.
3. Resolve the npm scope, package name, GitHub owner/repository, default branch, workflow filename, Node/npm versions, and whether the package already exists.
4. Inspect every `dependencies`, `devDependencies`, `optionalDependencies`, and `peerDependencies` entry. Reject `file:`, `.tgz`, absolute paths, `../` paths, external workspace paths, and a dependency whose name equals the package itself. Inspect the lockfile too; a clean checkout must not rely on an ignored tarball or local path.
5. Run a real clean install from a disposable clean checkout or worktree. `npm ci` must start without `node_modules` and must use the committed lockfile; do not replace this with `npm install`.
6. Use the bundled stable-release audit:

```bash
node <skill-dir>/scripts/check-publish-config.mjs . --clean-install
```

The `--clean-install` option is allowed to remove only the target checkout's `node_modules` and runs `npm ci`; never aim it at a broad directory.

## Authenticate safely

Read [references/authentication.md](references/authentication.md) before changing npm or GitHub credentials.

For an existing package on a GitHub-hosted runner, prefer Trusted Publishing/OIDC. Before proposing the CLI configuration command, run exactly:

```bash
npx --yes npm@11.15.0 trust --help
```

Distinguish the versions:

- npm CLI `11.5.1+` and Node `22.14+` are sufficient for publishing through OIDC;
- npm CLI `11.15.0+` is required for the management command `npm trust`.

Authenticate and establish package visibility before diagnosing existence:

```bash
npm whoami
npm view @ORG/PACKAGE version --json
```

If `npm whoami` returns `E401`, stop and ask the user to authenticate first:

```bash
npm login --scope=@ORG --registry=https://registry.npmjs.org/
```

Do not interpret a private-package 404 until authenticated. Verify the package exists, account 2FA and write permission, repository URL, hosted runner, `contents: write`, `id-token: write`, and workflow filename before configuring trust.

Use a granular write token only for the first publication, unsupported providers, or an explicit fallback. Use a separate read-only token for installing private dependencies. After one successful OIDC publication, remove `NPM_TOKEN` and revoke the bootstrap token.

## Implement stable releases

Copy [assets/publish-oidc-stable.yml](assets/publish-oidc-stable.yml) to `.github/workflows/publish-npm.yml` and replace `@YOUR_NPM_ORG`.

The stable workflow must:

- trigger on pushes to the default branch so a normal source push can receive the default patch bump;
- fetch enough history to compare the current version with the previous commit;
- ensure package and lockfile versions match;
- accept only stable SemVer and reject downgrade or prerelease values;
- run `npm version patch --no-git-tag-version` when the committed version is unchanged;
- preserve an explicit committed `minor` or `major` version without applying another bump;
- commit and push the automatic patch together with `package.json` and `package-lock.json`;
- run `npm ci`, build, typecheck, tests, and pack checks;
- verify the post-bump commit is still the remote default-branch head;
- publish exactly the committed version with `npm publish --access restricted --tag latest`;
- never generate a runner-only version or a non-`latest` release channel.

If an existing workflow still changes the version with `GITHUB_RUN_NUMBER`, `GITHUB_RUN_ATTEMPT`, or another runner-generated value, replace it with the stable template instead of adapting that versioning logic. Existing immutable registry versions remain in history; the next committed stable version becomes the only `latest` target.

Use [scripts/validate-release-version.mjs](scripts/validate-release-version.mjs) when adapting the inline version check into repository tooling.

The bundled validator can be copied to `.github/scripts/validate-release-version.mjs` when repository tooling needs the same SemVer checks. Keep the inline validator in the workflow and do not remove the version check just because the first publish uses a token.

## Configure and operate the workflow

1. Configure the Trusted Publisher through the npm website or the verified CLI command in [references/authentication.md](references/authentication.md). Treat this as an external mutation requiring authorization.
2. Push the workflow and watch it with [references/operations.md](references/operations.md).
3. Verify the package and dist-tags only after `npm whoami` succeeds.
4. Use `node <skill-dir>/scripts/check-trusted-publishing.mjs --package @ORG/PACKAGE --repo ORG/REPOSITORY --workflow publish-npm.yml` before suggesting `npm trust`.
5. Treat moving or removing a dist-tag, deleting a secret, or unpublishing a version as separate destructive actions requiring explicit authorization.

## Diagnose failures

- `E401` from `npm whoami`: authenticate first; do not continue with package existence checks.
- private-package 404 while unauthenticated: inconclusive; repeat after `npm login`/valid read auth.
- `Unknown command: trust`: verify `npx --yes npm@11.15.0 trust --help`; the local npm is too old for management commands.
- `ENEEDAUTH`/`E403`: inspect OIDC claims, package write permission, secret/token scope, or registry; never print credentials.
- `npm ci` cannot find a tarball: remove the `file:`/`.tgz`/external path dependency and use a published version or a repository-contained, committed source that the lockfile can resolve.
- package and lock versions differ: run the selected `npm version patch|minor|major --no-git-tag-version` locally (default `patch`), commit both files, and rerun validation.
- stable version unchanged: expected automatic patch bump; inspect the generated release commit if it fails.
- downgrade or accidental prerelease: stop and correct the committed version before pushing.
- old commit moved a tag backwards: restore concurrency and remote-head guards.
- `convex codegen` lacks deployment: run `npx convex init` with `CONVEX_AGENT_MODE=anonymous` before codegen.

## Report completion

Return the stable release policy, authentication mode, version/tag, clean-install result, files changed, run URL, registry verification, and any external cleanup still requiring authorization.
