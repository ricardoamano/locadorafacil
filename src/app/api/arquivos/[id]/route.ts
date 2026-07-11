import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Serve as imagens enviadas (público — usado também no catálogo e nos PDFs)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const arquivo = await prisma.arquivo.findUnique({ where: { id } });
  if (!arquivo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(Buffer.from(arquivo.dados), {
    headers: {
      "Content-Type": arquivo.mime,
      "Content-Length": String(arquivo.tamanho),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
