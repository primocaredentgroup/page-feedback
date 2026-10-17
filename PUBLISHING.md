# Publishing @primocaredent/page-feedback

The package remains **public**. Existing `@okrlinkhub/page-feedback` versions
remain installable. Do not unpublish them or change their artifacts.

## Approval and release order

1. Review and merge the package PR only after William approves its exact head.
2. Obtain separate approval to publish the exact main SHA and stable version.
   Version `1.3.0` introduces opt-in full URL identity; later version bumps must
   be committed in both `package.json` and `package-lock.json`.
3. Dispatch `publish-npm.yml` from `main`, supplying the approved full SHA and
   version. The workflow never runs on push, PR or merge, never bumps versions,
   and rejects a superseded main before publishing. Configure the `npm-release`
   GitHub environment with a required reviewer for an additional release gate.
4. Verify registry name, version, `latest`, tarball integrity and a clean consumer
   installation. Only then update/finalize the dependent consumer PR lockfiles.
5. Obtain approval before deprecating the old package. After verifying the new
   installation, run:

   ```sh
   npm deprecate '@okrlinkhub/page-feedback@*' 'This package has moved to @primocaredent/page-feedback. Install @primocaredent/page-feedback; existing versions remain available.'
   ```

6. Merge consumer PRs only after their separate approval and green checks.
   Deployment of consumers is a separate action.

## Authentication

The first publication needs an npm identity with package-creation rights in
`primocaredent`. Verify `npm whoami` and organization permissions before changing
credentials. An unauthenticated registry 404 alone does not prove name availability.

Prefer npm Trusted Publishing (OIDC) for subsequent releases, bound to:

- GitHub owner: `primocaredentgroup`
- Repository: `page-feedback`
- Workflow filename: `publish-npm.yml`
- Environment: `npm-release`

Before the package exists, use the manual workflow's `bootstrap-token` mode with
a short-lived granular token scoped to package creation/publication in
`@primocaredent`. Store and organize the credential in **1Password** first; inject
it into the `npm-release` environment secret `NPM_PUBLISH_TOKEN` only with explicit
approval. The workflow consumes it only in the bootstrap publish step.

Once the package exists, configure and verify its trusted publisher, use `oidc`
mode, and arrange separately approved revocation/removal of the bootstrap token.
Do not print tokens or write their values to source, logs, issues or PRs.

Official references: [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/),
[granular tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens/).

## Local validation without publishing

```sh
npm ci
npm run build
npm test
npm run typecheck
npm run lint
node scripts/check-release.mjs
npm pack --json
```

Install the generated tarball in a disposable consumer checkout, regenerate
Convex types against an isolated local deployment, and check the application.
A tarball installation verifies the candidate artifact; it does not prove npm
publication or a production deployment.

Keep the Convex component mount name `pageFeedback` when changing npm scope.
Existing stored URL keys and role completion records require no data migration.
Both `exposeApi` and `registerRoutes` default to legacy page mode; configure both
with `urlMode: 'full'` to preserve query strings and fragments.
