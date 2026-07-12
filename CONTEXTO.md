# LocadoraFácil — Contexto do Projeto (resumo de sessão)

> Atualizado em 12/07/2026. Este arquivo é o resumo-mestre para retomar o desenvolvimento.
> Leia junto com AGENTS.md (avisos do Next.js 16) antes de escrever código.

## O que é
Sistema multiempresa de gestão de locação de equipamentos e serviços para eventos.
- Produção: **locadorafacil.app** (Vercel) · Empresa do dono: **Neostore Tecnologia para Eventos**
- Usuário: Ricardo (ricardoamano@gmail.com), fala português, quer autonomia total do agente
  (fazer tudo de ponta a ponta, só envolvê-lo quando for tecnicamente impossível).

## Stack e fluxo de trabalho
- Next.js 16 App Router + React 19 + Tailwind 4 + TypeScript. **Ler node_modules/next/dist/docs antes de codar (breaking changes!).**
- Prisma 7.8 (@prisma/adapter-pg) + Supabase Postgres (projeto `iynpsgacgcbbtjllikku`).
- Migrações: **sempre aditivas** via MCP Supabase `apply_migration`; tabelas novas precisam de
  `GRANT ALL PRIVILEGES ON "X" TO app_user;`. Depois: `npx prisma generate`.
- Fluxo por feature: schema → migração MCP → generate → `npx tsc --noEmit` → `npm run build` →
  commit/push em `claude/create-customer-module-4WqAY` (deploy automático Vercel).
- Commits: mensagem em pt-BR + trailers Co-Authored-By Claude + Claude-Session (nunca citar modelo em artefatos).
- NextAuth v5 JWT; middleware com matcher que EXCLUI rotas públicas:
  `login|register|catalogo|aprovar|os/|api/auth|api/aprovacao|api/arquivos|api/ics|api/ics-tarefas|_next...`
- Módulos/permissões em `src/lib/modulos.ts` (chaves fixas; ADMIN vê tudo; USER default = tudo menos configurações).
- Crons Vercel (`vercel.json`): `/api/nestor/lembretes` 12:00 UTC, `/api/backup/automatico` 03:00 UTC.
  Autorização do cron: `CRON_SECRET` (se setado) ou user-agent `vercel-cron`.
- Prisma `mode: "insensitive" as const` sempre. Parse de valores BR: se tem "," → tira pontos e troca vírgula.
- UI: componentes em `src/components/ui/` — Select híbrido (searchable/clearable/keywords, debounce 500ms),
  Modal, Input, Textarea, Button(loading), toast, ImageUpload, FotosUpload (galeria), PreencherIa, ExportarCsv.

## Mapa de funcionalidades (tudo implantado)

### Orçamentos
- Salas → itens (qtd × diárias × valorUnit; serviços natureza=SERVICO sem diárias), descrição comercial por linha.
- Cliente 1* + Cliente 2 (clearable, rótulos neutros, nunca chamar de "agência"); 1 contato por cliente (+Novo popup);
  fatura escolhe contra quem emite. Tipo de evento configurável, data de montagem, kits (aplicar pacote).
- Disponibilidade em tempo real: comprometidos (vermelho) e holds PENDENTE/AGUARDANDO (âmbar).
- Popups + Novo Cliente/Local/Item usam os formulários completos dos módulos.
- Status clicável na LISTA (popup muda status; PATCH /api/orcamentos/[id] idempotente).
- Aprovação (manual, popup ou link público /aprovar/[token]) → cria OS + receita transacional idempotente.
- PDF /orcamentos/[id]/imprimir: modelo GAEL — tabelas roxas #4b2a66 por sala, watts+kVA por sala
  (kVA total = qtd × kva, sem diárias), nome do arquivo `NUM_CLIENTE1_CLIENTE2_DDMMYY_DDMesaDDMes_v1`.
- **Projeto Especial** (projetoEspecial=true): conteúdo Markdown colado (renderer próprio `src/lib/markdown.ts`),
  cliente+contato+local (opcionais no PDF quando vazios), itens do catálogo (uma sala "Equipamentos e Serviços",
  entram na OS/romaneio/conferência), total = valorProjeto + itens − desconto, alerta de duplicidade item×texto,
  PDF /imprimir-projeto (PROPOSTA COMERCIAL roxa), editor /orcamentos/projeto/[id], chat "Gerar com IA".

### Ordem de Serviço (sem valores financeiros!)
- Conferência entrada/saída por QR (BarcodeDetector, fallback busca manual) sobre unidades serializadas
  (`ItemUnidade` codigo `0012-03`, estados EM_ESTOQUE/NO_EVENTO/MANUTENCAO/BAIXADA) + itens extras/acessórios
  em VERMELHO (cross-hire com fornecedor+custo → despesa).
- Escala de equipe (Membro tem telefone/email), produtores/contatos do evento (nome/whats/função/observação, wa.me),
  arquivos e links (OsAnexo, upload ≤4MB ou link), Informações do Evento (texto livre carimbado autor/hora, selo
  ATUALIZADO 48h), obs de montagem/desmontagem/local, histórico de alterações (OsAlteracao, autor+hora).
- **OS pública /os/[token]**: mobile, sem login/valores; seções configuráveis pelo admin em Configurações → OS Pública
  (10 toggles por empresa, `Company.osPublicaConfig`). Maps/Waze do local, contatos WhatsApp, anexos, histórico.
