import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Phone, Mail, Globe, MessageCircle, Tag, Package, FileText, Link2, Zap } from "lucide-react";
import { GaleriaCatalogo } from "./galeria";

// Página comercial pública: NUNCA expõe preços, custos, estoque, fornecedores
// ou informações internas — apenas os campos expressamente autorizados abaixo.

async function getDados(empresaSlug: string, itemSlug: string) {
  const empresa = await prisma.company.findUnique({
    where: { slug: empresaSlug },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      telefone: true,
      email: true,
      site: true,
      cidade: true,
      estado: true,
      catalogoWhatsappAtivo: true,
      catalogoWhatsappTexto: true,
      catalogoWhatsappMensagem: true,
    },
  });
  if (!empresa) return null;

  const item = await prisma.item.findFirst({
    where: { companyId: empresa.id, slug: itemSlug, publicado: true },
    select: {
      nome: true,
      codigo: true,
      mostrarCodigo: true,
      modelo: true,
      watts: true,
      kva: true,
      descricaoComercial: true,
      especificacoesPublicas: true,
      fotoCapaUrl: true,
      videoUrl: true,
      fotos: true,
      categoria: { select: { nome: true } },
      marca: { select: { nome: true } },
      arquivos: { select: { id: true, tipo: true, titulo: true, url: true } },
    },
  });
  if (!item) return null;
  return { empresa, item };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ empresa: string; slug: string }>;
}): Promise<Metadata> {
  const { empresa, slug } = await params;
  const dados = await getDados(empresa, slug);
  if (!dados) return { title: "Catálogo" };
  return {
    title: `${dados.item.nome} | ${dados.empresa.name}`,
    description:
      dados.item.descricaoComercial?.slice(0, 150) ||
      `${dados.item.nome} para locação — ${dados.empresa.name}`,
  };
}

export default async function CatalogoItemPage({
  params,
}: {
  params: Promise<{ empresa: string; slug: string }>;
}) {
  const { empresa: empresaSlug, slug } = await params;
  const dados = await getDados(empresaSlug, slug);
  if (!dados) notFound();

  const { empresa, item } = dados;

  let galeria: string[] = [];
  try {
    const parsed = JSON.parse(item.fotos || "[]");
    if (Array.isArray(parsed)) galeria = parsed.filter((f) => typeof f === "string");
  } catch {
    galeria = [];
  }
  // Capa primeiro, sem repetir; todas as fotos entram na galeria clicável
  const fotosAll = [item.fotoCapaUrl, ...galeria].filter(
    (f, i, arr): f is string => !!f && arr.indexOf(f) === i
  );

  const whatsappDigits = (empresa.telefone || "").replace(/\D/g, "");
  const mensagemWpp = (
    empresa.catalogoWhatsappMensagem || "Olá! Gostaria de um orçamento para: {item}"
  ).replace(/\{item\}/g, item.nome);
  const textoWpp =
    empresa.catalogoWhatsappTexto || "Solicitar orçamento pelo WhatsApp";
  const whatsappUrl =
    empresa.catalogoWhatsappAtivo && whatsappDigits
      ? `https://wa.me/55${whatsappDigits}?text=${encodeURIComponent(mensagemWpp)}`
      : null;

  // Só mostra specs elétricas quando existem
  const eletricas = [
    item.watts != null && item.watts > 0 ? `${item.watts} W` : null,
    item.kva != null && item.kva > 0 ? `${item.kva} kVA` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Cabeçalho da locadora */}
      <header className="bg-white border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          {empresa.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={empresa.logoUrl}
              alt={empresa.name}
              className="h-10 object-contain"
            />
          ) : (
            <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center">
              <Package className="h-5 w-5 text-white" />
            </div>
          )}
          <div>
            <p className="font-bold text-slate-900">{empresa.name}</p>
            {(empresa.cidade || empresa.estado) && (
              <p className="text-xs text-slate-400">
                {[empresa.cidade, empresa.estado].filter(Boolean).join(" - ")}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Foto (galeria clicável estilo e-commerce) */}
          <GaleriaCatalogo fotos={fotosAll} nome={item.nome} />

          {/* Informações */}
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {item.categoria && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                  <Tag className="h-3 w-3" />
                  {item.categoria.nome}
                </span>
              )}
              {(item.marca || item.modelo) && (
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                  {[item.marca?.nome, item.modelo].filter(Boolean).join(" · ")}
                </span>
              )}
              {eletricas.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                  <Zap className="h-3 w-3" />
                  {eletricas.join(" · ")}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{item.nome}</h1>
            {item.mostrarCodigo && item.codigo && (
              <p className="text-sm text-slate-400 mt-1 font-mono">{item.codigo}</p>
            )}

            {item.descricaoComercial && (
              <div className="mt-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {item.descricaoComercial}
              </div>
            )}

            {item.especificacoesPublicas && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-2">
                  Especificações Técnicas
                </h2>
                <div className="bg-white border border-slate-100 rounded-xl p-4 text-sm text-slate-600 whitespace-pre-wrap">
                  {item.especificacoesPublicas}
                </div>
              </div>
            )}

            {item.videoUrl && (
              <a
                href={item.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 text-sm text-blue-600 hover:underline"
              >
                <Globe className="h-4 w-4" />
                Ver vídeo demonstrativo
              </a>
            )}

            {/* Arquivos e links do item (manuais, fichas técnicas, etc.) */}
            {item.arquivos.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-semibold text-slate-900 mb-2">
                  Documentos e links
                </h2>
                <ul className="space-y-1.5">
                  {item.arquivos.map((a) => (
                    <li key={a.id}>
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:underline"
                      >
                        {a.tipo === "ARQUIVO" ? (
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                        ) : (
                          <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
                        )}
                        <span>{a.titulo}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA */}
            <div className="mt-8 flex flex-col gap-2">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors"
                >
                  <MessageCircle className="h-5 w-5" />
                  {textoWpp}
                </a>
              )}
              {empresa.email && (
                <a
                  href={`mailto:${empresa.email}?subject=${encodeURIComponent(
                    `Orçamento — ${item.nome}`
                  )}`}
                  className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                >
                  <Mail className="h-5 w-5" />
                  Solicitar por e-mail
                </a>
              )}
            </div>

            {/* Contatos */}
            <div className="mt-6 pt-4 border-t border-slate-100 text-sm text-slate-500 space-y-1">
              {empresa.telefone && (
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" /> {empresa.telefone}
                </p>
              )}
              {empresa.email && (
                <p className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" /> {empresa.email}
                </p>
              )}
              {empresa.site && (
                <p className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5" /> {empresa.site}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-slate-400">
        {empresa.name} — catálogo de locação
      </footer>
    </div>
  );
}
