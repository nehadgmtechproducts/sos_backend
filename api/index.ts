// Vercel auto-detects any file under api/ as a serverless function and uses
// its default export as the request handler — an Express app satisfies that
// shape directly. This file only exists for Vercel's discovery; local dev
// still starts through src/index.ts.
export { default } from '../src/app.js';
