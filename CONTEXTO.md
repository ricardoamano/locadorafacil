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

### Indicadores (KPIs) — /indicadores (módulo "indicadores")
- Períodos: dia/semana/quinzena/mês/trimestre/semestre/ano, navegação ‹ ›, sempre vs período anterior.
- Base: doc de KPIs da Neostore (docs/… enviado pelo Ricardo) + benchmarks do setor (conversão 30–50%,
  utilização tempo 65–75%, dollar utilization 55–65%, PMR 45–60d agências, concentração >60% = risco).
- 5 essenciais em destaque: margem média por evento, utilização do parque, pipeline 90d (foto de hoje),
  conversão de propostas, PMR. Seções Comercial/Financeiro/Operacional + tabela margem por evento.
- Cálculos (/api/indicadores): eventos = orçamentos APROVADO por dataInicio; custos por evento = despesas
  vinculadas ao orçamento + cachês (EscalaMembro.cache) + sublocação (OsItemExtra.custo); utilização por
  categoria = qtd×diárias ÷ estoque×dias; dollar utilization exige Item.valorReposicao; PMR = dataRecebimento
  − aprovadoEm das receitas PAGO; recompra, concentração top3, demanda perdida (REPROVADO/CANCELADO).
- "Analisar com IA" (/api/indicadores/ia): leitura executiva Markdown com alertas e ações vs benchmarks.
- Para os números ficarem completos: lançar custos por evento, cachês na escala e valorReposicao nos itens.

### Financeiro
- Dashboard cards, fluxo mensal (todas transações), por banco/categoria, ATRASADO virtual, marcar pago (PATCH parcial),
  recorrência (k/N), headers ordenáveis, CSV, bancos por empresa, banco por transação.

### Integrações Google (sem OAuth — feeds iCal privados)
- Agenda por EMPRESA: `Company.icsToken` → /api/ics/[token] (admin gerencia no Calendário). Gera o evento
  do período + eventos separados de 🔧 montagem (`Orcamento.dataMontagem` ou `OS.horarioMontagem`) e
  📦 desmontagem (`OS.horarioDesmontagem`) quando caem fora do período.
- Calendário interno (`calendario-view.tsx`): alternador **"Todos os dias" / "Só marcos"** (montagem · 1º dia ·
  último dia · desmontagem), preferência salva por aparelho em localStorage. Além disso, cada orçamento escolhe
  **"Como aparece na agenda"** (seção 2 do formulário): `Orcamento.agendaModo` = TODOS | MARCOS (só 1º e último
  dia — locações longas) | DATAS (dias escolhidos à mão em `agendaDatas` ["YYYY-MM-DD"], ex.: orçou 7 dias e o
  totem roda em 3). Vale no calendário e no feed iCal, independente do alternador global. Helpers em
  `src/lib/agenda-orcamento.ts`. `agendaSoMarcos` é legado (migrado para agendaModo=MARCOS). `/api/orcamentos` inclui
  `os.horarioMontagem/horarioDesmontagem` para isso.
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
  resposta truncada por max_tokens é aproveitada parcialmente (toast avisa "leitura parcial"). Campo "Empresa
  fonte (opcional)" no colar texto sobrepõe a detecção; IA instruída a devolver null (nunca "não identificado").
  Tabela mostra "Importado em" (createdAt). **Manutenção com IA** (/api/precos-mercado/ia): orientação em
  linguagem natural ("apague os da empresa X", "exclua importados há +1 ano", "reajuste diárias em 10%") →
  IA recebe retrato do banco (groupBy fonte/documento com datas) e devolve plano {resposta, acoes[deletar|
  atualizar c/ filtro fonte/equipamento/marca/documento/antesDe/depoisDe, percentual multiply]} → tela mostra
  prévia com nº de afetados → só executa (etapa=executar) após confirmação do usuário.
- **Módulo Ajuda** (/ajuda): chat que responde "quem tem X" / "quanto custa a diária" com base no PrecoMercado
  + estoque próprio; nunca inventa; sugere alimentar o banco.
