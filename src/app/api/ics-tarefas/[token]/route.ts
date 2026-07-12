import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Feed iCal individual de tarefas do usuário — assinado no Google Agenda.
// Cada usuário tem seu token privado (tarefas são pessoais, não da empresa).

function icsEscape(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function icsDate(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

const STATUS_LABEL: Record<string, string> = {
  NAO_INICIADA: "Não iniciada",
  EM_ANDAMENTO: "Em andamento",
  ATRASADA: "Atrasada",
  CONCLUIDA: "Concluída",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const usuario = await prisma.user.findUnique({
    where: { tarefasIcsToken: token },
    select: { id: true, name: true, companyId: true },
  });
  if (!usuario) return NextResponse.json({ error: "Link inválido" }, { status: 404 });

  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

  // Tarefas do usuário: criadas por ele (concluídas só dos últimos 30 dias)
  const tarefas = await prisma.tarefa.findMany({
    where: {
      companyId: usuario.companyId || undefined,
      criadorId: usuario.id,
      OR: [
        { status: { not: "CONCLUIDA" } },
        { status: "CONCLUIDA", updatedAt: { gte: trintaDiasAtras } },
      ],
    },
    orderBy: { dataEntrega: "asc" },
    take: 300,
  });

  const agora = new Date();
  const dtstamp = `${icsDate(agora)}T000000Z`;
  const linhas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LocadoraFacil//Tarefas//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`Tarefas — ${usuario.name || "LocadoraFácil"}`)}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
  ];

  for (const t of tarefas) {
    const entrega = new Date(t.dataEntrega);
    const concluida = t.status === "CONCLUIDA";
    linhas.push(
      "BEGIN:VEVENT",
      `UID:tarefa-${t.id}@locadorafacil.app`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;VALUE=DATE:${icsDate(entrega)}`,
      `DTEND;VALUE=DATE:${icsDate(addDays(entrega, 1))}`,
      `SUMMARY:${icsEscape(`${concluida ? "✅" : "☐"} ${t.nome}`)}`,
      `DESCRIPTION:${icsEscape(
        `${STATUS_LABEL[t.status] || t.status}${t.instrucoes ? `\n${t.instrucoes}` : ""}`
      )}`,
      ...(concluida ? ["STATUS:CONFIRMED", "TRANSP:TRANSPARENT"] : []),
      "END:VEVENT"
    );
  }

  linhas.push("END:VCALENDAR");

  return new NextResponse(linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="tarefas.ics"`,
      "Cache-Control": "no-cache",
    },
  });
}
