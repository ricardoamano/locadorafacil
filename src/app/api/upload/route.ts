import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type SessionUser = { companyId?: string };

const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const TAMANHO_MAX = 3 * 1024 * 1024; // 3 MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const companyId = (session.user as SessionUser).companyId;
  if (!companyId) return NextResponse.json({ error: "No company" }, { status: 400 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || typeof file === "string")
    return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  if (!TIPOS_PERMITIDOS.includes(file.type))
    return NextResponse.json(
      { error: "Formato não suportado — envie JPG, PNG, WEBP, GIF ou SVG." },
      { status: 400 }
    );
  if (file.size > TAMANHO_MAX)
    return NextResponse.json(
      { error: "Imagem muito grande — o limite é 3 MB." },
      { status: 400 }
    );

  const buffer = Buffer.from(await file.arrayBuffer());
  const arquivo = await prisma.arquivo.create({
    data: {
      nome: file.name || "imagem",
      mime: file.type,
      tamanho: file.size,
      dados: buffer,
      companyId,
    },
    select: { id: true, nome: true, mime: true, tamanho: true },
  });

  return NextResponse.json(
    { ...arquivo, url: `/api/arquivos/${arquivo.id}` },
    { status: 201 }
  );
}
