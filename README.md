# Convex Page Feedback

[![npm version](https://badge.fury.io/js/@okrlinkhub%2Fpage-feedback.svg)](https://badge.fury.io/js/@okrlinkhub%2Fpage-feedback)

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

It also includes a singleton `settings` record for optional bug-report and
improvement-request URLs controlled by the consumer app.

Found a bug? Feature request?
[File it here](https://github.com/primocaredentgroup/page-feedback/issues).

## Installation

Create a `convex.config.ts` file in your app's `convex/` folder and install the
component by calling `use`:

```ts
// convex/convex.config.ts
import { defineApp } from 'convex/server'
import pageFeedback from '@okrlinkhub/page-feedback/convex.config.js'

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
import { exposeApi } from '@okrlinkhub/page-feedback'

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
  getCommentReactions,
  toggleReaction,
  getSettings,
  setSettings,
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

See more example usage in [example.ts](./example/convex/example.ts).

## Data model

The component stores data in eight tables:

- `feedbackThreads`: latest feedback snapshot for each `userId + normalizedUrl`, including `isSolved`
- `feedbackVersions`: append-only history for each feedback thread
- `feedbackComments`: linear discussion messages attached to a feedback thread
- `feedbackReactions`: emoji reactions attached to a feedback comment
- `pageObjectives`: shared objectives for a normalized page URL
- `objectiveIndicators`: ordered indicators for a single objective
- `objectiveComments`: discussion messages attached to a page objective
- `settings`: singleton configuration document keyed internally as `global`

The URL is normalized inside both the component and the client wrapper by taking
everything before `?`.

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
- `lib.listComments({ threadId, limit?, currentUserId? })`
- `lib.listObjectiveComments({ objectiveId, limit? })`
- `lib.addComment({ userId, threadId, body })`
- `lib.addObjectiveComment({ userId, objectiveId, body })`
- `lib.editComment({ userId, commentId, body })`
- `lib.deleteComment({ userId, commentId })`
- `lib.getCommentReactions({ commentId, currentUserId? })`
- `lib.toggleReaction({ userId, commentId, emoji })`
- `lib.getSettings({})`
- `lib.setSettings({ bugReportUrl?, improvementRequestUrl? })`

`rating` is constrained to integers from `1` to `3`.

`isSolved` is a thread-level state, not a versioned feedback field. Updating the
rating or note still creates a new row in `feedbackVersions`, while changing
`isSolved` only updates the latest thread snapshot. For compatibility with
existing installations, older threads without `isSolved` are treated as
unsolved until they are updated.

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
import { registerRoutes } from '@okrlinkhub/page-feedback'
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
