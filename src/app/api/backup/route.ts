import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { gerarSnapshot } from "@/lib/backup";

// Backups da empresa — só admin

type SessionUser = { companyId?: string; role?: string; name?: string | null };

async function getAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  const u = session.user as SessionUser;
  if (u.role !== "ADMIN" || !u.companyId) return null;
  return { companyId: u.companyId, nome: u.name || null };
}

export async function GET() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snapshots = await prisma.backupSnapshot.findMany({
    where: { companyId: admin.companyId },
    orderBy: { createdAt: "desc" },
    select: { id: true, tamanho: true, automatico: true, criadoPor: true, createdAt: true },
  });
  return NextResponse.json({ snapshots });
}

export async function POST() {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snap = await gerarSnapshot(admin.companyId, {
    automatico: false,
    criadoPor: admin.nome,
  });
  return NextResponse.json(snap, { status: 201 });
}
