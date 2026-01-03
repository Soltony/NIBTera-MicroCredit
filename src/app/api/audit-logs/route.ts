

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/user';

export async function GET(req: NextRequest) {
    const user = await getUserFromSession();
    if (!user) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Only allow users with audit-logs.read permission or Super Admin/Auditor role
    const canReadAuditLogs = user.permissions?.['audit-logs']?.read || user.role === 'Super Admin' || user.role === 'Auditor';
    if (!canReadAuditLogs) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    // If an id is provided, return that single audit log
    if (id) {
        try {
            const log = await prisma.auditLog.findUnique({ where: { id } });
            if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 });

            const actor = await prisma.user.findUnique({
                where: { id: log.actorId },
                select: { id: true, fullName: true, email: true },
            });

            if (user.role !== 'Super Admin' && user.role !== 'Auditor') {
                const filtered = {
                    id: log.id,
                    actorId: log.actorId,
                    actor,
                    action: log.action,
                    entity: log.entity,
                    entityId: log.entityId,
                    createdAt: log.createdAt,
                    ipAddress: null,
                    details: null,
                    userAgent: null,
                };
                return NextResponse.json(filtered);
            }

            return NextResponse.json({
                ...log,
                actor,
            });
        } catch (error) {
            console.error('Failed to fetch audit log:', error);
            return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
        }
    }

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    try {
        const [logs, totalCount] = await prisma.$transaction([
            prisma.auditLog.findMany({
                orderBy: {
                    createdAt: 'desc',
                },
                take: limit,
                skip: skip,
            }),
            prisma.auditLog.count(),
        ]);

        const actorIds = Array.from(new Set(logs.map((l) => l.actorId).filter(Boolean)));
        const actors = await prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, fullName: true, email: true },
        });
        const actorById = new Map(actors.map((a) => [a.id, a] as const));

        // For non-super-admin/auditor, filter sensitive fields
        let filteredLogs = logs;
        if (user.role !== 'Super Admin' && user.role !== 'Auditor') {
            filteredLogs = logs.map(({ id, actorId, action, entity, entityId, createdAt }) => ({
                id,
                actorId,
                actor: actorById.get(actorId) ?? null,
                action,
                entity,
                entityId,
                createdAt,
                ipAddress: null,
                details: null,
                userAgent: null,
            }));
        } else {
            filteredLogs = logs.map((log) => ({
                ...log,
                actor: actorById.get(log.actorId) ?? null,
            }));
        }

        return NextResponse.json({
            logs: filteredLogs,
            totalPages: Math.ceil(totalCount / limit),
            currentPage: page,
        });
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

