## 1.3.0

- Move the public npm package to `@primocaredentgroup/page-feedback`.
- Add opt-in `urlMode: "full"` for feedback, objectives, role targets and HTTP routes.
- Preserve legacy page identity and existing records by default.
- Keep role-test completion bound to the stored canonical target.
- Add an explicitly dispatched, verified npm release workflow.

# Changelog

## 1.2.0

- Add role-based test plans: roles, tests per role, multi-role user assignments, and per-test progress.
- Require mandatory feedback to mark a test complete (`completeRoleTestWithFeedback`).
- Extend `exposeApi` with admin and user operations for roles, tests, assignments, and progress.
- Store `adminUserIds` in settings for built-in admin allowlisting when `adminAuth` is not provided.
- Update the demo app with admin setup, user test dialog, and improved test-detail UI.

## 1.1.0

- Add thread-level `isSolved` support with `setFeedbackSolved`, keeping feedback versions append-only.
- Keep upgrades safe for existing installs by treating legacy threads without `isSolved` as unsolved.
- Update the demo UI and README to explain resolved feedback behavior.

## 1.0.0

- Shared **page objectives** per normalized URL: list, upsert, and ordered objectives with discussion threads (`listObjectivesForUrl`, `upsertObjective`, objective comments APIs).
- **Indicators** per objective: list and upsert (`listIndicatorsForObjective`, `upsertIndicator`).
- Client `exposeApi` includes auth operations `readObjectives` for objective reads and admin-gated objective/indicator writes.

## 0.0.0

- Initial release.
