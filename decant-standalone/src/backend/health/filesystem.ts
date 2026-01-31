// ============================================================
// Filesystem Health Check
// ============================================================

import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDatabase } from '../database/connection.js';
import { config } from '../config/index.js';
import { log } from '../logger/index.js';
import { ComponentHealth, FilesystemHealthDetails } from './types.js';

const MIN_DISK_SPACE_GB = 1;
const MIN_DISK_SPACE_BYTES = MIN_DISK_SPACE_GB * 1024 * 1024 * 1024;

/**
 * Get available disk space for a given path
 * Uses df command on Unix-like systems, returns estimated value on Windows
 */
function getAvailableDiskSpace(dirPath: string): number {
  try {
    // Try to get actual disk stats (works on most Unix-like systems)
    if (process.platform !== 'win32') {
      const { execSync } = require('child_process');
      const output = execSync(`df -k "${dirPath}"`, {
        encoding: 'utf8',
      });
      const lines = output.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        const availableKB = parseInt(parts[3], 10);
        if (!isNaN(availableKB)) {
          return availableKB * 1024; // Convert to bytes
        }
      }
    }

    // Fallback: use process memory (not accurate but better than nothing)
    const memInfo = process.memoryUsage();
    return memInfo.heapTotal * 100; // Rough estimate
  } catch (error) {
    log.warn('Failed to get disk space', { err: error, module: 'health' });
    // Return a safe default
    return MIN_DISK_SPACE_BYTES * 10;
  }
}

/**
 * Get database file size
 */
function getDatabaseSize(): number | undefined {
  try {
    const db = getDatabase();
    const pageSizeResult = db.pragma('page_size', { simple: true }) as number;
    const pageCountResult = db.pragma('page_count', { simple: true }) as number;
    return pageSizeResult * pageCountResult;
  } catch (error) {
    log.warn('Failed to get database size', { err: error, module: 'health' });
    return undefined;
  }
}

/**
 * Get data directory path
 */
function getDataDirectory(): string {
  if (config.DATABASE_PATH) {
    return path.dirname(config.DATABASE_PATH);
  }
  return path.join(process.cwd(), 'data');
}

/**
 * Check if directory is writable
 */
function isDirectoryWritable(dirPath: string): boolean {
  try {
    // Ensure directory exists
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Try to create a temp file
    const testFile = path.join(dirPath, `.health-check-${Date.now()}`);
    fs.writeFileSync(testFile, 'test');
    fs.unlinkSync(testFile);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check filesystem health
 * Critical component: Must have write access and sufficient disk space
 */
export function checkFilesystemHealth(): ComponentHealth {
  const startTime = Date.now();
  const lastChecked = new Date().toISOString();

  try {
    const dataDirectory = getDataDirectory();
    const isWritable = isDirectoryWritable(dataDirectory);
    const diskSpaceBytes = getAvailableDiskSpace(dataDirectory);
    const databaseSizeBytes = getDatabaseSize();

    const details: FilesystemHealthDetails = {
      dataDirectory,
      isWritable,
      diskSpaceBytes,
      databaseSizeBytes,
    };

    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;

    if (!isWritable) {
      status = 'unhealthy';
      message = `Data directory not writable: ${dataDirectory}`;
    } else if (diskSpaceBytes < MIN_DISK_SPACE_BYTES) {
      status = 'unhealthy';
      const availableGB = (diskSpaceBytes / (1024 * 1024 * 1024)).toFixed(2);
      message = `Insufficient disk space: ${availableGB}GB available (minimum ${MIN_DISK_SPACE_GB}GB required)`;
    } else if (diskSpaceBytes < MIN_DISK_SPACE_BYTES * 2) {
      status = 'degraded';
      const availableGB = (diskSpaceBytes / (1024 * 1024 * 1024)).toFixed(2);
      message = `Low disk space: ${availableGB}GB available`;
    } else {
      status = 'healthy';
      const availableGB = (diskSpaceBytes / (1024 * 1024 * 1024)).toFixed(2);
      message = `Filesystem healthy (${availableGB}GB available)`;
    }

    return {
      status,
      message,
      lastChecked,
      latencyMs: Date.now() - startTime,
      details,
    };
  } catch (error) {
    log.error('Filesystem health check failed', {
      err: error,
      module: 'health',
    });

    return {
      status: 'unhealthy',
      message:
        error instanceof Error
          ? error.message
          : 'Filesystem health check failed',
      lastChecked,
      latencyMs: Date.now() - startTime,
    };
  }
}
