# Playlists IA Agent

Serviço Python auto-hospedável para ranquear sugestões musicais, registrar o
que foi realmente exibido, aprender com feedback e promover modelos somente
depois de validação temporal.

O Next.js continua responsável por autenticar o usuário e executar mutações no
Spotify. Este serviço recebe candidatos já autorizados, devolve uma ordenação e
mantém um histórico auditável. Ele não reescreve o próprio código e não executa
ações no Spotify.

## O que está incluído

- FastAPI com `GET /health`, `POST /v1/rank`, `POST /v1/feedback` e
  `POST /v1/maintenance/run`;
- núcleo de domínio testável somente com a biblioteca padrão do Python;
- contrato de store com SQLite em WAL para desenvolvimento e Supabase Data API
  para runtimes stateless;
- paridade de cold start com o baseline TypeScript, aceitando também
  `baseline_score` calculado pelo cliente;
- modelo logístico incremental treinado em ordem temporal;
- reranking por diversidade de artistas e exploração limitada somente depois
  de existir um modelo promovido;
- feedback idempotente, identificação do ator, rate limit por ator e auditoria
  do destino real de uma adição;
- registry `candidate/active/retired/rejected`, comparação com o champion e
  promoção automática protegida por métricas;
- conhecimento editorial opcional, aplicado apenas a rap/trap e nunca antes de
  `metadata.known_at`.

`SupabaseDataApiStore` usa REST apenas para leituras e escritas unitárias. As
mutações multi-tabela ou sensíveis a concorrência usam RPCs PostgreSQL
atômicas. O transporte tem timeout, retry limitado apenas em operações
idempotentes, resposta limitada em memória e nunca inclui credenciais nas
exceções.

SQLite exige uma única réplica com volume persistente e deve ser usado somente
em desenvolvimento ou em um contêiner stateful. Em Vercel, preview, staging e
produção, o processo falha fechado quando Supabase não está completamente
configurado; não existe fallback para SQLite em `/tmp`.

## Requisitos

- Python 3.12 a 3.14;
- FastAPI/Pydantic/Uvicorn apenas para a camada HTTP. Ranking, armazenamento,
  aprendizado e testes não dependem dessas bibliotecas.

## Instalação e execução

```bash
cd services/playlists_ai_agent
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
export PLAYLISTS_AI_SERVICE_TOKEN='troque-por-um-segredo-forte'
playlists-ai-agent
```

O serviço escuta `0.0.0.0:8000`. Também pode ser iniciado diretamente:

```bash
uvicorn playlists_ai_agent.api:app --host 0.0.0.0 --port 8000
```

Sem `PLAYLISTS_AI_SERVICE_TOKEN`, todos os endpoints respondem `503`. A única
exceção precisa ser habilitada explicitamente para desenvolvimento local:

```bash
export PLAYLISTS_AI_ALLOW_INSECURE_DEV=true
```

Nunca use essa opção em produção.

### Docker

```bash
docker build -t playlists-ai-agent services/playlists_ai_agent
docker run --rm -p 8000:8000 \
  -e PLAYLISTS_AI_SERVICE_TOKEN='troque-por-um-segredo-forte' \
  -v playlists-ai-data:/data \
  playlists-ai-agent
```

## Configuração

