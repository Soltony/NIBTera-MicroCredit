
'use server';

import prisma from './prisma';

interface AuditLogData {
    actorId: string;
    action: string;
    entity?: string;
    entityId?: string;
    details?: any;
    ipAddress?: string;
    userAgent?: string;
}

/**
 * Creates a structured audit log entry in the database.
 * This is used for compliance and tracking critical actions.
 * @param data - The data for the audit log entry.
 */
export async function createAuditLog(data: AuditLogData) {
    try {
        let detailsJson: string | undefined = undefined;
        if (data.details) {
            try {
                detailsJson = JSON.stringify(data.details);
            } catch (e) {
                console.error("Failed to stringify audit log details:", data.details);
                detailsJson = JSON.stringify({ error: "Failed to serialize details." });
            }
        }

        await prisma.auditLog.create({
            data: {
                actorId: data.actorId,
                action: data.action,
                entity: data.entity,
                entityId: data.entityId,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                details: detailsJson,
            },
        });
    } catch (error) {
        console.error("Failed to create audit log:", error);
        // In a real application, you might want a fallback mechanism here,
        // like writing to a critical log file if the DB fails.
    }
}
