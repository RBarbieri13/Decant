/**
 * @module option_audit
 *
 * Service for tracking and querying changes to application options.
 * Provides an audit trail for option modifications with support for
 * filtering, pagination, and cleanup of old entries.
 */

import sql from "./sql.js";
import dateUtils from "./date_utils.js";
import instanceId from "./instance_id.js";
import log from "./log.js";

/**
 * Represents a single audit log entry for an option change.
 */
interface OptionAuditEntry {
    id?: number;
    optionName: string;
    oldValue: string | null;
    newValue: string | null;
    changeType: 'create' | 'update' | 'delete';
    userId?: string;
    instanceId: string;
    ipAddress?: string;
    changeReason?: string;
    utcDateChanged: string;
}

/**
 * Database row representation of an audit entry.
 */
interface OptionAuditRow {
    id: number;
    optionName: string;
    oldValue: string | null;
    newValue: string | null;
    changeType: string;
    userId: string | null;
    instanceId: string;
    ipAddress: string | null;
    changeReason: string | null;
    utcDateChanged: string;
}

/**
 * Filters for querying the audit log.
 */
interface AuditLogQueryFilters {
    optionName?: string;
    startDate?: string;
    endDate?: string;
    changeType?: 'create' | 'update' | 'delete';
    limit?: number;
    offset?: number;
}

/**
 * Result of an audit log query with pagination metadata.
 */
interface AuditLogQueryResult {
    entries: OptionAuditEntry[];
    total: number;
    limit: number;
    offset: number;
}

/**
 * Logs a change to an option in the audit trail.
 *
 * @param optionName - The name of the option that was changed
 * @param oldValue - The previous value (null for creates)
 * @param newValue - The new value (null for deletes)
 * @param changeType - The type of change: 'create', 'update', or 'delete'
 * @param options - Additional metadata for the audit entry
 */
function logOptionChange(
    optionName: string,
    oldValue: string | null,
    newValue: string | null,
    changeType: 'create' | 'update' | 'delete',
    options?: {
        userId?: string;
        ipAddress?: string;
        changeReason?: string;
    }
): number | null {
    const entry: OptionAuditEntry = {
        optionName,
        oldValue,
        newValue,
        changeType,
        userId: options?.userId,
        instanceId: instanceId,
        ipAddress: options?.ipAddress,
        changeReason: options?.changeReason,
        utcDateChanged: dateUtils.utcNowDateTime()
    };

    try {
        const result = sql.insert("option_audit_log", {
            optionName: entry.optionName,
            oldValue: entry.oldValue,
            newValue: entry.newValue,
            changeType: entry.changeType,
            userId: entry.userId || null,
            instanceId: entry.instanceId,
            ipAddress: entry.ipAddress || null,
            changeReason: entry.changeReason || null,
            utcDateChanged: entry.utcDateChanged
        });

        log.info(`Option audit: ${changeType} ${optionName}`);
        return result as number | null;
    } catch (e: unknown) {
        log.error(`Failed to log option change: ${e}`);
        return null;
    }
}

/**
 * Retrieves audit log entries with optional filtering and pagination.
 *
 * @param filters - Optional filters for the query
 * @returns Paginated audit log entries with total count
 */
