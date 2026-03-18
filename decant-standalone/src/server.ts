// ============================================================
// Decant Express Server
// ============================================================

// Load environment variables from .env file (must be first)
import 'dotenv/config';

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'http';
import { initializeDatabase, runMigrations, closeDatabase } from './backend/database/index.js';
import { registerAPIRoutes, registerHealthRoutes } from './backend/routes/index.js';
import { globalLimiter } from './backend/middleware/rateLimit.js';
import {
  createCorsMiddleware,
  securityHeaders,
  REQUEST_BODY_LIMIT,
} from './backend/middleware/security.js';
import { requireApiAuth } from './backend/middleware/auth.js';
import { log } from './backend/logger/index.js';
import httpLogger from './backend/middleware/requestLogger.js';
import * as cache from './backend/cache/index.js';
import { config, logConfigSummary } from './backend/config/index.js';
import { errorHandler, notFoundHandler } from './backend/middleware/errorHandler.js';
import {
  initializeHierarchyEngine,
  clearHierarchyEngine,
} from './backend/services/hierarchy/hierarchy_engine.js';
import { BranchDiscriminator } from './backend/services/hierarchy/branch_discriminator.js';
import * as keystore from './backend/services/keystore.js';
import {
  metricsMiddleware,
  startStatsCollection,
  stopStatsCollection,
} from './backend/services/metrics/index.js';
import { initializeProvider } from './backend/services/llm/provider.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Log configuration summary at startup
logConfigSummary();

// ============================================================
// Security Middleware (applied first)
// ============================================================

// CORS with configured origins
app.use(createCorsMiddleware());

// Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
app.use(securityHeaders());

// JSON body parser with size limit
app.use(express.json({ limit: REQUEST_BODY_LIMIT }));

// Request logging middleware
app.use(httpLogger);

// Metrics collection middleware (must be after logging)
app.use(metricsMiddleware);

// Initialize database
log.info('Initializing database...');
try {
  initializeDatabase();
  runMigrations();
  log.info('Database initialized successfully');
} catch (error) {
  log.error('Failed to initialize database', { err: error });
  process.exit(1);
}

// Initialize LLM provider if API key is configured
if (config.OPENAI_API_KEY) {
  try {
    initializeProvider({
      type: 'openai',
      apiKey: config.OPENAI_API_KEY,
      model: config.OPENAI_MODEL,
    });
    log.info('LLM provider initialized', { model: config.OPENAI_MODEL });
  } catch (error) {
    log.warn('Failed to initialize LLM provider — AI features disabled', {
      err: error instanceof Error ? error.message : String(error),
    });
  }
} else {
  log.warn('No OPENAI_API_KEY configured — AI features disabled');
}

// Start cache auto-cleanup
cache.startAutoCleanup();
log.info('Cache auto-cleanup started');

// Start metrics stats collection (every 60 seconds)
startStatsCollection(60000);
log.info('Metrics stats collection started');

// Health check routes (registered first, before rate limiting)
registerHealthRoutes(app);

// API auth (applies to /api/* except /api/health)
app.use('/api', requireApiAuth());

// Apply global rate limiter to all API routes
// This applies to all routes registered after this middleware
app.use('/api', globalLimiter);

// API Routes (with global rate limiting applied)
registerAPIRoutes(app);

// Serve static files from dist (built React app)
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (_req, res, next) => {
  // Skip if this is an API route that wasn't matched
  if (_req.path.startsWith('/api/')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// 404 handler for unmatched API routes
app.use('/api/*', notFoundHandler);

// Global error handler (must be last middleware)
app.use(errorHandler);

// Start server
const server: Server = app.listen(config.PORT, () => {
  log.info(`Decant server running at http://localhost:${config.PORT}`);
  log.info(`Environment: ${config.NODE_ENV}`);

  // Initialize dynamic hierarchy engine (async — fire and forget)
  keystore.getApiKey('openai').then(apiKey => {
    if (apiKey) {
      const discriminator = new BranchDiscriminator(apiKey);
      initializeHierarchyEngine(discriminator);
      log.info('Dynamic hierarchy engine initialized');
    } else {
      log.warn('OpenAI API key not configured — hierarchy engine deferred until key is set');
    }
  }).catch(error => {
    log.error('Failed to initialize hierarchy engine', {
      err: error instanceof Error ? error.message : String(error),
    });
  });
});

// ============================================================
// Graceful Shutdown Handler
// ============================================================

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    log.warn('Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  log.info(`Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  server.close((err) => {
    if (err) {
      log.error('Error closing server', { err });
    } else {
      log.info('Server stopped accepting new connections');
    }
  });

  // Clear hierarchy engine
  try {
    clearHierarchyEngine();
    log.info('Hierarchy engine cleared');
  } catch (engineError) {
    log.error('Error clearing hierarchy engine', { err: engineError });
  }

  // Stop cache auto-cleanup
  cache.stopAutoCleanup();
  log.info('Cache auto-cleanup stopped');

  // Stop metrics stats collection
  stopStatsCollection();
  log.info('Metrics stats collection stopped');

  // Close database connection
  try {
    closeDatabase();
    log.info('Database connection closed');
  } catch (dbError) {
    log.error('Error closing database', { err: dbError });
  }

  log.info('Graceful shutdown complete');
  process.exit(0);
}

// Force shutdown after 30 seconds if graceful shutdown takes too long
function forceShutdownAfterTimeout(): void {
  setTimeout(() => {
    log.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

// Listen for shutdown signals
process.on('SIGTERM', () => {
  forceShutdownAfterTimeout();
  gracefulShutdown('SIGTERM');
});

process.on('SIGINT', () => {
  forceShutdownAfterTimeout();
  gracefulShutdown('SIGINT');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.fatal('Uncaught exception', { err: error });
  forceShutdownAfterTimeout();
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? { message: reason.message, stack: reason.stack } : reason,
    promise: String(promise),
  });
});