- **Importar OS de posto** (Postos de Serviço → "Importar OS do posto"): anexa a OS que o posto enviou (mesmos
  formatos do Banco de Preços, via `src/lib/documentos.ts` compartilhado) ou cola o texto → Sonnet extrai posto/
  nº OS externa/evento/datas/local/contatos/salas+itens (natureza EQUIPAMENTO|SERVICO) → tela de revisão (Select
  do posto; sem seleção cadastra o posto detectado como novo Contact isPostoServico) → cria Orcamento (itens
  casados com o catálogo por nome/apelidos/modelo; não casados viram Item novo, padrão dos acessórios). Extração
  fica em `OsPostoImportada` (companyId/clienteId/orcamentoId/documento/dados Json) — a última OS do mesmo posto
  vira exemplo de padrão no prompt das próximas análises.
- **Autofill locais/clientes** (PreencherIa) e **chat de propostas** no Projeto Especial (usa iaInstrucoes).
- ÚNICO passo do usuário: criar chave em platform.claude.com e colar em Configurações → IA.

### Postos de serviço (consolidação mensal)
- Cliente com `isPostoServico`. Ao lançar/importar OS de posto, orçamento entra **APROVADO** e gera OS
  automaticamente. A aprovação de orçamento de posto **NÃO cria receita individual** (branch no PUT e PATCH
  de /api/orcamentos/[id] checando cliente.isPostoServico).
- Fechamento mensal (Postos → "Fechar fatura do mês", componente `FechamentoMensal`): /api/postos-servico/
  fechar-fatura GET(prévia)/POST — soma orçamentos APROVADO do posto no mês com `postoFaturaId=null`, gera
  1 Fatura (origem POSTO_MENSAL, isPostoServico) + 1 receita, marca os orçamentos com postoFaturaId.

### Permissões (correção importante)
- Bug: JWT lia módulos/role só no login → remover acesso de usuário logado não fazia efeito. Corrigido em
  src/lib/auth.ts: callback jwt reconsulta role/permissions/ativo no banco a cada 30s (token.permCheck);
  usuário desativado → logout; erro de banco → mantém token (fail-open). Config → Usuários salva em
  User.permissions = { modulos: [...] }.

### Kits — preço manual
- KitItem.valorUnitario (null = usa diária do item). Cadastro do kit: coluna de preço manual por item
  (sugere a diária ao escolher). Total do kit e aplicarKit no orçamento respeitam o valor manual.

## Pendências / próximos passos possíveis
### FILA DE PEDIDOS DO RICARDO
1. ✅ **Tarefas**: atribuição a usuários (TarefaUsuario) + recorrência estilo Google Agenda
   (DIARIA/SEMANAL/MENSAL/ANUAL + "repetir até"; ao concluir gera a próxima). `src/lib/tarefas-recorrencia.ts`.
2. ✅ **CRM — cadência de follow-up**: módulo `/crm` (`src/lib/crm.ts`), log `CrmFollowUp`, cron diário
   `/api/crm/rotina` (11h UTC) gera tarefa de cobrança p/ orçamentos vencidos (idempotente por orçamento).
   Ganhou/Perdeu no follow-up muda o status do orçamento. Cadência: 2d após criar, +3d por contato,
   urgência se evento <=7d.
3. ✅ **Ajuda**: histórico de conversas por usuário (`AjudaConversa`), sidebar estilo ChatGPT em `/ajuda`.
4. ✅ **Skills múltiplas + chat de escala na OS**: `Company.iaSkills` (tipos PROPOSTA/ESCALA/GERAL),
   Configurações → IA gerencia a lista; chat `OsEscalaIa` na OS (`/api/ordens-servico/[id]/escala-ia`)
   usa a skill ESCALA + contexto da OS (equipamentos, datas, local, equipe, veículos).
5. 🔄 **Features de ERP/CRM de mercado com IA** (pedido amplo — em andamento):
   ✅ Funil visual (Kanban) em `/orcamentos/funil` — arrastar entre colunas muda o status via PATCH.
   Próximos do menu (confirmar prioridade com Ricardo): visão 360 do cliente (LTV + rentabilidade),
   previsão de demanda de equipamentos por data, NPS/pós-evento automático, lead scoring, automações.

### Pedidos extras atendidos (13/07/2026, mesma sessão)
- ✅ **Vínculo usuário↔membro** (`Membro.userId` @unique): Well e Ricardo podem ser usuário E membro.
  Select "Usuário do sistema" no cadastro do membro; validação em `src/lib/membros.ts`.
