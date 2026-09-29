# Authentication and permissions

Use this reference whenever creating, changing, rotating, or diagnosing npm credentials. Recheck the linked official documentation before acting because npm authentication rules evolve.

## Preferred: npm Trusted Publishing (OIDC)

Use Trusted Publishing for an existing package when the workflow runs on a GitHub-hosted runner. It replaces a reusable write token with a short-lived credential bound to one repository and workflow.

Requirements:

- npm CLI 11.5.1 or newer for publishing through OIDC;
- Node.js 22.14.0 or newer;
- a GitHub-hosted runner;
- workflow permission `id-token: write` and `contents: write` (the workflow creates the automatic patch commit);
- `package.json#repository.url` exactly matching the GitHub repository;
- an npm Trusted Publisher configuration whose owner, repository, workflow filename, and optional environment exactly match the Action.

Configure it on npmjs.com:

1. Open the existing package, then **Settings → Trusted Publisher**.
2. Select **GitHub Actions**.
3. Enter the GitHub organization/user and repository.
4. Enter only the workflow filename, for example `publish-npm.yml`, not `.github/workflows/publish-npm.yml`.
5. Enter an environment only if the job declares that exact GitHub Environment.
6. Allow `npm publish` for the stable release workflow. Use stage-only only when a human approval workflow is intended.
7. Remove `NODE_AUTH_TOKEN` from the publish step so npm can use OIDC.

### Verify identity and package visibility first

Run these commands in order before diagnosing whether a private package exists:

```bash
npm whoami
npm view @ORG/PACKAGE version --json
```

If `npm whoami` returns `E401`, stop and authenticate before running `npm view`:

```bash
npm login --scope=@ORG --registry=https://registry.npmjs.org/
```

A 404 from a private package while `npm whoami` is unauthenticated is inconclusive; it can mean either “not found” or “not visible to this identity.”

### Configure through the npm CLI

The CLI management command has a higher version requirement than OIDC publishing. Before proposing or running it, verify the exact command with:

```bash
npx --yes npm@11.15.0 trust --help
```

`npm@11.15.0+` is required for `npm trust`; `npm@11.5.1+` is sufficient for an already configured OIDC publication. The command also requires an existing package, account-level 2FA, and package write permission. A granular access token with Bypass 2FA is not a supported credential for managing trust; use an interactive npm login/session when npm requests it.

After `npm whoami`, package visibility, and the help check succeed, configure an already published package:

```bash
npx --yes npm@11.15.0 trust github @ORG/PACKAGE \
  --repo ORG/REPOSITORY \
  --file publish-npm.yml \
  --allow-publish
```

This is an external package-setting mutation and requires interactive authentication/2FA. Obtain explicit authorization before running it. The npm website **Settings → Trusted Publisher → GitHub Actions** is the fallback when the CLI is unavailable; enter only `publish-npm.yml`, not the full `.github/workflows/` path.

Trusted Publishing authenticates only `npm publish` or `npm stage publish`. If `npm ci` installs private dependencies, use a separate granular token with **Read-only** package/scope permission:

```yaml
- name: Install dependencies
  run: npm ci
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_READ_TOKEN }}

- name: Publish
  run: npm publish --access restricted --tag latest
```

Because the release workflow pushes the automatic patch commit, enable the repository setting that allows GitHub Actions to create and push commits, and ensure branch protection allows the bot to update the default branch. The final publish guard must compare the remote head with the post-bump local `HEAD`.

After the first successful OIDC publication, set the package publishing policy to require 2FA and disallow traditional tokens when compatible with team operations, remove the GitHub write secret, and revoke the old npm token.

### Complete the migration from `NPM_TOKEN`

For a repository that previously used a write token, complete these actions in order:

1. Configure the Trusted Publisher and remove only the `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` block from the publish step.
2. Keep `permissions: contents: write` and `id-token: write` so the workflow can create the automatic patch commit.
3. Push the workflow change and confirm one publication succeeds through OIDC. Verify the new version and `latest` dist-tag in the registry.
4. Delete the obsolete GitHub secret, for example:

