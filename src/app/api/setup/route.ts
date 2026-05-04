import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// One-time setup endpoint to seed initial data
// Protected by SETUP_SECRET env var
export async function POST(req: Request) {
  const { secret } = await req.json();

  if (!secret || secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if already seeded
    const existing = await prisma.user.findUnique({
      where: { email: "admin@demo.com" },
    });
    if (existing) {
      return NextResponse.json({ message: "Already seeded" });
    }

    // Company
    const company = await prisma.company.create({
      data: { id: "company-demo", name: "LocadoraFácil Demo" },
    });

    // Admin user
    const hashedPassword = await bcrypt.hash("123456", 10);
    await prisma.user.create({
      data: {
        email: "admin@demo.com",
        name: "Administrador",
        password: hashedPassword,
        role: "ADMIN",
        companyId: company.id,
      },
    });

    // Sample clients
    const clienteData = [
      {
        type: "CLIENTE", razaoSocial: "Eventos Alfa Ltda",
        nomeFantasia: "Alfa Eventos", cnpj: "12.345.678/0001-90",
        cidade: "São Paulo", estado: "SP", perfil: "AGENCIA", isPostoServico: false,
      },
      {
        type: "CLIENTE", razaoSocial: "Centro de Convenções Beta S.A.",
        nomeFantasia: "Beta Convention", cnpj: "98.765.432/0001-10",
        cidade: "Rio de Janeiro", estado: "RJ", perfil: "ESPACO_EVENTO", isPostoServico: true,
      },
      {
        type: "CLIENTE", razaoSocial: "Gama Produções ME",
        nomeFantasia: "Gama Shows", cnpj: "55.444.333/0001-22",
        cidade: "Salvador", estado: "BA", perfil: "AGENCIA", isPostoServico: false,
      },
    ];

    for (const c of clienteData) {
      await prisma.contact.create({ data: { ...c, companyId: company.id } });
    }

    // Sample suppliers
    const fornData = [
      { type: "FORNECEDOR", razaoSocial: "TecnoLight Equipamentos Ltda", nomeFantasia: "TecnoLight", cnpj: "11.222.333/0001-55", cidade: "São Paulo", estado: "SP" },
      { type: "FORNECEDOR", razaoSocial: "Som & Cia Distribuidora", nomeFantasia: "Som & Cia", cnpj: "44.555.666/0001-77", cidade: "Campinas", estado: "SP" },
    ];

    for (const f of fornData) {
      await prisma.contact.create({ data: { ...f, companyId: company.id } });
    }

    return NextResponse.json({ message: "Setup complete! Login: admin@demo.com / 123456" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Setup failed", detail: String(error) }, { status: 500 });
  }
}
