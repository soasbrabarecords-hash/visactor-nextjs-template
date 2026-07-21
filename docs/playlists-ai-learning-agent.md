# Agente de aprendizado do Playlists IA

## Objetivo

O Playlists IA passa a ter um ranqueador em Python que aprende com decisões reais
de curadoria sem permitir autoalteração irrestrita. O Next.js continua responsável
por autenticação, leitura das fontes autorizadas e confirmação de qualquer mudança
no Spotify. O serviço Python recebe candidatos já autorizados, ordena as faixas,
registra o que foi exibido e aprende com feedback posterior.

"Aprender" neste projeto significa melhorar um modelo versionado a partir de
evidência mensurável. Não significa consciência, pensamento independente ou
permissão para executar ações fora das políticas do produto.

## Fluxo

```text
charts + playlists + perfis de gênero
                 |
                 v
       geração de candidatos (Next.js)
                 |
                 v
     ranking e diversidade (Python)
                 |
                 v
      seleção explicável no produto
                 |
                 v
  salvar / ignorar / adicionar / remover
                 |
                 v
 impressão congelada + feedback idempotente
                 |
                 v
 treino temporal -> avaliação -> promoção/rollback
```

Se o serviço Python não estiver configurado, exceder o tempo limite ou devolver
uma resposta inválida, o score determinístico atual continua sendo usado. Uma
falha de aprendizado nunca deve impedir a curadoria.

## O que o anexo representa

O levantamento de janeiro de 2021 a julho de 2026 foi normalizado em
`services/playlists_ai_agent/data/rap_trap_br_2021_2026.json`. Ele é uma base de
conhecimento editorial, não um conjunto de exemplos supervisionados.

O material pode contribuir com sinais pequenos de relevância histórica, força de
catálogo, eras e relações da cena de rap/trap. Ele não pode:

- substituir charts, catálogo, contexto da playlist ou feedback do usuário;
- ser tratado como preferência universal;
- ser usado em backtests anteriores à data em que ficou conhecido;
- empurrar rap/trap para playlists de outros universos musicais;
- transformar uma afirmação editorial em fato quantitativo verificado.

Cada versão do conhecimento possui `known_at`, período coberto, proveniência e
limitações. O motor zera esses priors quando o `as_of` da inferência é anterior a
`known_at`.

## Aprendizado e promoção

No cold start, o Python preserva o baseline de oportunidade e fit. Os eventos
explícitos recebem pesos diferentes: adicionar e manter são sinais positivos
fortes; salvar e fixar são sinais positivos mais fracos; ignorar ou remover são
sinais negativos. Ausência de clique não vira rejeição automaticamente.

O serviço guarda, para cada faixa exibida, o snapshot das features, posição,
score, versão do modelo e probabilidade de exposição. Assim o treino não consulta
dados futuros para reconstruir o passado.

O modelo candidato é treinado em eventos mais antigos e validado nos mais novos.
A promoção automática só ocorre quando existem exemplos positivos e negativos em
volume mínimo, a qualidade melhora contra o modelo ativo e os guardrails passam.
Cada tentativa gera um registro auditável; uma versão anterior permanece
disponível para rollback.

Com mais volume, o ranker incremental inicial pode ser substituído por um modelo
learning-to-rank em shadow mode. A troca não deve alterar o contrato da API nem o
registro de impressões.

Na versão `0.1`, os pesos aprendidos são compartilhados dentro do workspace. O
contexto de cada playlist continua entrando pelo `playlist_fit` já calculado no
produto, mas ainda não existe um modelo independente por playlist. A
especialização por playlist só deve ser ativada depois que cada uma tiver volume
suficiente de positivos e negativos; antes disso, ela aumentaria overfitting.

O produto já emite `save`, `pin`, `ignore` e `add`. O serviço aceita outcomes
como permanência em 7/30 dias e remoção, porém esses rótulos atrasados ainda
dependem de uma rotina futura que compare snapshots de playlist. Eles não são
inventados a partir de ausência de clique.

## Autonomia permitida

O agente pode automaticamente:

- ordenar candidatas dentro das restrições recebidas;
- reservar uma cota pequena e limitada para descoberta;
- registrar impressões e feedback;
- detectar se há dados suficientes para retreinar;
- treinar, avaliar e promover uma versão que passe os guardrails;
- produzir razões curtas e métricas de auditoria.

