import { prisma } from "@/lib/prisma";
import { linkMaps, linkWaze, enderecoDoLocal } from "@/lib/nestor";
import { configOsPublica } from "@/lib/os-publica";
import {
  MapPin,
  CalendarDays,
  Package,
  Users,
  Navigation,
  ClipboardList,
  MessageCircle,
  Paperclip,
  FileText,
  Link2,
  Info,
  History,
} from "lucide-react";

// Página pública SIMPLIFICADA da OS — link enviado à equipe pelo assistente de
// WhatsApp. Sem valores financeiros e sem necessidade de login.

export const dynamic = "force-dynamic";

function fmtData(d: Date | null | undefined) {
  return d ? new Date(d).toLocaleDateString("pt-BR") : null;
}
function fmtDataHora(d: Date | null | undefined) {
  if (!d) return null;
  const x = new Date(d);
  return `${x.toLocaleDateString("pt-BR")} às ${x.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default async function OsPublicaPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const os = await prisma.ordemServico.findUnique({
    where: { publicToken: token },
    include: {
      orcamento: {
        include: {
          local: true,
          salas: {
            include: {
              itens: {
                include: {
                  item: { select: { nome: true, codigo: true, natureza: true } },
                },
              },
            },
          },
        },
      },
      itensExtras: { include: { item: { select: { nome: true, codigo: true } } } },
      escala: { include: { membro: { select: { nome: true, telefone: true, email: true } } } },
      anexos: { orderBy: { createdAt: "desc" } },
      alteracoes: { orderBy: { createdAt: "desc" }, take: 40 },
    },
  });

  if (!os) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-4xl mb-3">🔍</p>
          <h1 className="text-lg font-semibold text-slate-800">Link inválido ou expirado</h1>
          <p className="text-sm text-slate-500 mt-1">Peça um novo link à produção.</p>
        </div>
      </div>
    );
  }

  const orc = os.orcamento;
  const local = orc?.local;
  const empresa = await prisma.company.findUnique({
    where: { id: os.companyId },
    select: { name: true, logoUrl: true, telefone: true, osPublicaConfig: true },
  });
  const cfg = configOsPublica(empresa?.osPublicaConfig);

  const maps = linkMaps(local);
  const waze = linkWaze(local);
  const endereco = enderecoDoLocal(local);

  const produtores = (
    Array.isArray(os.produtores) ? os.produtores : []
  ) as { nome?: string; telefone?: string; funcao?: string; observacao?: string }[];

  function waMe(telefone: string) {
    let d = telefone.replace(/\D/g, "");
    if (!d.startsWith("55")) d = `55${d}`;
    return `https://wa.me/${d}`;
  }

  const equipamentos =
    orc?.salas.flatMap((s) =>
      s.itens
        .filter((it) => it.item?.natureza !== "SERVICO")
        .map((it) => ({
          quantidade: it.quantidade,
          nome: it.item?.nome || "—",
          codigo: it.item?.codigo,
          sala: s.nome,
        }))
    ) || [];

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        {/* Cabeçalho */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 text-center">
          {empresa?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={empresa.logoUrl}
              alt={empresa.name}
              className="max-h-12 mx-auto mb-2 object-contain"
            />
          ) : (
            <p className="text-sm font-semibold text-slate-700 mb-1">{empresa?.name}</p>
          )}
          <h1 className="text-xl font-bold text-slate-900">
            OS #{orc?.numero} — {orc?.eventoNome || "Evento"}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Ordem de serviço operacional · sem valores
          </p>
        </div>

        {/* Datas e horários */}
        {cfg.datas && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-900">Datas e horários</h2>
          </div>
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between">
              <dt className="text-slate-500">Evento</dt>
              <dd className="font-medium text-slate-800">
                {fmtData(orc?.dataInicio) || "a definir"}
                {orc?.dataFim && fmtData(orc.dataFim) !== fmtData(orc.dataInicio)
                  ? ` até ${fmtData(orc.dataFim)}`
                  : ""}
              </dd>
            </div>
            {(os.horarioMontagem || os.obsMontagem) && (
              <div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">🔧 Montagem</dt>
                  <dd className="font-medium text-slate-800">
                    {fmtDataHora(os.horarioMontagem) || "a combinar"}
                  </dd>
                </div>
                {os.obsMontagem && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1 mt-1">
                    📝 {os.obsMontagem}
                  </p>
                )}
              </div>
            )}
            {(os.horarioDesmontagem || os.obsDesmontagem) && (
              <div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">📦 Desmontagem</dt>
                  <dd className="font-medium text-slate-800">
                    {fmtDataHora(os.horarioDesmontagem) || "a combinar"}
                  </dd>
                </div>
                {os.obsDesmontagem && (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1 mt-1">
                    📝 {os.obsDesmontagem}
                  </p>
                )}
              </div>
            )}
          </dl>
        </div>
        )}

        {/* Local + navegação */}
        {cfg.local && (local || endereco || os.obsLocal) && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">Local</h2>
            </div>
            <p className="text-sm font-medium text-slate-800">{local?.nome}</p>
            {endereco && <p className="text-sm text-slate-500">{endereco}</p>}
            {os.obsLocal && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-2 py-1 mt-2">
                📝 {os.obsLocal}
              </p>
            )}
            {(maps || waze) && (
              <div className="grid grid-cols-2 gap-2 mt-3">
                {maps && (
                  <a
                    href={maps}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white text-sm font-medium py-2.5 hover:bg-blue-700 transition-colors"
                  >
                    <Navigation className="h-4 w-4" />
                    Google Maps
                  </a>
                )}
                {waze && (
                  <a
                    href={waze}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl bg-sky-500 text-white text-sm font-medium py-2.5 hover:bg-sky-600 transition-colors"
                  >
                    <Navigation className="h-4 w-4" />
                    Waze
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Informações do evento — texto livre do responsável */}
        {cfg.infoEvento && os.infoEvento && (
          <div className="bg-white rounded-2xl border-2 border-blue-200 shadow-sm p-5">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">Informações do evento</h2>
              </div>
              {os.infoEventoEm &&
                Date.now() - new Date(os.infoEventoEm).getTime() < 48 * 60 * 60 * 1000 && (
                  <span className="rounded-full bg-blue-600 text-white text-[11px] font-semibold px-2.5 py-0.5 animate-pulse">
                    🔄 ATUALIZADO
                  </span>
                )}
            </div>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{os.infoEvento}</p>
            {os.infoEventoEm && (
              <p className="text-xs text-blue-600 font-medium mt-3 border-t border-blue-50 pt-2">
                Última atualização:{" "}
                {new Date(os.infoEventoEm).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {os.infoEventoPor ? ` · por ${os.infoEventoPor}` : ""}
              </p>
            )}
          </div>
        )}

        {/* Produtores / contatos no evento */}
        {cfg.produtores && produtores.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-900">Contatos no evento</h2>
            </div>
            <ul className="space-y-2">
              {produtores.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.nome}</p>
                    {p.funcao && <p className="text-xs text-slate-400">{p.funcao}</p>}
                    {p.observacao?.trim() ? (
                      <p className="text-xs text-slate-600 bg-slate-50 rounded-md px-2 py-1 mt-1">
                        {p.observacao}
                      </p>
                    ) : null}
                  </div>
                  {p.telefone && (
                    <a
                      href={waMe(p.telefone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-500 text-white text-xs font-medium px-3 py-2 hover:bg-emerald-600 transition-colors shrink-0"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Arquivos e links */}
        {cfg.anexos && os.anexos.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Paperclip className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">Arquivos e links</h2>
            </div>
            <ul className="space-y-1.5">
              {os.anexos.map((a) => (
                <li key={a.id}>
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-blue-600 hover:underline"
                  >
                    {a.tipo === "ARQUIVO" ? (
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    ) : (
                      <Link2 className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <span className="truncate">{a.titulo}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Equipe escalada */}
        {cfg.equipe && os.escala.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">Equipe escalada</h2>
            </div>
            <ul className="text-sm space-y-1.5">
              {os.escala.map((e) => (
                <li key={e.id} className="border-b border-slate-50 pb-1.5">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">
                      {e.membro?.nome}
                      {e.funcao ? <span className="text-slate-400 font-normal"> · {e.funcao}</span> : null}
                    </span>
                    <span className="text-slate-500 text-xs">
                      {e.horarioEntrada
                        ? new Date(e.horarioEntrada).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>
                  {cfg.equipeContatos && (e.membro?.telefone || e.membro?.email) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-xs">
                      {e.membro?.telefone && (
                        <a href={waMe(e.membro.telefone)} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
                          📱 {e.membro.telefone}
                        </a>
                      )}
                      {e.membro?.email && (
                        <a href={`mailto:${e.membro.email}`} className="text-blue-600 hover:underline">
                          ✉️ {e.membro.email}
                        </a>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Equipamentos */}
        {cfg.equipamentos && (equipamentos.length > 0 || os.itensExtras.length > 0) && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">Equipamentos</h2>
            </div>
            <ul className="text-sm space-y-1">
              {equipamentos.map((eq, i) => (
                <li key={i} className="flex justify-between border-b border-slate-50 pb-1">
                  <span className="text-slate-700">
                    {eq.quantidade}x {eq.nome}
                    {eq.codigo ? <span className="text-slate-400"> ({eq.codigo})</span> : null}
                  </span>
                  <span className="text-xs text-slate-400">{eq.sala}</span>
                </li>
              ))}
              {os.itensExtras.map((ex) => (
                <li key={ex.id} className="flex justify-between border-b border-slate-50 pb-1">
                  <span className="text-red-600">
                    {ex.quantidade}x {ex.item?.nome}
                    {ex.item?.codigo ? <span className="text-red-400"> ({ex.item.codigo})</span> : null}
                  </span>
                  <span className="text-xs text-red-400">extra / acessório</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Observações */}
        {cfg.observacoes && os.observacoes && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardList className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">Observações</h2>
            </div>
            <p className="text-sm text-slate-600 whitespace-pre-wrap">{os.observacoes}</p>
          </div>
        )}

        {/* Histórico de alterações — toda a equipe acompanha */}
        {cfg.historico && os.alteracoes.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <History className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-slate-900">Histórico de alterações</h2>
            </div>
            <ul className="space-y-2">
              {os.alteracoes.map((a) => (
                <li key={a.id} className="flex gap-3 text-sm">
                  <div className="flex flex-col items-center pt-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-400 shrink-0" />
                    <span className="w-px flex-1 bg-slate-100" />
                  </div>
                  <div className="pb-1 min-w-0">
                    <p className="text-slate-700">{a.descricao}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(a.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {a.autor ? ` · ${a.autor}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 pb-4">
          {empresa?.name}
          {empresa?.telefone ? ` · ${empresa.telefone}` : ""}
        </p>
      </div>
    </div>
  );
}
