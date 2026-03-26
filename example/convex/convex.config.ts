import { defineApp } from "convex/server";
import pageFeedback from "@okrlinkhub/page-feedback/convex.config.js";

const app = defineApp();
app.use(pageFeedback);

export default app;
