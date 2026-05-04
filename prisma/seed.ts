import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const dbPath = process.env.DATABASE_URL || "file:./dev.db";
const adapter = new PrismaBetterSqlite3({ url: dbPath });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Company
  const company = await prisma.company.upsert({
    where: { id: "company-demo" },
    update: {},
    create: {
      id: "company-demo",
      name: "LocadoraFácil Demo",
    },
  });

  // Admin user
  const hashedPassword = await bcrypt.hash("123456", 10);
  const user = await prisma.user.upsert({
    where: { email: "admin@demo.com" },
    update: {},
    create: {
      email: "admin@demo.com",
      name: "Administrador",
      password: hashedPassword,
      role: "ADMIN",
      companyId: company.id,
    },
  });

  console.log("User created:", user.email);

  // Clientes
  const clientes = [
    {
      type: "CLIENTE",
      razaoSocial: "Eventos Alfa Ltda",
      nomeFantasia: "Alfa Eventos",
      cnpj: "12.345.678/0001-90",
      cep: "01310-100",
      rua: "Av. Paulista",
      numero: "1000",
      bairro: "Bela Vista",
      cidade: "São Paulo",
      estado: "SP",
      perfil: "AGENCIA",
      isPostoServico: false,
    },
    {
      type: "CLIENTE",
      razaoSocial: "Centro de Convenções Beta S.A.",
      nomeFantasia: "Beta Convention",
      cnpj: "98.765.432/0001-10",
      cep: "20040-020",
      rua: "Av. Rio Branco",
      numero: "200",
      bairro: "Centro",
      cidade: "Rio de Janeiro",
      estado: "RJ",
      perfil: "ESPACO_EVENTO",
      isPostoServico: true,
    },
    {
      type: "CLIENTE",
      razaoSocial: "João Silva",
      nomeFantasia: "João Silva",
      cnpj: null,
      cep: "30130-110",
      rua: "Av. Afonso Pena",
      numero: "150",
      bairro: "Centro",
      cidade: "Belo Horizonte",
      estado: "MG",
      perfil: "CLIENTE_FINAL_PF",
      isPostoServico: false,
    },
    {
      type: "CLIENTE",
      razaoSocial: "Gama Produções ME",
      nomeFantasia: "Gama Shows",
      cnpj: "55.444.333/0001-22",
      cep: "41820-021",
      rua: "Av. Tancredo Neves",
      numero: "1632",
      bairro: "Caminho das Árvores",
      cidade: "Salvador",
      estado: "BA",
      perfil: "AGENCIA",
      isPostoServico: false,
    },
    {
      type: "CLIENTE",
      razaoSocial: "Delta Corporativo S.A.",
      nomeFantasia: "Delta Corp",
      cnpj: "22.111.000/0001-44",
      cep: "80420-090",
      rua: "Rua XV de Novembro",
      numero: "950",
      bairro: "Centro",
      cidade: "Curitiba",
      estado: "PR",
      perfil: "CLIENTE_FINAL_PJ",
      isPostoServico: false,
    },
  ];

  for (const clienteData of clientes) {
    const existing = await prisma.contact.findFirst({
      where: {
        nomeFantasia: clienteData.nomeFantasia,
        companyId: company.id,
      },
    });

    if (!existing) {
      await prisma.contact.create({
        data: {
          ...clienteData,
          companyId: company.id,
          subContacts: {
            create: [
              {
                nome: "Maria Santos",
                telefone: "(11) 99999-0001",
                email: `contato@${clienteData.nomeFantasia.toLowerCase().replace(/\s+/g, "")}.com`,
                cargo: "Gerente",
              },
            ],
          },
        },
      });
    }
  }

  // Fornecedores
  const fornecedores = [
    {
      type: "FORNECEDOR",
      razaoSocial: "TecnoLight Equipamentos Ltda",
      nomeFantasia: "TecnoLight",
      cnpj: "11.222.333/0001-55",
      cidade: "São Paulo",
      estado: "SP",
    },
    {
      type: "FORNECEDOR",
      razaoSocial: "Som & Cia Distribuidora",
      nomeFantasia: "Som & Cia",
      cnpj: "44.555.666/0001-77",
      cidade: "Campinas",
      estado: "SP",
    },
    {
      type: "FORNECEDOR",
      razaoSocial: "Telão Mania Locações",
      nomeFantasia: "Telão Mania",
      cnpj: "77.888.999/0001-00",
      cidade: "São Paulo",
      estado: "SP",
    },
  ];

  for (const fornData of fornecedores) {
    const existing = await prisma.contact.findFirst({
      where: {
        nomeFantasia: fornData.nomeFantasia,
        companyId: company.id,
      },
    });

    if (!existing) {
      await prisma.contact.create({
        data: {
          ...fornData,
          companyId: company.id,
        },
      });
    }
  }

  // Categorias de itens
  const catSom = await prisma.categoria.upsert({
    where: { id: "cat-som" },
    update: {},
    create: {
      id: "cat-som",
      nome: "Som",
      tipo: "ITEM",
      companyId: company.id,
    },
  });

  const catVideo = await prisma.categoria.upsert({
    where: { id: "cat-video" },
    update: {},
    create: {
      id: "cat-video",
      nome: "Vídeo",
      tipo: "ITEM",
      companyId: company.id,
    },
  });

  const catIlum = await prisma.categoria.upsert({
    where: { id: "cat-ilum" },
    update: {},
    create: {
      id: "cat-ilum",
      nome: "Iluminação",
      tipo: "ITEM",
      companyId: company.id,
    },
  });

  // Itens
  const itens = [
    {
      id: "item-001",
      codigo: "#001-1",
      nome: "Caixa de Som Line Array",
      valorAluguel: 350,
      tipo: "PROPRIO",
      categoriaId: catSom.id,
      quantidade: 8,
      especificacoes: "Caixa line array 12 polegadas, potência 1000W",
    },
    {
      id: "item-002",
      codigo: "#001-2",
      nome: "Mesa de Som Digital 32 canais",
      valorAluguel: 800,
      tipo: "PROPRIO",
      categoriaId: catSom.id,
      quantidade: 2,
    },
    {
      id: "item-003",
      codigo: "#002-1",
      nome: "Projetor 10.000 Lumens",
      valorAluguel: 1200,
      tipo: "PROPRIO",
      categoriaId: catVideo.id,
      quantidade: 4,
    },
    {
      id: "item-004",
      codigo: "#002-2",
      nome: "LED Wall P3.9 (módulo)",
      valorAluguel: 150,
      tipo: "PROPRIO",
      categoriaId: catVideo.id,
      quantidade: 50,
    },
    {
      id: "item-005",
      codigo: "#003-1",
      nome: "Moving Head Beam",
      valorAluguel: 250,
      tipo: "PROPRIO",
      categoriaId: catIlum.id,
      quantidade: 12,
    },
  ];

  for (const item of itens) {
    await prisma.item.upsert({
      where: { id: item.id },
      update: {},
      create: {
        ...item,
        companyId: company.id,
      },
    });
  }

  // Locais
  await prisma.local.upsert({
    where: { id: "local-001" },
    update: {},
    create: {
      id: "local-001",
      nome: "Expo Center Norte",
      cep: "02012-021",
      rua: "Rua José Bernardo Pinto",
      numero: "333",
      bairro: "Vila Guilherme",
      cidade: "São Paulo",
      estado: "SP",
      lat: -23.5121,
      lng: -46.6196,
      companyId: company.id,
    },
  });

  await prisma.local.upsert({
    where: { id: "local-002" },
    update: {},
    create: {
      id: "local-002",
      nome: "Riocentro",
      cep: "22775-040",
      rua: "Av. Salvador Allende",
      numero: "6555",
      bairro: "Recreio",
      cidade: "Rio de Janeiro",
      estado: "RJ",
      lat: -23.0063,
      lng: -43.3716,
      companyId: company.id,
    },
  });

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