| Variável                                 | Padrão                         | Uso                              |
| ---------------------------------------- | ------------------------------ | -------------------------------- |
| `PLAYLISTS_AI_SERVICE_TOKEN`             | ausente                        | segredo obrigatório de serviço   |
| `PLAYLISTS_AI_ENV`                       | ausente                        | `production` exige Supabase      |
| `PLAYLISTS_AI_STORE`                     | automático                     | `sqlite` ou `supabase`           |
| `PLAYLISTS_AI_DB_PATH`                   | `./data/playlists-ai-agent.db` | arquivo SQLite                   |
| `NEXT_PUBLIC_SUPABASE_URL`               | ausente                        | origem HTTPS do projeto Supabase |
| `SUPABASE_SECRET_KEY`                    | ausente                        | chave server-only recomendada    |
| `SUPABASE_SERVICE_ROLE_KEY`              | ausente                        | chave server-only legacy         |
| `PLAYLISTS_AI_SUPABASE_TIMEOUT_SECONDS`  | `8`                            | timeout por chamada, 1 a 30 s    |
| `PLAYLISTS_AI_SUPABASE_MAX_ATTEMPTS`     | `3`                            | tentativas idempotentes, 1 a 4   |
| `PLAYLISTS_AI_SUPABASE_PAGE_SIZE`        | `500`                          | página de treino, 50 a 1000      |
| `PLAYLISTS_AI_ENABLE_DOCS`               | ativo fora de produção         | Swagger/OpenAPI de dev           |
| `PLAYLISTS_AI_EDITORIAL_SEED`            | seed distribuído               | corpus editorial opcional        |
| `PLAYLISTS_AI_LEARNED_WEIGHT`            | `0.65`                         | peso do modelo após promoção     |
| `PLAYLISTS_AI_EXPLORATION_EPSILON`       | `0.05`                         | exploração limitada, máximo 0,20 |
| `PLAYLISTS_AI_MIN_TRAINING_EXAMPLES`     | `20`                           | mínimo total para treino         |
| `PLAYLISTS_AI_MIN_EXAMPLES_PER_CLASS`    | `5`                            | positivos e negativos mínimos    |
| `PLAYLISTS_AI_MAX_TRAINING_EVENTS`       | `50000`                        | janela máxima por workspace      |
| `PLAYLISTS_AI_MAX_WORKSPACES_PER_RUN`    | `100`                          | limite da manutenção global      |
| `PLAYLISTS_AI_MAX_ACTOR_EVENTS_PER_HOUR` | `200`                          | rate limit de feedback           |

### Supabase e Vercel

O entrypoint ASGI para uma raiz de serviço Vercel é `app.py`; o `pyproject.toml`
também declara `app:app`. Em produção configure:

```text
PLAYLISTS_AI_ENV=production
PLAYLISTS_AI_STORE=supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=<sb_secret_server-only>
```

`VERCEL=1` ou `VERCEL_ENV=production|preview` também torna Supabase obrigatório.
Configurar apenas URL ou apenas chave é erro de inicialização. A chave moderna
`SUPABASE_SECRET_KEY` tem preferência; `SUPABASE_SERVICE_ROLE_KEY` permanece
aceita para projetos legacy. Nenhuma delas deve usar prefixo `NEXT_PUBLIC_`.

O adapter espera as tabelas server-only:

- `playlist_ai_recommendation_requests`;
- `playlist_ai_recommendation_items`;
- `playlist_ai_feedback_events`;
- `playlist_ai_model_registry`;
- `playlist_ai_maintenance_runs`.

Operações atômicas são fornecidas pelas RPCs
`playlist_ai_ensure_baseline`, `playlist_ai_save_impression`,
`playlist_ai_record_feedback`, `playlist_ai_promote_model` e
`playlist_ai_start_maintenance`. As leituras agregadas usam
`playlist_ai_feedback_rows`, com paginação keyset, e
`playlist_ai_list_workspaces`. Se o schema ou uma RPC não estiver implantada, o
adapter retorna falha; ele não divide a operação em escritas parciais.

Swagger (`/docs`) e OpenAPI (`/openapi.json`) ficam indisponíveis quando
`VERCEL_ENV=production` ou `PLAYLISTS_AI_ENV=production`, mesmo que
`PLAYLISTS_AI_ENABLE_DOCS=true`.

## Autenticação

Quando configurado, envie em todas as rotas:

```text
X-Playlists-AI-Token: <PLAYLISTS_AI_SERVICE_TOKEN>
```

O token identifica o serviço Next.js. `actor_id` e `actor_role` do feedback
devem ser derivados no servidor autenticado, nunca aceitos diretamente do
browser.

## `POST /v1/rank`

O contrato aceita tanto os nomes enxutos (`opportunity`, `fit`, `heat`) quanto
os aliases usados pelo cliente atual (`opportunity_score`,
`baseline_fit_score`, `heat_score`, `saturation_risk`). Campos adicionais são
ignorados de forma tolerante.

