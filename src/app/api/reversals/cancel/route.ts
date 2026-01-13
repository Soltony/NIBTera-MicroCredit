import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserFromSession } from "@/lib/user";
import { createAuditLog } from "@/lib/audit-log";

/**
 * Cancel a "failed" disbursement by marking it as successful.
 * This is used when an external disbursement was recorded as failed
 * but actually succeeded on the CBS side.
 *
 * Updates the transactionId and statusCode on the DisbursementTransaction record.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromSession();
  if (!user || !user.permissions?.["approvals"]?.update) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const ipAddress =
    (req as any).ip || req.headers.get("x-forwarded-for") || "N/A";
  const userAgent = req.headers.get("user-agent") || "N/A";

  const body = await req.json().catch(() => null);
  const disbursementTransactionId = body?.id ? String(body.id) : null;
  const cbsTransactionId = body?.transactionId
    ? String(body.transactionId).trim()
    : null;

  if (!disbursementTransactionId) {
    await createAuditLog({
      actorId: user.id,
      action: "CANCEL_DISBURSEMENT_INVALID",
      entity: "DisbursementTransaction",
      details: { reason: "Missing id" },
      ipAddress,
      userAgent,
    }).catch(() => null);
    return NextResponse.json(
      { error: "Missing disbursement transaction id" },
      { status: 400 }
    );
  }

  if (!cbsTransactionId) {
    await createAuditLog({
      actorId: user.id,
      action: "CANCEL_DISBURSEMENT_INVALID",
      entity: "DisbursementTransaction",
      entityId: disbursementTransactionId,
      details: { reason: "Missing transactionId" },
      ipAddress,
      userAgent,
    }).catch(() => null);
    return NextResponse.json(
      { error: "Missing CBS transaction ID" },
      { status: 400 }
    );
  }

  const tx = await prisma.disbursementTransaction.findUnique({
    where: { id: disbursementTransactionId },
  });
  if (!tx) {
    await createAuditLog({
      actorId: user.id,
      action: "CANCEL_DISBURSEMENT_NOT_FOUND",
      entity: "DisbursementTransaction",
      entityId: disbursementTransactionId,
      details: { reason: "DisbursementTransaction not found" },
      ipAddress,
      userAgent,
    }).catch(() => null);
    return NextResponse.json(
      { error: "DisbursementTransaction not found" },
      { status: 404 }
    );
  }

  // Check if it was already reversed
  const alreadyReversed = await prisma.auditLog.findFirst({
    where: {
      action: "DISBURSEMENT_REVERSED",
      entity: "DisbursementTransaction",
      entityId: tx.id,
    },
    select: { id: true },
  });
  if (alreadyReversed) {
    await createAuditLog({
      actorId: user.id,
      action: "CANCEL_DISBURSEMENT_BLOCKED",
      entity: "DisbursementTransaction",
      entityId: tx.id,
      details: { reason: "Already reversed, cannot cancel" },
      ipAddress,
      userAgent,
    }).catch(() => null);
    return NextResponse.json(
      {
        error:
          "This disbursement has already been reversed and cannot be cancelled.",
      },
      { status: 400 }
    );
  }

  // Update the disbursement transaction with the CBS transaction ID and mark as success (200)
  const previousTransactionId = tx.transactionId;
  const previousStatusCode = tx.statusCode;

  await prisma.disbursementTransaction.update({
    where: { id: disbursementTransactionId },
    data: {
      transactionId: cbsTransactionId,
      statusCode: 200, // Mark as successful
    },
  });

  await createAuditLog({
    actorId: user.id,
    action: "DISBURSEMENT_CANCELLED",
    entity: "DisbursementTransaction",
    entityId: tx.id,
    details: {
      reason: "Marked as successful with CBS transaction ID",
      cbsTransactionId,
      previousTransactionId,
      previousStatusCode,
      newStatusCode: 200,
      loanId: (tx as any).loanId ?? null,
      providerId: tx.providerId,
      creditAccount: tx.creditAccount,
      amount: tx.amount,
    },
    ipAddress,
    userAgent,
  });

  return NextResponse.json(
    {
      ok: true,
      message: "Disbursement marked as successful",
      transactionId: cbsTransactionId,
    },
    { status: 200 }
  );
}
