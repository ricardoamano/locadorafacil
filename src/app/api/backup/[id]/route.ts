import { NextRequest, NextResponse } from "next/server";
import { gunzipSync } from "zlib";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Download / exclusão de um snapshot de backup — só admin

type SessionUser = { companyId?: string; role?: string };

async function getAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  if (u.role !== "SUPERADMIN" || !u.companyId) return null;
  return u.companyId;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getAdmin();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const snap = await prisma.backupSnapshot.findFirst({ where: { id, companyId } });
  if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const json = gunzipSync(Buffer.from(snap.dados));
  const data = snap.createdAt.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return new NextResponse(new Uint8Array(json), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="backup_locadorafacil_${data}.json"`,
    },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const companyId = await getAdmin();
  if (!companyId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const snap = await prisma.backupSnapshot.findFirst({
    where: { id, companyId },
    select: { id: true },
  });
  if (!snap) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.backupSnapshot.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
