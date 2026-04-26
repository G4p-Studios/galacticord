const { AuditLogEvent } = require('discord.js');

/**
 * Fetches the latest audit log entry for one or more event types.
 * @param {Guild} guild - The guild to fetch from.
 * @param {AuditLogEvent|AuditLogEvent[]} actionTypes - The type(s) of action to look for.
 * @param {string} [targetId] - Optional ID of the target (e.g., member ID or channel ID).
 * @returns {Promise<AuditLogEntry|null>}
 */
async function fetchLatestAuditLog(guild, actionTypes, targetId = null) {
    try {
        const types = Array.isArray(actionTypes) ? actionTypes : [actionTypes];
        
        // We wait a moment because audit logs are sometimes delayed
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        let latestEntry = null;

        for (const type of types) {
            const fetchedLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: type,
            });

            const entry = fetchedLogs.entries.first();
            if (entry) {
                // If a targetId is provided, make sure it matches
                if (targetId && entry.targetId !== targetId) continue;

                const now = Date.now();
                if (now - entry.createdTimestamp < 15000) { // 15 seconds
                    if (!latestEntry || entry.createdTimestamp > latestEntry.createdTimestamp) {
                        latestEntry = entry;
                    }
                }
            }
        }

        return latestEntry;
    } catch (error) {
        console.error(`[AuditLogUtil] Error fetching logs for ${actionTypes}:`, error);
        return null;
    }
}

module.exports = { fetchLatestAuditLog };