```json
{
  "workspace_id": "workspace-uuid",
  "playlist_id": "spotify-playlist-id",
  "playlist_name": "Trap Agora",
  "genre": "trap",
  "market": "BR",
  "as_of": "2026-07-21T12:00:00Z",
  "limit": 10,
  "candidates": [
    {
      "track_id": "spotify-track-id",
      "name": "Faixa",
      "artists": "Artista feat. Outro",
      "genre": "trap",
      "market": "BR",
      "opportunity_score": 82,
      "baseline_fit_score": 91,
      "baseline_score": 84.88,
      "heat_score": 80,
      "momentum_score": 76,
      "freshness_score": 70,
      "stability_score": 64,
      "saturation_risk": 22,
      "current_position": 34,
      "movement_7d": 18,
      "observed_days_30": 12,
      "is_new_entry": false
    }
  ]
}
```

Resposta:

```json
{
  "request_id": "uuid-da-impressao",
  "model_version": "baseline-v1",
  "personalized": false,
  "cold_start": true,
  "items": [
    {
      "track_id": "spotify-track-id",
      "rank": 1,
      "score": 84.88,
      "base_score": 84.88,
      "learned_score": null,
      "reason_codes": ["playlist_fit_high", "opportunity_high"],
      "propensity": 1.0
    }
  ]
}
```

Somente os itens devolvidos são gravados como impressões. Features, score,
posição, versão e propensity ficam congelados e não podem ser atualizados.

## `POST /v1/feedback`

```json
{
  "workspace_id": "workspace-uuid",
  "request_id": "uuid-da-impressao",
  "track_id": "spotify-track-id",
  "action": "add",
  "event_id": "id-idempotente-do-next",
  "occurred_at": "2026-07-21T12:01:00Z",
  "target_playlist_id": "spotify-playlist-id",
  "actor_id": "user-uuid",
  "actor_role": "curador"
}
```

Ações reconhecidas incluem `save`, `pin`, `add`, `ignore`, outcomes
`kept_7d`/`kept_30d` e seus equivalentes negativos. `event_id` repetido com a
mesma identidade retorna `created: false`; reutilizá-lo para outro evento gera
conflito.

`actor_id` e `actor_role` são obrigatórios. Jobs de outcomes devem usar uma
identidade reservada e auditável, por exemplo `actor_id="service:retention-job"`
e `actor_role="system"`.

Uma adição cujo `target_playlist_id` é diferente da playlist da impressão é
preservada na auditoria, mas não treina o fit da playlist originalmente
recomendada.
`occurred_at` é validado e preservado para auditoria; o split temporal usa
sempre `created_at` gerado pelo servidor.

## `POST /v1/maintenance/run`

Um corpo vazio processa uma quantidade limitada de workspaces recentes:

```json
{}
```

Para um workspace ou simulação:

```json
{
  "workspace_id": "workspace-uuid",
  "dry_run": true
}
```

Cada execução gera uma linha em `maintenance_runs`, inclusive quando não há
dados suficientes. O treino:

1. agrega o evento treinável mais recente de cada impressão;
2. preserva grupos por `request_id` no mesmo fold;
3. usa o período mais recente como holdout;
4. calibra o baseline antes de calcular Brier/log-loss;
5. exige positivos e negativos no holdout;
6. compara o challenger com baseline e champion;
7. exige dados posteriores à janela do champion para nova promoção.

Sem aprovação de todos os guardrails, o modelo é rejeitado e o champion não é
alterado.

Nesta versão, o modelo aprende pesos no nível do workspace e usa o
`playlist_fit` recebido para manter o contexto de cada playlist. Modelos
independentes por playlist exigem volume mínimo próprio e são uma evolução
posterior. O serviço aceita outcomes atrasados como `kept_7d` e `kept_30d`, mas
o emissor que compara snapshots e produz esses eventos ainda não está incluído.

## Testes

Os testes do núcleo rodam em Python 3.12 sem instalar FastAPI:

```bash
PYTHONPATH=src python3 -m unittest discover -s tests -v
```

Eles cobrem contratos e normalização, paridade do baseline, seed temporal,
aliases editoriais, diversidade, imutabilidade, idempotência, isolamento por
workspace, timestamp confiável, destino real de adds, validação temporal,
promoção, prevenção de retreino sem dados novos e o adapter Supabase com
transporte HTTP inteiramente mockado.

Para executar também os testes do transporte FastAPI:

```bash
pip install -e '.[test]'
PYTHONPATH=src python3 -m unittest discover -s tests -v
```
