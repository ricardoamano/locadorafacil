import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gerarSnapshot } from "@/lib/backup";

// Backup automático diário (cron da Vercel) — um snapshot por empresa,
// com retenção dos 14 mais recentes.

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.get("authorization") === `Bearer ${secret}`;
  return (req.headers.get("user-agent") || "").startsWith("vercel-cron");
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const empresas = await prisma.company.findMany({ select: { id: true, name: true } });
  let gerados = 0;
  const erros: string[] = [];

  for (const c of empresas) {
    try {
      await gerarSnapshot(c.id, { automatico: true, criadoPor: "Backup automático" });
      gerados++;
    } catch (e) {
      erros.push(`${c.name}: ${e instanceof Error ? e.message : "erro"}`);
    }
  }

  return NextResponse.json({ gerados, erros });
}