- ✅ **Especialidades por empresa** (`Especialidade.companyId`, `/api/especialidades`): chips no cadastro
  do membro + criação inline (ex.: "Técnico de som básico").
- ✅ **Avaliação/feedback de freelancers**: `Avaliacao` ganhou postura/tecnica/pontualidade/proatividade
  (1-5), evento, autor. Modal ⭐ na tela de membros, média e histórico. API `/api/membros/[id]/avaliacoes`.
- ✅ **Escala por horário na OS**: campos Entrada e Saída (dia+hora) por técnico; cálculo automático de
  horas trabalhadas com alerta de extras acima de 12h (const `HORAS_CACHE` em os-detail.tsx).
- ✅ **Kanban de tarefas**: toggle Lista/Kanban em /tarefas; arrastar muda status via PATCH
  (concluir recorrente gera próxima). Filtro por especialidade na lista de membros.
- ✅ **Itens**: subcategorias (gestão inline em Categorias + select no item), acessórios avulsos
  (`ItemAcessorioAvulso`, checklist no romaneio ☐ e alerta "Separar junto" na conferência) e
  arquivos do item (`ItemArquivo`, `/api/itens/[id]/arquivos` — manuais/vídeos/qualquer espécie).
- ✅ **Pós-evento na OS**: posSucessos/posProblemas/posFeedback/posComentarios com carimbo; botão ⭐
  por técnico escalado (avalia direto da OS, evento como referência); card "Resumo dos eventos do
  período (IA)" nos Indicadores (`/api/ia/resumo-eventos`).
- ✅ **Veículos**: documentos anexos (`VeiculoArquivo`) e manutenções genéricas (`VeiculoManutencao`:
  tipo livre, data, km, custo, próxima por data/km, obs, comprovantes) — botão 🔧 na lista.
- ✅ **Contratos com IA + versões**: skill tipo CONTRATO; `/api/contratos/gerar-ia` escolhe orçamento
  e redige contrato (v1) com dados de cliente/equipamentos/serviços/valores. `ContratoVersao`: cada
  salvamento de conteúdo cria versão nova (nunca sobrescreve). PDF em `/contratos/[id]/imprimir?v=N`
  com nome CONTRATO_ORC{n}_{CLIENTE}_v{versão}. Botões: Gerar com IA, histórico vN, impressora.

### Outras pendências antigas
- Ricardo ainda precisa colar a chave da Claude API (sem ela os botões ✨ retornam aviso).
- Teste do WhatsApp: provável janela de 24h da Meta; oferta em pé: template aprovado Meta p/ iniciar conversas.
- Ofertas não pedidas: OAuth Google 2-way, versionamento de PDF v2/v3, permissões por ação, seed/limpeza de demo.
- Bug reportado e corrigido nesta sessão: acessórios eram invisíveis (emCatalogo=false), fotos/preços falhavam
  em silêncio (web_search em modelo errado). Validar em produção com a chave de IA ativa.

## Migração do sistema antigo (Bubble) — IMPORTAÇÃO
Sistema antigo = Bubble (workspaceId `W4YU5IH34UIYN`). Ids do Bubble no formato `1725...x...`.
Guardamos o id de origem em `Contact.bubbleId` e `Local.bubbleId` (índice por companyId+bubbleId).
- **Clientes** (`/api/import/clientes`, `ImportarClientes` em Clientes): 2 CSVs (Clientes sem id +
  Contatos com `clienteId`). O vínculo cliente↔contato é reconstruído pela lista de nomes
  (`src/lib/import-bubble.ts`), grava `bubbleId` = clienteId do Bubble. 133 clientes, 171 contatos,
  testes filtrados. Endereço dos clientes: botão **Completar endereços (CNPJ)** (`/api/import/completar-cnpj`,
  BrasilAPI) — proxy do dev bloqueia, mas Vercel acessa.
- **Locais/espaços** (`/api/import/locais`, `ImportarLocais` em Locais): CSV de Locais (nome + endereco[rua]
  + `unique id`) + CSV de Endereços opcional (cruza rua→CEP/número quando única). 129 espaços, todos com id,
  83 com endereço completo. Grava `Local.bubbleId` = unique id.
