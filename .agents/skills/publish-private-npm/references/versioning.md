# Version and dist-tag policy

Use stable SemVer releases only. npm versions are immutable: after `@scope/name@1.2.3` is published, that name/version pair cannot be reused, even after unpublish.

## Stable SemVer releases

For every release, `package.json` and `package-lock.json` are the source of truth. The normal local release command remains:

```bash
npm version patch --no-git-tag-version  # 2.2.10
npm version minor --no-git-tag-version  # 2.3.0
npm version major --no-git-tag-version  # 3.0.0
```

The normal command is `npm version patch --no-git-tag-version`. Run `minor` or `major` only when the user explicitly requests that release level.

The publish workflow also supports a push without a version change: it executes `npm version patch --no-git-tag-version`, commits `package.json` and `package-lock.json` as the release commit, and publishes that version. If the incoming commit already contains a version change, the workflow publishes it as-is and does not add another patch. This requires `contents: write` so the workflow can push the automatic release commit.

The stable workflow may execute only the deterministic default patch command in GitHub Actions. It must:

1. trigger on pushes to the default branch;
2. compare the committed version with the previous commit;
3. automatically apply and commit a patch when the version is unchanged;
4. reject downgrades and prerelease strings;
5. ensure package and lockfile versions match;
6. run a clean `npm ci`, tests, build, typecheck, and pack checks;
7. verify the post-bump commit is still the remote default-branch head;
8. publish exactly that version:

```bash
npm publish --access restricted --tag latest
```

Use `patch` for backwards-compatible fixes, `minor` for backwards-compatible capabilities, and `major` for breaking changes. A manually selected `minor` or `major` release should contain the version change and lockfile update together; an ordinary source push receives an automatic patch commit.

## Dist-tags and cleanup

Inspect mappings with authenticated npm access:

```bash
npm view @ORG/PACKAGE dist-tags --json
npm dist-tag ls @ORG/PACKAGE
```

Moving or removing a tag changes what consumers install and requires explicit authorization:

```bash
npm dist-tag add @ORG/PACKAGE@2.2.10 latest
```

`npm unpublish` is a separate destructive action, subject to npm restrictions, and must never be performed implicitly:

```bash
npm unpublish @ORG/PACKAGE@VERSION
```

“One current channel” means one consumer-facing `latest` dist-tag, not one version in the package's history.

## Concurrency and superseded commits

For publish-on-main workflows:

- use one concurrency group per repository;
- cancel older in-progress runs;
- fetch the remote default branch immediately before publish;
- skip publication when a newer commit superseded `GITHUB_SHA`.

This prevents an older run from moving `latest` backwards after a newer release finishes.

## Official sources

- npm publish and tags: https://docs.npmjs.com/cli/publish/
- npm dist-tags: https://docs.npmjs.com/cli/commands/npm-dist-tag/
- npm version: https://docs.npmjs.com/cli/v11/commands/npm-version/
- Semantic Versioning: https://semver.org/
