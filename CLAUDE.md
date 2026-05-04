# Contexto do Projeto Oásis Condomínio

> Documento para contextualizar uma nova sessão de IA (Claude/ChatGPT/etc) sobre o projeto.
> Última atualização: 2026-05.

---

## Visão geral

Sistema de gestão de manutenção predial para o **Edifício Oásis** (Recife/PE).
Permite ao síndico e zelador organizarem atividades rotineiras, intervenções corretivas, benfeitorias, orçamentos, diário de execuções, calendário, dashboards e canal direto com moradores.

## Stack técnica

- **Frontend**: React 19 + Vite 8 (sem TypeScript)
- **Backend / DB**: Supabase (Postgres + Auth + Storage)
- **Bibliotecas**: `recharts` (gráficos), `xlsx` (export Excel), Font Awesome 6 (ícones via CDN)
- **Deploy**: Vercel (via Vercel CLI `vercel --prod`) + repositório GitHub `Jader-henrique/oasis-condominio`
- **Local**: pasta `C:\Users\assun\oasis-condominio` (Windows)
- **Conexão Supabase**: hardcoded em `src/supabase.js` (URL + anon key)

## Estrutura de pastas relevante

```
src/
  pages/
    Layout.jsx              # Roteamento por menu lateral
    Login.jsx
    Dashboard.jsx           # Página inicial padrão
    AtividadesDiarias.jsx   # ex-"Calendário de Manutenções"
    Corretivas.jsx
    Benfeitorias.jsx
    Calendario.jsx          # Visão Outlook-style consolidada das 3 fontes
    Orcamentos.jsx          # ("Orçamentos de Fornecedores" no menu)
    Diario.jsx              # Diário de Manutenções
    Solicitacoes.jsx        # Canal morador → síndico
    Publicacoes.jsx
    Contas.jsx              # Plano de contas (orçamentário/contábil)
    AppZelador.jsx          # Mobile-first para perfil 'zelador'
    AppVistorias.jsx        # Mobile-first para perfil 'vistorias'
    MapaCotacoes.jsx        # Modal compartilhado: cotações + fechar negócio
    BuscaConta.jsx          # Modal compartilhado: pesquisar/criar conta
    ViewModal.jsx           # Modal genérico de visualização (duplo clique)
  utils/
    excel.js                # exportarParaExcel() com cabeçalho azul/branco
    useSort.jsx             # Hook + SortableTh para ordenação clicável
db/
  migrations/               # SQL incrementais (002 até 018)
```

## Perfis de usuário

| Perfil | Onde acessa | O que vê |
|---|---|---|
| `admin` ou `sindico` | Plataforma desktop completa | Todas as telas + botão "Vistorias" no header (entra no AppVistorias) |
| `condomino` | Plataforma desktop | Só Solicitações de Morador (suas próprias) |
| `zelador` | AppZelador (mobile) | Só atividades atribuídas à Zeladoria das 3 fontes |
| `vistorias` | AppVistorias (mobile) | Tudo, modo somente vistoria — alimenta diário com Conforme/Não conforme |

Definidos no enum/check `usuarios.perfil`.

## Modelo de dados — tabelas principais

### Três "fontes" de trabalho (mesma estrutura conceitual)

**`calendario`** (= Atividades do Dia a Dia, rotineiras)
- num, descricao, frequencia, mes, status, responsavel_tipo
- pontual (boolean) — se true, não recalcula próxima ocorrência
- proxima_data (date), realizado_em, realizado_por
- valor_previsto, valor_realizado (`valor` é coluna legada)
- conta_id → contas

**`corretivas`** (Intervenções pontuais reativas)
- num, item, prioridade, status, responsavel_tipo, recorrencia
- empresa (preenchido só ao fechar negócio via Mapa)
- valor_previsto, valor_realizado (preenchido via Mapa)
- data_inicio_prevista, data_inicio_real, data_fim
- conta_id → contas