```bash
gh secret delete NPM_TOKEN --repo ORG/REPOSITORY
```

5. Revoke the bootstrap granular token in npm **Access Tokens**. Do not revoke it before the successful OIDC run.

The token-based template remains useful for a package's bootstrap publication or an unsupported CI provider. A repository with a verified OIDC run should not retain a write `NPM_TOKEN` merely as a fallback.

## Token fallback and first publication

Use a granular npm access token when bootstrapping a new package, using an unsupported runner/provider, or explicitly retaining token authentication. Legacy npm tokens were removed in November 2025; do not recommend them.

### Account prerequisites

- Enable 2FA on the npm account.
- Join the target npm organization.
- Ensure the user's npm organization role/package team grants permission to create or publish packages in the scope. npm organization members can create and publish organization-scoped packages unless team/package policy narrows access.
- Ensure the organization plan supports private packages.

### Create the granular token

Granular tokens currently must be created on npmjs.com:

1. Open the account menu → **Access Tokens** → **Generate New Token** → **Granular Access Token**.
2. Use a descriptive name containing the repository/package and purpose.
3. Choose the shortest workable expiration and record its rotation date.
4. Enable **Bypass 2FA** for unattended publishing.
5. Under **Packages and scopes**, choose **Read and write**.
6. Choose **Only select packages and scopes**, then select the target package or the organization scope when the package does not yet exist.
7. Under **Organizations**, choose **No access** unless the workflow must manage organization settings, teams, or users. Organization permission does not grant package publishing rights.
8. Avoid IP allowlists on dynamic GitHub-hosted runners unless the organization has a deliberate static-egress design.
9. Generate and copy the token once into an approved password manager or directly into GitHub Secrets. Never paste it into chat, source files, shell history, logs, issues, or pull requests.

For installation-only CI, use **Read-only**, do not enable Bypass 2FA, and name the secret `NPM_READ_TOKEN`.

### Store the token in GitHub

Prefer a repository secret for a repository-specific write token:

1. Open **Repository → Settings → Secrets and variables → Actions**.
2. Select **New repository secret**.
3. Name it exactly `NPM_TOKEN` and paste the token as its value.

With GitHub CLI, authenticate and let `gh` prompt for the value so it does not appear in command history:

```bash
gh auth login
gh secret set NPM_TOKEN --repo ORG/REPOSITORY
gh secret list --repo ORG/REPOSITORY
```

For a deliberately shared organization secret, restrict it to selected repositories:

```bash
gh auth refresh -h github.com -s admin:org
gh secret set NPM_TOKEN --org ORG --repos REPOSITORY
gh secret list --org ORG
```

Do not reuse a broad write token across all repositories when per-package or per-repository tokens are practical.

Map the Actions secret to npm's expected environment variable only on the publish step:

```yaml
- name: Publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
  run: npm publish --access restricted --tag latest
```

`actions/setup-node` writes the registry authentication configuration that consumes `NODE_AUTH_TOKEN`; never write the literal value into `.npmrc`.

## Rotation and incident response

Before expiration:

1. Create a replacement token with the same or narrower package scope.
2. Update the GitHub secret under the same name.
3. Run and verify one publication.
4. Revoke the old npm token.

If exposure is suspected, revoke first, create a replacement, update the secret, inspect GitHub/npm audit history, and verify package versions/dist-tags for unauthorized changes.

## Official sources

- npm Trusted Publishing: https://docs.npmjs.com/trusted-publishers/
- npm access-token creation: https://docs.npmjs.com/creating-and-viewing-access-tokens/
- npm private packages in CI/CD: https://docs.npmjs.com/using-private-packages-in-a-ci-cd-workflow/
- npm organization roles: https://docs.npmjs.com/organization-roles-and-permissions/
- GitHub Actions secrets: https://docs.github.com/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
