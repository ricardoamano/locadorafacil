import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { slugify } from "@/lib/utils";

// Cadastro público (self-service) de uma nova empresa + seu usuário admin.
// Multiempresa: qualquer pessoa cria a própria empresa e vira o dono (ADMIN).

export async function POST(req: NextRequest) {
  const body = await req.json();
  const nome = String(body.nome || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const senha = String(body.senha || "");
  const empresaNome = String(body.empresaNome || "").trim();

  if (!nome || !email || !senha || !empresaNome)
    return NextResponse.json(
      { error: "Preencha seu nome, e-mail, senha e o nome da empresa." },
      { status: 400 }
    );
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
  if (senha.length < 6)
    return NextResponse.json(
      { error: "A senha deve ter ao menos 6 caracteres." },
      { status: 400 }
    );

  const existe = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existe)
    return NextResponse.json(
      { error: "Já existe uma conta com este e-mail. Faça login." },
      { status: 400 }
    );

  // Slug público único da empresa (para o catálogo)
  let slug = slugify(empresaNome) || "empresa";
  const base = slug;
  let n = 1;
  while (await prisma.company.findFirst({ where: { slug }, select: { id: true } })) {
    n += 1;
    slug = `${base}-${n}`;
  }

  const hashed = await bcrypt.hash(senha, 10);
  const company = await prisma.company.create({
    data: {
      name: empresaNome,
      slug,
      razaoSocial: body.razaoSocial?.trim() || null,
      cnpj: body.cnpj?.trim() || null,
      telefone: body.telefone?.trim() || null,
      email: body.empresaEmail?.trim() || email,
      cidade: body.cidade?.trim() || null,
      estado: body.estado?.trim()?.toUpperCase() || null,
      responsavel: nome,
      users: {
        create: {
          name: nome,
          email,
          password: hashed,
          role: "SUPERADMIN",
          isOwner: true,
          ativo: true,
        },
      },
    },
    select: { id: true },
  });

  return NextResponse.json({ success: true, companyId: company.id }, { status: 201 });
}