**`benfeitorias`** (Investimentos planejados)
- num, sistema, categoria_id, prioridade, periodo, responsavel_tipo, recorrencia
- previsto (= início previsto), data_inicio_real, realizado (data via App)
- valor_previsto, valor_realizado (via Mapa)
- conta_id → contas

### Tabelas auxiliares

- **`orcamentos`** — propostas vinculadas via `(item_tipo, item_id)`. Campos: empresa, valor, data, prazo_entrega, condicao_pagamento, sem_orcamento (bool), selecionado (bool — indica negócio fechado), motivo_escolha, data_criacao, arquivo_url
- **`documentos_item`** — anexos vinculados a um item (item_tipo, item_id, nome, tipo, arquivo_url)
- **`diario`** — registro das execuções: data, ref, sistema, empresa, obs, evidencia_url, evidencias_urls (jsonb), item_tipo, item_id
- **`solicitacoes`** — canal morador. status: aberta | respondida | encerrada; anexos jsonb
- **`publicacoes`** — atas, projetos, comunicados (titulo, tipo, data, arquivo_url)
- **`categorias`** — usado em benfeitorias.categoria_id
- **`contas`** — plano de contas. id, descricao, grupo_orcamentario (enum: 'Atividades do Dia a Dia' | 'Intervenções Corretivas' | 'Benfeitorias'), codigo_contabil, excluido_em
- **`usuarios`** — id (uuid de auth.users), nome, perfil

### Soft delete

Todas as tabelas de itens (benfeitorias, corretivas, calendario, orcamentos, documentos_item, contas) têm `excluido_em timestamptz`. Toda query SELECT no front filtra `.is('excluido_em', null)`. Função `soft_delete_cascade_orcamentos(p_item_tipo, p_item_id)` cascateia exclusão para orçamentos vinculados.

### Storage buckets

- `documentos` — propostas de orçamento, contratos, publicações
- `evidencias` — fotos do diário, vistorias e atividades
Ambos públicos com RLS permissiva (autenticated + anon).

## Workflows críticos

### Orçamento → Fechar negócio (MapaCotacoes.jsx)

1. Usuário cadastra propostas vinculadas a um item (atividade/corretiva/benfeitoria)
2. Lista mostra propostas ordenadas por valor, com tag **"Menor Preço"**
3. Ao **Fechar negócio** com a mais barata: confirma direto. Se for outra: pede **motivo da escolha** (obrigatório)
4. Atualiza tabela origem:
   - **Corretiva**: `empresa = orc.empresa`, `valor_realizado = orc.valor`, `status = 'andamento'`
   - **Benfeitoria**: `valor_realizado = orc.valor` (não toca `previsto` que é início previsto)
   - **Atividade**: `valor_realizado = orc.valor`
5. **Fechar SEM orçamento** (emergencial): pede motivo, marca tudo como sem_orcamento+selecionado em vermelho
6. **Estornar**: limpa `selecionado`, restaura status anterior, deleta entradas sem_orcamento

### Execução → Diário + recálculo automático

- AppZelador / Diário: ao marcar item como realizado, alimenta `diario` E atualiza tabela origem
- Para atividades **não pontuais**: calcula `proxima_data = realizado_em + dias_da_frequencia`
- Para atividades **pontuais** (`pontual=true`): não recalcula
- DIAS_FREQ mapeia: Diário=1, Semanal=7, ..., Anual=365, "A Cada 5 Anos"=1825

### Validação data início real (Corretivas)

- Não pode ser maior que hoje (input `max=` + alert)
- Se preenchido sem `data_inicio_prevista`: confirm "Deseja usar a mesma data?" → sim auto-preenche ambos

## Padrões UI compartilhados