- **Orçamentos, OS e faturas — FEITO via Data API do Bubble** (12/09/2026). Conexão em
  `Company.bubbleAppUrl/bubbleApiToken` (app `neostore-17880.bubbleapps.io/version-test`), estrutura
  descoberta em `Company.bubbleMeta`. Libs: `src/lib/bubble-api.ts` (meta/paginação) e
  `src/lib/bubble-migracao.ts` (mapeamento). Idempotente por `bubbleId` em Orcamento/Fatura/OrdemServico/Item.
  Cruzamentos: local por bubbleId; cliente por bubbleId ou nome fantasia; item por bubbleId, nome+modelo ou nome
  (cria "a revisar"). Campos do Bubble vêm pelo *display name* ("Cliente 1", "Codigo-num", "Nome Fantasia"...).
  Status mapeado em `mapearStatus()`. Numeração inicial de orçamento/fatura avança após o maior importado.
  Resultado da 1ª rodada: 192 orçamentos, 106 OS, 130 faturas, 165 itens novos.
  Não importado (por decisão): `objfinanceiro` (236 lançamentos) e PDFs antigos.
  **Financeiro:** as faturas importadas não geravam receita. Em 12/09/2026 foram criadas (SQL) 16 receitas
  PENDENTES para as faturas com vencimento de hoje em diante (R$ 179.380, data = vencimento, `faturaId` ligado);
  faturas já vencidas ficaram fora (caixa antigo está no Bubble). A migração agora faz isso sozinha
  (`rel.receitasCriadas`).

### 🧰 Ferramentas de migração — INVENTÁRIO (ocultar quando o sistema estiver em uso pleno)
Interruptor único: `Company.ferramentasMigracao` (default true). Superadmin desliga em
**Configurações → Migração do Bubble → "Ocultar ferramentas"**. Hook `useFerramentasMigracao()`
(`src/lib/use-migracao.ts`) lê `/api/me` → `empresa.ferramentasMigracao`. Nada é apagado; só some da UI.
Botões/telas cobertos pelo interruptor:
1. **Ativos → "Importar"** (`/ativos/importar`: colar lista + IA, CSV com mapeamento, revisão de divergências) — `itens-list.tsx`.
2. **Clientes → "Importar"** (CSV do Bubble + revisão) — `contacts-list.tsx` / `importar-clientes.tsx`.
3. **Clientes → "Completar endereços (CNPJ)"** (BrasilAPI) — `contacts-list.tsx`.
4. **Locais → "Importar"** (CSV do Bubble + revisão) — `locais-list.tsx` / `importar-locais.tsx`.
5. **Menu Configurações → "Migração do Bubble"** (`/configuracoes/bubble`: conexão, ler estrutura,
   completar cadastros, prévia/importar orçamentos-OS-faturas) — `sidebar.tsx` (item filtrado).
   A página continua acessível por URL para religar o interruptor.
6. **Equipe → Membros → "Importar"** (direto do Bubble — tipos `equipe` + `especialidade_tecnicos` — ou CSV
   genérico com coluna Nome; cruza por `Membro.bubbleId`, CPF ou nome; revisão de divergências; cria
   especialidades que faltam) — `equipe/membros/page.tsx` / `importar-membros.tsx` / `src/lib/membros-importar.ts`
   / `/api/import/membros`.
Ficam SEMPRE (são operação, não migração): filtro/selo **"A revisar"** nos itens, cadastro de itens pelo
WhatsApp ("cadastra 4 TVs..."), Exportar CSV, Backup.

## Convenções de comunicação com o Ricardo
- Relatórios em pt-BR, liderando com o resultado, com seção "🧪 Teste:" no final.
- Sempre honesto sobre limitações (ex.: Meta 24h, fotos dependem da web).
- Multiempresa é requisito permanente; "quanto mais simples, melhor".
- **Mobile first, sempre**: o sistema é usado no celular e no tablet (galpão, evento, deslocamento).
  Toda tela/botão novo precisa funcionar bem a ~400px (empilhar colunas, botões alcançáveis, tabelas
  com rolagem horizontal própria, nada dependente de hover).