O agente não pode automaticamente:

- adicionar, remover ou reordenar faixas no Spotify;
- ampliar mercados, gêneros ou workspaces além do pedido;
- alterar os próprios limites de segurança;
- usar texto de conversas ou dados pessoais como alvo sem consentimento e
  política específica;
- promover um modelo sem evidência temporal suficiente.

## Contratos HTTP

O serviço expõe:

- `GET /health`: saúde, armazenamento e versão do conhecimento;
- `POST /v1/rank`: ranking de candidatas e registro das impressões;
- `POST /v1/feedback`: feedback idempotente ligado a uma impressão válida;
- `POST /v1/maintenance/run`: treino, avaliação e promoção controlada.

Quando `PLAYLISTS_AI_SERVICE_TOKEN` estiver configurado no Python, as rotas
mutáveis exigem `X-Playlists-AI-Token`. O Next.js usa
`PLAYLISTS_AI_PYTHON_TOKEN` com o mesmo valor. O serviço não deve ficar exposto
publicamente sem essa proteção.

## Métricas para evolução anual

"Mais assertivo" precisa ser medido por período e segmento. As métricas mínimas
são:

- taxa de adição e de salvamento;
- permanência após 7 e 30 dias;
- remoção precoce;
- NDCG@K ou outra métrica de qualidade de ordenação;
- cobertura de catálogo e diversidade por artista;
- concentração nos artistas mais populares;
- resultados separados por workspace, gênero, mercado e cold start.

A avaliação recomendada é walk-forward: treinar até um ponto no tempo e avaliar
no período seguinte. Divisão aleatória permitiria que sinais do futuro vazassem
para o passado e produziria uma melhora artificial.

O primeiro ranker promove versões com holdout temporal agrupado por pedido e
métricas de AUC, Brier e log-loss contra baseline e champion. NDCG@K,
permanência, cobertura e diversidade anual permanecem critérios de evolução para
quando a instrumentação atrasada e o volume por playlist existirem; não são
apresentados como métricas já coletadas.

## Operação

Para desenvolvimento local, o serviço pode usar SQLite no caminho configurado
por `PLAYLISTS_AI_DB_PATH`. Na Vercel ele usa o adapter Supabase Data API e falha
fechado se URL, chave server-only, store ou schema estiverem incompletos; não há
fallback para SQLite em `/tmp`.

O deploy usa Vercel Services: o Next.js é o serviço público e o FastAPI/Python é
um serviço privado. O binding injeta `PLAYLISTS_AI_PYTHON_URL` automaticamente no
Next.js. `PLAYLISTS_AI_PYTHON_TOKEN` e `PLAYLISTS_AI_SERVICE_TOKEN` devem conter o
mesmo segredo; `PLAYLISTS_AI_STORE=supabase` seleciona a persistência de produção.
Também são necessários `NEXT_PUBLIC_SUPABASE_URL` e uma chave server-only em
`SUPABASE_SECRET_KEY` (preferida) ou `SUPABASE_SERVICE_ROLE_KEY` (legacy).

Os timeouts ficam em `PLAYLISTS_AI_PYTHON_TIMEOUT_MS` e
`PLAYLISTS_AI_PYTHON_MAINTENANCE_TIMEOUT_MS`. Sem token, as rotas falham fechadas,
salvo o opt-in explícito e exclusivamente local
`PLAYLISTS_AI_ALLOW_INSECURE_DEV=true`.

O plano Hobby mantém os dois slots de cron existentes. Por isso, a manutenção do
agente roda dentro da ingestão diária de charts às 22:00 UTC, depois que os dados
foram persistidos. Ela também pode ser acionada manualmente por
`GET /api/cron/playlists-ai-learning`, sempre com `Authorization: Bearer
<CRON_SECRET>`. Uma execução sem exemplos é registrada como `skipped`; ela não
cria sinais artificiais nem promove um modelo.

Antes de habilitar treinamento com dados provenientes do Spotify, valide os
termos da plataforma, a base legal, retenção e política de privacidade. O ranking
editorial fornecido pelo usuário pode ser usado como prior, mas metadados e
comportamento de conta têm regras próprias.
