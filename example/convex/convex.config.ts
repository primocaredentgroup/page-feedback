import { defineApp } from "convex/server";
import pageFeedback from "../../src/component/convex.config.js";

const app = defineApp();
app.use(pageFeedback);

export default app;
