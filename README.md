# Convex Page Feedback

[![npm version](https://badge.fury.io/js/@primocaredentgroup%2Fpage-feedback.svg)](https://badge.fury.io/js/@primocaredentgroup%2Fpage-feedback)

<!-- START: Include on https://convex.dev/components -->

Collect versioned page feedback per user and URL inside an isolated Convex
component.

The component keeps exactly one active feedback thread per
`userId + normalizedUrl`, stores every update as a new version, and lets each
feedback thread host:

- linear discussion comments
- emoji reactions on comments

It also supports a shared page-purpose layer per `normalizedUrl` with:

- ordered `objectives` describing what the page should achieve
- lightweight `indicators` attached to each objective
- discussion threads attached to each objective

For guided testing and training, the component can also model role-based test
paths:

- admins define roles such as `AM`
- admins attach ordered tests to each role, with optional `videoUrl`
- users can have multiple roles assigned at the same time
- users complete each test by submitting required feedback

It also includes a singleton `settings` record for optional bug-report and
improvement-request URLs controlled by the consumer app. `settings` also stores
`adminUserIds`, a simple built-in allowlist for role/test administration.

Found a bug? Feature request?
[File it here](https://github.com/primocaredentgroup/page-feedback/issues).

## Installation

```sh
npm install @primocaredentgroup/page-feedback
```

Create a `convex.config.ts` file in your app's `convex/` folder and install the
component by calling `use`:

```ts
// convex/convex.config.ts
import { defineApp } from 'convex/server'
import pageFeedback from '@primocaredentgroup/page-feedback/convex.config.js'

const app = defineApp()
app.use(pageFeedback)

export default app
```

Then run component codegen in your project:

```sh
npx convex dev --typecheck-components
```

## Usage

```ts
import { components } from './_generated/api'
import { exposeApi } from '@primocaredentgroup/page-feedback'

export const {
  getMyFeedback,
  upsertFeedback,
  setFeedbackSolved,
  listFeedbackVersions,
  listLatestFeedbackForUrl,
  listObjectivesForUrl,
  upsertObjective,
  listIndicatorsForObjective,
  upsertIndicator,
  listComments,
  listObjectiveComments,
  addComment,
  addObjectiveComment,
  editComment,
  deleteComment,
  getCommentReactionsPage,
  getCommentReactionCountsPage,
  getCommentReactionCountsReadiness,
  toggleReaction,
  getSettings,
  setSettings,
  listRoles,
  upsertRole,
  archiveRole,
  listRoleTestsForRole,
  upsertRoleTest,
  archiveRoleTest,
  assignRoleToUser,
  removeRoleFromUser,
  listRoleAssignments,
  listMyAssignedRoleTests,
  getRoleTestDetail,
  completeRoleTestWithFeedback,
} = exposeApi(components.pageFeedback, {
  auth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()

    if (!identity) {
      throw new Error('Unauthorized')
    }

    return identity.tokenIdentifier
  },
  adminAuth: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()

    if (!identity) {
      throw new Error('Admin access required')
    }
  },
})
```

If you omit `adminAuth`, `exposeApi` uses `settings.adminUserIds` as the admin
check. When the list is empty, the first authenticated caller can bootstrap the
settings:

```ts
await setSettings({ adminUserIds: ['user_123'] })
```

See more example usage in [example.ts](./example/convex/example.ts).

## Data model

The component stores data in twelve tables:

- `feedbackThreads`: latest feedback snapshot for each `userId + normalizedUrl`, including `isSolved`
- `feedbackVersions`: append-only history for each feedback thread
- `feedbackComments`: linear discussion messages attached to a feedback thread
- `feedbackReactions`: emoji reactions attached to a feedback comment
- `pageObjectives`: shared objectives for a normalized page URL
- `objectiveIndicators`: ordered indicators for a single objective
- `objectiveComments`: discussion messages attached to a page objective
- `roles`: admin-defined user roles, for example `AM`
- `roleTests`: ordered tests attached to a role, including target URL and optional `videoUrl`
- `userRoleAssignments`: many-to-many assignments so one user can have multiple roles
- `roleTestProgress`: per-user test completion declarations linked to feedback threads
- `settings`: singleton configuration document keyed internally as `global`

### URL identity

The default `urlMode: 'page'` preserves the previous behavior exactly: trim the
URL and take everything before `?`. A fragment without a preceding query is
retained for compatibility.

Opt in to full URL identity in your server integration:

```ts
const feedback = exposeApi(components.pageFeedback, {
  urlMode: 'full',
  auth: async (ctx) => { /* return the authenticated user ID */ },
})
registerRoutes(http, components.pageFeedback, { urlMode: 'full' })
```

Use the same mode for `exposeApi` and `registerRoutes`. Full mode trims only outer
whitespace and preserves the origin, path, query, parameter order, encoding and
fragment exactly. Different query values, parameter orders or fragments identify
different threads and objectives. Pass the complete URL from your frontend (for
example `window.location.href`); the server cannot recover omitted parameters.
The authorization callback receives the same canonical URL used for storage.
Direct component calls accept an optional `urlMode` argument on URL-based
operations and `upsertRoleTest`; omission keeps page mode.

New or edited role tests store their target using the selected mode. Completion
always uses that stored target exactly, even if the host configuration changes.

Existing threads, versions, objectives and role tests are never rewritten.
Queries discarded by earlier releases cannot be recovered. After enabling full
mode, an URL with parameters starts a separate thread; old threads remain visible
in the registry/history and can be opened using their saved `normalizedUrl`.
Existing role tests retain their saved targets and completion records.

### Migrating from the old npm scope

Install `@primocaredentgroup/page-feedback@1.3.0` and replace imports from
`@okrlinkhub/page-feedback`, including `/convex.config.js` and `/react`. Keep the
Convex component mount name `pageFeedback` to preserve its existing data. Run
Convex codegen and your application checks before deploying. Package migration
alone retains page mode; enabling full mode is an explicit server configuration.
Historical versions of the old package remain installable. See [Publishing](PUBLISHING.md)
for the ordered release and deprecation procedure.

`roleTestProgress.isCompleted` is the only field used for role-test completion
percentages. It is a user declaration saved by `completeRoleTestWithFeedback`.
`feedbackThreads.isSolved` is only a feedback discussion state and never affects
test completion.

## Public component API

The installed component exposes these public functions:

- `lib.upsertFeedback({ userId, url, rating, note })`
- `lib.setFeedbackSolved({ userId, threadId, isSolved })`
- `lib.getMyFeedback({ userId, url })`
- `lib.listFeedbackVersions({ userId, url, limit? })`
- `lib.listLatestFeedbackForUrl({ url, limit? })`
- `lib.listObjectivesForUrl({ url })`
- `lib.upsertObjective({ objectiveId?, url, description, status, order })`
- `lib.listIndicatorsForObjective({ objectiveId })`
- `lib.upsertIndicator({ indicatorId?, objectiveId, description, order })`
- `lib.listComments({ threadId, paginationOpts })` (breaking: native pagination metadata)
- `lib.listObjectiveComments({ objectiveId, limit? })`
- `lib.addComment({ userId, threadId, body })`
- `lib.addObjectiveComment({ userId, objectiveId, body })`
- `lib.editComment({ userId, commentId, body })`
- `lib.deleteComment({ userId, commentId })`
- `lib.getCommentReactionsPage({ commentId, paginationOpts })` (breaking: raw reaction facts in creation order)
- `lib.getCommentReactionCountsReadiness({ commentId })` (false for historical comments until explicit initialization)
- `lib.getCommentReactionCountsPage({ commentId, currentUserId?, paginationOpts })` (native page of exact per-emoji counts and `includesMe`; read only when ready)
- `lib.toggleReaction({ userId, commentId, emoji })`

Reaction facts preserve duplicate users and their creation order. To reconstruct the former
`users[]` response, load all pages, group facts by emoji, then sort emoji with `localeCompare`;
never present a partial page as a complete count. Counts for comments created by this version
are maintained atomically. Historical comments have `ready: false` until the explicit,
resumable internal `initializeCommentReactionCountsStep` has covered all of their reactions;
the facts pages remain available meanwhile. No historical initializer runs automatically.
Deleting a comment hides its reactions immediately and schedules idempotent bounded cleanup.
- `lib.getSettings({})`
- `lib.setSettings({ bugReportUrl?, improvementRequestUrl?, adminUserIds? })`
- `lib.listRoles({ limit? })`
- `lib.upsertRole({ roleId?, name, description?, status, order })`
- `lib.archiveRole({ roleId })`
- `lib.listRoleTestsForRole({ roleId, limit? })`
- `lib.upsertRoleTest({ roleTestId?, roleId, title, description, targetUrl, videoUrl?, status, order })`
- `lib.archiveRoleTest({ roleTestId })`
- `lib.assignRoleToUser({ userId, roleId })`
- `lib.removeRoleFromUser({ userId, roleId })`
- `lib.listRoleAssignments({ userId?, roleId?, limit? })`
- `lib.listMyAssignedRoleTests({ userId })`
- `lib.getRoleTestDetail({ userId, roleTestId })`
- `lib.completeRoleTestWithFeedback({ userId, roleTestId, rating, note })`

`rating` is constrained to integers from `1` to `3`.

`isSolved` is a thread-level state, not a versioned feedback field. Updating the
rating or note still creates a new row in `feedbackVersions`, while changing
`isSolved` only updates the latest thread snapshot. For compatibility with
existing installations, older threads without `isSolved` are treated as
unsolved until they are updated.

`completeRoleTestWithFeedback` requires a non-empty `note`, reuses the existing
versioned feedback system for the test target URL, then writes
`roleTestProgress.isCompleted = true` in the same mutation. For example, if role
`AM` has four active tests, the returned role progress moves through
`0`, `25`, `50`, `75`, and `100` percent as the user completes them.

This release intentionally does **not** include mentions or realtime typing.
Those can be layered in later without coupling the component to a specific user
directory or notification architecture.

## Best practices

This component follows the official Convex guidance for components from
[Authoring Components](https://docs.convex.dev/components/authoring):

- authentication remains in the consumer app, not inside the component
- the component owns its own tables and persistence boundary
- public functions define both argument and return validators
- external app identifiers such as `userId` are passed explicitly across the component boundary

### HTTP Routes

You can register a read-only HTTP endpoint for page feedback:

```ts
import { httpRouter } from 'convex/server'
import { registerRoutes } from '@primocaredentgroup/page-feedback'
import { components } from './_generated/api'

const http = httpRouter()

registerRoutes(http, components.pageFeedback, {
  pathPrefix: '/feedback',
})

export default http
```

This exposes `GET /feedback/latest?url=...` and returns the latest feedback
entries for the requested normalized URL. See
[http.ts](./example/convex/http.ts) for a complete example.

<!-- END: Include on https://convex.dev/components -->

Run the example:

```sh
npm i
npm run dev
```