function getAuditLog(filters?: AuditLogQueryFilters): AuditLogQueryResult {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filters?.optionName) {
        conditions.push("optionName = ?");
        params.push(filters.optionName);
    }

    if (filters?.startDate) {
        conditions.push("utcDateChanged >= ?");
        params.push(filters.startDate);
    }

    if (filters?.endDate) {
        conditions.push("utcDateChanged <= ?");
        params.push(filters.endDate);
    }

    if (filters?.changeType) {
        conditions.push("changeType = ?");
        params.push(filters.changeType);
    }

    const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const limit = filters?.limit ?? 100;
    const offset = filters?.offset ?? 0;

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM option_audit_log ${whereClause}`;
    const total = sql.getValue<number>(countQuery, params);

    // Get paginated entries
    const query = `
        SELECT id, optionName, oldValue, newValue, changeType, userId, instanceId, ipAddress, changeReason, utcDateChanged
        FROM option_audit_log
        ${whereClause}
        ORDER BY utcDateChanged DESC, id DESC
        LIMIT ? OFFSET ?
    `;

    const rows = sql.getRows<OptionAuditRow>(query, [...params, limit, offset]);

    const entries: OptionAuditEntry[] = rows.map(row => ({
        id: row.id,
        optionName: row.optionName,
        oldValue: row.oldValue,
        newValue: row.newValue,
        changeType: row.changeType as 'create' | 'update' | 'delete',
        userId: row.userId ?? undefined,
        instanceId: row.instanceId,
        ipAddress: row.ipAddress ?? undefined,
        changeReason: row.changeReason ?? undefined,
        utcDateChanged: row.utcDateChanged
    }));

    return {
        entries,
        total,
        limit,
        offset
    };
}

/**
 * Gets the complete change history for a specific option.
 *
 * @param optionName - The name of the option to get history for
 * @param limit - Maximum number of entries to return (default: 50)
 * @returns Array of audit entries for the option, newest first
 */
function getOptionHistory(optionName: string, limit: number = 50): OptionAuditEntry[] {
    const query = `
        SELECT id, optionName, oldValue, newValue, changeType, userId, instanceId, ipAddress, changeReason, utcDateChanged
        FROM option_audit_log
        WHERE optionName = ?
        ORDER BY utcDateChanged DESC, id DESC
        LIMIT ?
    `;

    const rows = sql.getRows<OptionAuditRow>(query, [optionName, limit]);

    return rows.map(row => ({
        id: row.id,
        optionName: row.optionName,
        oldValue: row.oldValue,
        newValue: row.newValue,
        changeType: row.changeType as 'create' | 'update' | 'delete',
        userId: row.userId ?? undefined,
        instanceId: row.instanceId,
        ipAddress: row.ipAddress ?? undefined,
        changeReason: row.changeReason ?? undefined,
        utcDateChanged: row.utcDateChanged
    }));
}

/**
 * Gets the most recent option changes across all options.
 *
 * @param limit - Maximum number of entries to return (default: 20)
 * @returns Array of the most recent audit entries
 */
function getRecentChanges(limit: number = 20): OptionAuditEntry[] {
    const query = `
        SELECT id, optionName, oldValue, newValue, changeType, userId, instanceId, ipAddress, changeReason, utcDateChanged
        FROM option_audit_log
        ORDER BY utcDateChanged DESC, id DESC
        LIMIT ?
    `;

    const rows = sql.getRows<OptionAuditRow>(query, [limit]);

    return rows.map(row => ({
        id: row.id,
        optionName: row.optionName,
        oldValue: row.oldValue,
        newValue: row.newValue,
        changeType: row.changeType as 'create' | 'update' | 'delete',
        userId: row.userId ?? undefined,
        instanceId: row.instanceId,
        ipAddress: row.ipAddress ?? undefined,
        changeReason: row.changeReason ?? undefined,
        utcDateChanged: row.utcDateChanged
    }));
}

/**
 * Removes audit entries older than the specified number of days.
 * This helps manage database size for long-running instances.
 *
 * @param olderThanDays - Remove entries older than this many days
 * @returns Number of entries deleted
 */
function cleanupOldAuditEntries(olderThanDays: number): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffDateStr = dateUtils.utcDateTimeStr(cutoffDate);

    const result = sql.execute(
        "DELETE FROM option_audit_log WHERE utcDateChanged < ?",
        [cutoffDateStr]
    );

    const deletedCount = result.changes;
    if (deletedCount > 0) {
        log.info(`Cleaned up ${deletedCount} old option audit entries older than ${olderThanDays} days`);
    }

    return deletedCount;
}

export default {
    logOptionChange,
    getAuditLog,
    getOptionHistory,
    getRecentChanges,
    cleanupOldAuditEntries
};

export type {
    OptionAuditEntry,
    AuditLogQueryFilters,
    AuditLogQueryResult
};
