// ============================================================
// Test App Factory
// Creates an Express app for integration testing
// ============================================================

import express from 'express';
import { registerAPIRoutes } from '../routes/index.js';

/**
 * Create a test Express application with all routes registered
 */
export function createTestApp(): express.Application {
  const app = express();

  // Middleware
  app.use(express.json());

  // Register all API routes
  registerAPIRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Test app error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  });

  return app;
}
