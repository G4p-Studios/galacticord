const { AuditLogEvent } = require('discord.js');

/**
 * Fetches the latest audit log entry for a specific event type.
 * @param {Guild} guild - The guild to fetch from.
 * @param {AuditLogEvent} actionType - The type of action to look for.
 * @param {string} [targetId] - Optional ID of the target (e.g., member ID or channel ID).
 * @returns {Promise<AuditLogEntry|null>}
 */
async function fetchLatestAuditLog(guild, actionType, targetId = null) {
    try {
        // We wait a moment because audit logs are sometimes delayed by a second
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const fetchedLogs = await guild.fetchAuditLogs({
            limit: 1,
            type: actionType,
        });

        const entry = fetchedLogs.entries.first();
        if (!entry) return null;

        // Check if the entry is recent (within the last 10 seconds)
        const now = Date.now();
        if (now - entry.createdTimestamp > 10000) return null;

        // If a targetId is provided, make sure it matches
        if (targetId && entry.targetId !== targetId) return null;

        return entry;
    } catch (error) {
        console.error(`[AuditLogUtil] Error fetching logs for ${actionType}:`, error);
        return null;
    }
}

module.exports = { fetchLatestAuditLog };
