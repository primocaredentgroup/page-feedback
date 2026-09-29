import type { GenericDataModel, GenericQueryCtx } from "convex/server";
import type { ComponentApi } from "../component/_generated/component.js";

/** Typed server-only access. The host owns authorization and author enrichment. */
export class PageFeedbackClient {
  constructor(private readonly component: ComponentApi) {}

  listAllFeedbackThreads(
    ctx: Pick<GenericQueryCtx<GenericDataModel>, "runQuery">,
    args: { limit?: number } = {},
  ) {
    return ctx.runQuery(this.component.lib.listAllFeedbackThreads, args);
  }
}
