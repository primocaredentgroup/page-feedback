import { httpRouter } from "convex/server";
import { registerRoutes } from "../../src/client/index.js";
import { components } from "./_generated/api";

const http = httpRouter();

// Expose a read-only endpoint that returns the latest feedback for a page URL.
registerRoutes(http, components.pageFeedback, {
  pathPrefix: "/feedback",
});

export default http;
