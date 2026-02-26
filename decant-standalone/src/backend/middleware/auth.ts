// ============================================================
// API Authentication Middleware
// Token-based protection for /api routes
// ============================================================

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { config, isProduction } from '../config/index.js';
import { log } from '../logger/index.js';

function extractToken(req: Request): string | null {
  const header = req.header('authorization');
  if (header) {
    const trimmed = header.trim();
    if (trimmed.toLowerCase().startsWith('bearer ')) {
      return trimmed.slice(7).trim();
    }
    return trimmed;
  }

  const legacy = req.header('x-decant-token');
  if (legacy) return legacy.trim();

  const queryToken = req.query?.token;
  if (typeof queryToken === 'string' && queryToken.trim().length > 0) {
    return queryToken.trim();
  }

  return null;
}

export function requireApiAuth(): RequestHandler {
  if (isProduction() && !config.DECANT_ACCESS_TOKEN) {
    log.warn('DECANT_ACCESS_TOKEN is not set; API is running without auth', { module: 'auth' });
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const expected = config.DECANT_ACCESS_TOKEN;
    if (!expected) {
      next();
      return;
    }

    // Allow the lightweight extension health check unauthenticated.
    // When mounted at /api, this is /health.
    if (req.path === '/health') {
      next();
      return;
    }

    const provided = extractToken(req);
    if (provided && provided === expected) {
      next();
      return;
    }

    res.status(401).json({ error: 'Unauthorized' });
  };
}
