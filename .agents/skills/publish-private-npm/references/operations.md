# Publication operations

Use these commands to validate, observe, and verify a publication. Listing and viewing are read-only. Rerunning a workflow, changing a dist-tag, deleting a secret, or unpublishing a version mutates external state and requires authorization.

## Authenticate npm before private-package diagnosis

Always run these commands in order:

```bash
npm whoami
npm view @ORG/PACKAGE version --json
```

If `npm whoami` returns `E401`, stop and run:

```bash
npm login --scope=@ORG --registry=https://registry.npmjs.org/
```

Only retry `npm view` after login succeeds. A private-package 404 without valid authentication is inconclusive.

## Validate a clean checkout

`npm ci` must run from a checkout without `node_modules` and without ignored tarballs or external paths. For a committed revision:

```bash
clean_dir="$(mktemp -d)"
git archive HEAD | tar -x -C "$clean_dir"
cd "$clean_dir"
npm ci
npm test
npm pack --dry-run
```

If `npm ci` reports a missing `.tgz`, `file:`, directory, or external path, repair `package.json` and the lockfile before touching the workflow.

## Authenticate GitHub CLI

```bash
gh auth login
gh auth status
```

Select the repository explicitly with `--repo ORG/REPOSITORY` when the current directory's remote is absent or ambiguous.

## Find and watch runs

List recent publish runs:

```bash
gh run list \
  --workflow publish-npm.yml \
  --branch main \
  --limit 10
```

Watch a selected run until completion and propagate failure as a non-zero exit status:

```bash
gh run watch RUN_ID --exit-status
```

`gh run watch` refreshes job/step status; it is not a raw live tail of runner stdout. After logs become available, inspect all logs or only failures:

```bash
gh run view RUN_ID --log
gh run view RUN_ID --log-failed
gh run view RUN_ID --json status,conclusion,headSha,url,jobs
```

Rerun only after diagnosing the failure and confirming the selected version strategy makes reruns safe:

```bash
gh run rerun RUN_ID --failed
gh run watch RUN_ID --exit-status
```

## Verify registry state

After `npm whoami` succeeds:

```bash
npm view @ORG/PACKAGE version dist-tags --json
npm view @ORG/PACKAGE@latest version
```

Confirm the expected immutable version exists, the `latest` dist-tag points to it, the package remains restricted, and the run `headSha` is the intended commit.

## Check Trusted Publishing prerequisites

Run the bundled read-only preflight before proposing `npm trust`:

```bash
node <skill-dir>/scripts/check-trusted-publishing.mjs \
  --package @ORG/PACKAGE \
  --repo ORG/REPOSITORY \
  --workflow publish-npm.yml
```

It verifies identity, package visibility, repository metadata, workflow permissions, hosted-runner shape, Node version, and `npx --yes npm@11.15.0 trust --help`. It must not print tokens.

## End-to-end consumer smoke test

Use a disposable directory and a read-only npm credential:

```bash
consumer_dir="$(mktemp -d)"
cd "$consumer_dir"
npm init --yes
npm install @ORG/PACKAGE@latest
npm ls @ORG/PACKAGE
```

If the package exposes a stable runtime API, add the smallest import/require assertion supported by that package. Do not copy a publisher write token into the consumer test.

## Cleanup and destructive operations

`npm unpublish @ORG/PACKAGE@VERSION` is a destructive action; ask for explicit authorization and confirm the exact version first.

## Common failure map

| Symptom | Inspect | Typical correction |
| --- | --- | --- |
| `E401` from `npm whoami` | local auth and registry | run `npm login --scope=@ORG --registry=...` first |
| private-package 404 | whether `npm whoami` succeeded | authenticate before interpreting visibility |
| `Unknown command: trust` | npm CLI version | verify `npx --yes npm@11.15.0 trust --help` |
| `E403` | npm membership, package write access, OIDC claims | grant only the missing package permission |
| `npm ci` missing tarball | `file:`, `.tgz`, external path in manifest/lock | replace with a published package version and regenerate lockfile |
| package/lock versions differ | `package.json` and `packages[""].version` | run local `npm version patch|minor|major`, commit both |
| stable version unchanged | previous commit comparison | workflow should create and push an automatic patch release commit |
| stable downgrade/prerelease | SemVer validator | correct the committed version before push |
| OIDC exchange/repository mismatch | owner/repo/workflow/environment, `repository.url` | make identifiers exact and use hosted runner |
| old commit moved `latest` backwards | concurrency and remote-head guard | restore both supersession checks |
| `convex codegen` lacks deployment | anonymous initialization | run `npx convex init` with `CONVEX_AGENT_MODE=anonymous` before codegen |

## Operational handoff

Record without exposing secrets: release policy, run URL/ID, published version, dist-tag mapping, commit SHA, authentication mode, clean-install result, and consumer smoke-test result.

## Official sources

- npm trust: https://docs.npmjs.com/cli/v11/commands/npm-trust/
- npm CI: https://docs.npmjs.com/cli/commands/npm-ci/
- GitHub CLI run watch: https://cli.github.com/manual/gh_run_watch
- GitHub CLI run view: https://cli.github.com/manual/gh_run_view
- npm package metadata: https://docs.npmjs.com/cli/commands/npm-view/
- npm dist-tags: https://docs.npmjs.com/cli/commands/npm-dist-tag/