- Impressões: Romaneio de carga e Termo de Entrega e Aceite (cliente assina; Recebido ✓ / Estado-Obs).

### NESTOR / Assistente WhatsApp (por empresa)
- Nome configurável (`whatsappAssistente`), credenciais Cloud API Meta (phoneId+token) por empresa,
  templates ESCALA/ALTERACAO/LEMBRETE editáveis (variáveis {nome}{os}{periodo}{montagem}{entrada}{funcao}
  {local}{link_maps}{link_waze}{link_os}{produtores}{observacoes}...; linhas com placeholders vazios somem).
- Painel na OS: enviar escala/alteração/lembrete/avulsa aos escalados; sem API → links wa.me; log MensagemWhatsapp.
- Lembrete automático D-1 via cron. Regras Meta documentadas na tela (janela 24h, destinatários de teste, token).

### Financeiro
- Dashboard cards, fluxo mensal (todas transações), por banco/categoria, ATRASADO virtual, marcar pago (PATCH parcial),
  recorrência (k/N), headers ordenáveis, CSV, bancos por empresa, banco por transação.

### Integrações Google (sem OAuth — feeds iCal privados)
- Agenda por EMPRESA: `Company.icsToken` → /api/ics/[token] (admin gerencia no Calendário).
- Tarefas por USUÁRIO: `User.tarefasIcsToken` → /api/ics-tarefas/[token] (botão no módulo Tarefas).

### Backup e exportação
- Snapshot diário gzip por empresa (BackupSnapshot, retenção 14, sem senhas/token/binários), tela Configurações →
  Backup (gerar/baixar/excluir). CSV nos módulos Clientes/Fornecedores/Itens/Kits/Membros/Veículos (/api/exportar).
- Supabase Free: recomendação de assinar Pro US$25/mês quando entrar em produção (backups gerenciados).

### IA (Claude API por empresa — `Company.iaApiKey` + `iaInstrucoes`)
- Configurações → Inteligência Artificial (chave nunca exibida; skill de propostas editável).
- Modelos: `claude-haiku-4-5` (autofill), `claude-sonnet-5` (propostas, chat ajuda, fotos, preços web, PDFs).
- **Itens**: ordem Nome/Código → Marca(+Nova)/Modelo → ✨ Preencher com IA. Preenche specs do modelo real,
  watts (kVA auto = watts/800), descrição comercial, apelido comercial+apelidos, categoria, valorReposicao,
  FOTOS da web (Sonnet+web_search_20260209, baixa ≤3 imgs → Arquivo; aviso se não achar) e ACESSÓRIOS sugeridos
  (checklist → viram itens vinculados via `vincularAcessorios` em src/lib/acessorios.ts, emCatalogo=true, toast
  informa criados; edição mostra vinculados via /api/itens/[id]/acessorios). Publicado default=true. Galeria
  FotosUpload → Item.fotos (JSON de URLs).
- **Sugestões de preço de mercado** (card no item): 3 camadas — 1) Banco interno PrecoMercado (médias + empresas
  fonte), 2) web search, 3) estimativa com AVISO "não tivemos informações suficientes". Botões Aplicar por valor.
- **Banco de Preços de Mercado** (Ativos → Banco de Preços): importa orçamento de concorrente/parceiro por
  arquivo (PDF, XLSX/XLS via `xlsx`, CSV, DOCX via `mammoth`, TXT/MD) ou TEXTO COLADO (modal "Colar texto",
  aceita Markdown, POST JSON `{texto, nome?}`) → Sonnet extrai equipamento/marca/modelo/valores unitários +
  EMPRESA fonte → tabela PrecoMercado. Rotas de IA têm `maxDuration=60` (timeout Vercel matava o upload);
  resposta truncada por max_tokens é aproveitada parcialmente (toast avisa "leitura parcial").
- **Módulo Ajuda** (/ajuda): chat que responde "quem tem X" / "quanto custa a diária" com base no PrecoMercado
  + estoque próprio; nunca inventa; sugere alimentar o banco.
- **Autofill locais/clientes** (PreencherIa) e **chat de propostas** no Projeto Especial (usa iaInstrucoes).
- ÚNICO passo do usuário: criar chave em platform.claude.com e colar em Configurações → IA.

## Pendências / próximos passos possíveis
- Ricardo ainda precisa colar a chave da Claude API (sem ela os botões ✨ retornam aviso).
- Teste do WhatsApp: provável janela de 24h da Meta; oferta em pé: template aprovado Meta p/ iniciar conversas.
- Ofertas não pedidas: OAuth Google 2-way, versionamento de PDF v2/v3, permissões por ação, seed/limpeza de demo.
- Bug reportado e corrigido nesta sessão: acessórios eram invisíveis (emCatalogo=false), fotos/preços falhavam
  em silêncio (web_search em modelo errado). Validar em produção com a chave de IA ativa.

## Convenções de comunicação com o Ricardo
- Relatórios em pt-BR, liderando com o resultado, com seção "🧪 Teste:" no final.
- Sempre honesto sobre limitações (ex.: Meta 24h, fotos dependem da web).
- Multiempresa é requisito permanente; "quanto mais simples, melhor".
