// Vercel runs the Express app as a single serverless function; server/index.ts is only for local runs.
import { app } from '../server/app.js';
export default app;
