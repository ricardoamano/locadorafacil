import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Feed iCal privado da empresa — assinado no Google Agenda por URL.
// Cada empresa tem seu próprio token (multiempresa), revogável em Configurações.

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const empresa = await prisma.company.findUnique({
    where: { icsToken: token },
    select: { id: true, name: true },
  });
  if (!empresa) return NextResponse.json({ error: "Link inválido" }, { status: 404 });

  const orcamentos = await prisma.orcamento.findMany({
    where: {
      companyId: empresa.id,
      status: { in: ["APROVADO", "PENDENTE", "AGUARDANDO"] },
      dataInicio: { not: null },
    },
    orderBy: { dataInicio: "asc" },
    take: 500,
    include: {
      cliente: { select: { nomeFantasia: true } },
      local: { select: { nome: true, rua: true, numero: true, cidade: true } },
      os: { select: { horarioMontagem: true, horarioDesmontagem: true } },
    },
  });

  const agora = new Date();
  const dtstamp = `${icsDate(agora)}T000000Z`;
  const linhas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LocadoraFacil//Agenda//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`Eventos — ${empresa.name}`)}`,
    "X-WR-TIMEZONE:America/Sao_Paulo",
  ];

  for (const orc of orcamentos) {
    const inicio = new Date(orc.dataInicio!);
    const fim = orc.dataFim ? new Date(orc.dataFim) : inicio;
    const prefixo = orc.status === "APROVADO" ? "" : "[Pendente] ";
    const titulo = `${prefixo}#${orc.numero} ${orc.eventoNome || "Evento"} — ${
      orc.cliente?.nomeFantasia || ""
    }`;
    const local = orc.local
      ? [orc.local.nome, [orc.local.rua, orc.local.numero].filter(Boolean).join(" "), orc.local.cidade]
          .filter(Boolean)
          .join(", ")
      : "";

    const descricao = `Orçamento #${orc.numero} (${orc.status})${orc.tipoEvento ? ` · ${orc.tipoEvento}` : ""}`;
    const evento = (uid: string, de: Date, ate: Date, sumario: string) =>
      linhas.push(
        "BEGIN:VEVENT",
        `UID:${uid}-${orc.id}@locadorafacil.app`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${icsDate(de)}`,
        `DTEND;VALUE=DATE:${icsDate(addDays(ate, 1))}`,
        `SUMMARY:${icsEscape(sumario)}`,
        ...(local ? [`LOCATION:${icsEscape(local)}`] : []),
        `DESCRIPTION:${icsEscape(descricao)}`,
        "END:VEVENT"
      );

    // Locação longa marcada "só início e fim": dois eventos de 1 dia em vez de
    // um bloco ocupando semanas/meses da agenda
    if (orc.agendaSoMarcos && icsDate(inicio) !== icsDate(fim)) {
      evento("orc", inicio, inicio, `▶ Início · ${titulo}`);
      evento("orc-fim", fim, fim, `⏹ Fim · ${titulo}`);
    } else {
      evento("orc", inicio, fim, titulo);
    }

    // Eventos separados para montagem e desmontagem (quando caem fora do período)
    const marcos: { uid: string; data: Date | null | undefined; titulo: string; ref: Date }[] = [
      { uid: "mont", data: orc.dataMontagem || orc.os?.horarioMontagem, titulo: "🔧 Montagem", ref: inicio },
      { uid: "desm", data: orc.os?.horarioDesmontagem, titulo: "📦 Desmontagem", ref: fim },
    ];
    for (const m of marcos) {
      if (!m.data) continue;
      const d = new Date(m.data);
      if (icsDate(d) === icsDate(m.ref)) continue;
      linhas.push(
        "BEGIN:VEVENT",
        `UID:${m.uid}-${orc.id}@locadorafacil.app`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${icsDate(d)}`,
        `DTEND;VALUE=DATE:${icsDate(addDays(d, 1))}`,
        `SUMMARY:${icsEscape(`${m.titulo} — #${orc.numero} ${orc.eventoNome || ""}`)}`,
        ...(local ? [`LOCATION:${icsEscape(local)}`] : []),
        "END:VEVENT"
      );
    }
  }

  linhas.push("END:VCALENDAR");

  return new NextResponse(linhas.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="locadorafacil.ics"`,
      "Cache-Control": "no-cache",
    },
  });
}
