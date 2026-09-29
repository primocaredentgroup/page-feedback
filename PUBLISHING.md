# Publishing

Follow [the shared npm release skill](.agents/skills/publish-private-npm/SKILL.md) and its references for every release.

`@okrlinkhub/page-feedback` is an existing **public** package. Keep `publishConfig.access: public` and publish with `--access public --tag latest`; the shared skill's private-only audit reports two expected visibility exceptions for this package.

## Stable releases from main

`.github/workflows/publish-npm.yml` publishes pushes to `main`. If the incoming commit keeps the same version, the workflow creates and pushes a patch release commit containing `package.json` and `package-lock.json`. An explicitly committed stable version is preserved; prereleases and downgrades are rejected. Release through GitHub Actions so npm matches committed source.

Use a patch by default. To prepare an explicit patch locally, run `npm run release`, then commit both manifests. Use `npm version minor --no-git-tag-version` or `npm version major --no-git-tag-version` only when that release level was explicitly requested. There is no alpha publication channel.

## Validation

From a clean checkout:

```sh
npm ci
CONVEX_AGENT_MODE=anonymous npx convex init
npm run build
CONVEX_AGENT_MODE=anonymous npx convex dev --once --run-sh "npm run codegen"
git diff --exit-code -- src/component/_generated
npm run verify
npm pack --dry-run
```

Convex 1.33.1 stops the local anonymous backend when `init` exits, so the workflow keeps it running through `convex dev --once --run-sh` while generating the component types. The example imports the built package, which is why a build precedes this local codegen step.

The verification script runs build, tests, typechecks and lint. `prepublishOnly` also runs verification for direct npm calls. The workflow checks the remote branch head immediately before publishing.

## Authentication

The workflow uses npm Trusted Publishing (OIDC) for `primocaredentgroup/page-feedback`, workflow file `publish-npm.yml`, and no GitHub Environment. Configure the matching publisher in npm before the first workflow release. The Actions workflow uses Node 24, npm 11.15.0, `contents: write`, and `id-token: write`. `NPM_READ_TOKEN` is only for dependency installation when needed; never place a write token in source.

After publication, verify the stable version and `latest` tag through authenticated npm access. Do not move tags, unpublish versions, or remove credentials implicitly.