- **`useSort` hook** + `<SortableTh>` em todas as tabelas, default sort = "Início Previsto"
- **Duplo clique** na linha → `<ViewModal>` com lista de campos read-only e botão Editar
- **Ícone de lixeira vermelha** ao lado de Editar para soft delete
- **Cards do Dashboard** agrupados em "faixas" coloridas suaves por seção (azul/vermelho/lilás/amarelo/verde)
- Toggle pontual / liga-desliga: implementação custom de "switch" estilizado
- Máscara de moeda BRL: helpers `digitsToNum`, `moedaInputValue`, `fmtMoeda` (presentes em vários arquivos — boa oportunidade para centralizar em `utils/moeda.js` se quiser refatorar)
- Datas sempre exibidas DD/MM/YYYY via `fmtDataBR`/`fmtData`

## Filtros padronizados

- Status (pendentes/realizadas/todas) sempre defaulta a "pendentes"
- Filtros de período usam `<input type="date">`
- Filtros de tipo / responsável / recorrência via botões pill (active = azul)
- Calendário tem visões Semana/Mês/Ano (estilo Outlook)

## Migrações SQL — histórico

| # | Descrição |
|---|---|
| 002 | Tabela categorias + categoria_id em benfeitorias |
| 003 | Enum `periodo_enum` |
| 004 | Mais valores no enum + datas date em benfeitorias |
| 005 | Corretivas valor numeric + datas date |
| 006 | Reset inicial + estrutura base + valor numeric em benfeitorias |
| 007 | Solicitações + perfil vistorias + função proxima_data |
| 008 | Garantir colunas (idempotente, repara faltantes) |
| 009 | Políticas RLS iniciais |
| 010-012 | Fix RLS + storage buckets |
| 013 | Soft delete (`excluido_em`) + função cascade |
| 014 | Corretivas: valor_previsto + valor_realizado + datas separadas |
| 015 | Benfeitorias: idem |
| 016 | Atividades: flag `pontual` |
| 017 | Tabela `contas` + grupo_orcamentario_enum + conta_id nas 3 fontes |
| 018 | Atividades: valor_previsto + valor_realizado |

**Sempre idempotentes** (`if not exists`, `add column if not exists`, `on conflict do nothing`). Pode rodar repetido.

## Deploy

```cmd
cd C:\Users\assun\oasis-condominio
npm run build
vercel --prod
```

(Git instalado mas o usuário usa GitHub Desktop. O auto-deploy do Vercel via push do GitHub **não está configurado** — sempre usa CLI ou GitHub Desktop e depois `vercel --prod`.)

## Convenções de código

- Arquivos sempre reescritos via `cat > ... << EOF` no bash quando o linter/Edit dão problema (file system desync conhecido entre Read e bash)
- Validar build com `npx --yes esbuild src/pages/X.jsx --loader:.jsx=jsx > /dev/null && echo OK` — não usa o build completo do Vite (rolldown não roda no sandbox Linux do Claude Code)
- pt-BR em toda UI (textos, labels, mensagens, comentários)
- Inline styles (não há sistema de CSS-in-JS) — exceções na `index.css` (CSS variables `--azul`, `--verde`, `--vermelho`, `--lilas`, `--amarelo`, `--cinza`, e backgrounds `--xxx-bg`)

## Pontos de atenção / dívidas técnicas

1. Colunas legadas (não removidas para preservar histórico): `benfeitorias.valor`, `benfeitorias.previsto` (ambíguo: era data prevista, hoje é "início previsto"), `corretivas.valor`, `corretivas.data_inicio`, `calendario.valor`. Após validação em produção podem ser droppadas.
2. RLS está **permissiva total** (`to authenticated, anon using (true)`). Para refinar: morador só vê suas solicitações, etc.
3. Helpers de moeda/data duplicados em vários arquivos — candidatos a `src/utils/moeda.js` e `src/utils/data.js`.
4. Excel export usa estilos básicos do SheetJS — para layout mais elaborado precisaria do `xlsx-js-style`.
5. Auto-deploy GitHub→Vercel não conectado (deploys via CLI manual).

## Como uma nova sessão deve começar

1. Ler este `CLAUDE.md`
2. `Glob` ou `ls` em `src/pages/` para ver o que existe
3. Ler arquivos específicos conforme a tarefa
4. Migrações novas vão em `db/migrations/019_*.sql` em diante
