# AGENTS.md

## 1. Objetivo do Projeto

Luna Ã© uma assistente virtual self-hosted voltada para homelabs, com foco em orquestrar dispositivos e serviÃ§os locais atravÃ©s de comandos em linguagem natural.

O objetivo do MVP Ã© validar o fluxo principal:

1. Receber um comando em texto
2. Interpretar a intenÃ§Ã£o
3. Identificar o dispositivo alvo
4. Enviar o comando para um agent
5. Executar a aÃ§Ã£o no dispositivo
6. Retornar sucesso ou erro ao usuÃ¡rio

---

## 2. Escopo do MVP

### Interfaces

- Chat web simples

### Componentes

- Luna Server (backend central)
- Luna Web (interface)
- Luna Agent (rodando nos dispositivos)
- Packages compartilhados

### Comandos suportados (inicial)

- open_app
- notify
- set_volume
- play_media

### Capacidades iniciais do sistema

- Registro de dispositivos (agents)
- ComunicaÃ§Ã£o server â†” agent
- Parser simples baseado em regras
- ExecuÃ§Ã£o de comandos bÃ¡sicos
- Feedback de sucesso/erro
- HistÃ³rico bÃ¡sico de comandos

---

## 3. Fora do Escopo (MVP)

- Voz (STT/TTS)
- Descoberta automÃ¡tica de dispositivos na rede
- IntegraÃ§Ãµes complexas (Home Assistant, MQTT, etc.)
- MultiusuÃ¡rio
- AutenticaÃ§Ã£o avanÃ§ada
- Controle de permissÃµes
- Alta disponibilidade
- ExecuÃ§Ã£o distribuÃ­da complexa

---

## 4. Arquitetura Inicial

Monorepo com estrutura:

```
luna/
  apps/
    server/
    web/
    agent/
  packages/
    shared-types/
    protocol/
    command-parser/
```

### Responsabilidades

#### server

- API REST
- WebSocket gateway
- Registro de devices
- OrquestraÃ§Ã£o de comandos

#### web

- UI de chat
- Listagem de devices
- VisualizaÃ§Ã£o de histÃ³rico

#### agent

- ConexÃ£o com server
- ExecuÃ§Ã£o de comandos locais
- Reporte de status

#### shared-types

- Tipos compartilhados

#### protocol

- Contratos de mensagens (WS)

#### command-parser

- Regras de parsing de linguagem natural

---

## 5. Stack Inicial

### Backend

- Node.js
- TypeScript
- NestJS
- WebSocket
- REST
- Prisma (posterior)
- PostgreSQL (posterior)

### Frontend

- Next.js
- TypeScript
- React
- TanStack Query

### Agent

- Node.js
- TypeScript

### Testes

- Vitest (preferencial)
  ou
- Jest (aceitÃ¡vel)

CritÃ©rios:

- rÃ¡pido
- simples
- suporte a monorepo

---

## 6. ConvenÃ§Ãµes de CÃ³digo

- TypeScript estrito
- FunÃ§Ãµes pequenas e puras sempre que possÃ­vel
- Evitar classes desnecessÃ¡rias no inÃ­cio
- Preferir composiÃ§Ã£o sobre abstraÃ§Ã£o prematura
- Nomear baseado em intenÃ§Ã£o, nÃ£o implementaÃ§Ã£o

---

## 7. EstratÃ©gia de Testes

### Tipos de teste usados

- UnitÃ¡rios (principal)
- IntegraÃ§Ã£o leve (quando necessÃ¡rio)

### Regras

- Todo comportamento novo deve ter teste
- Testes devem ser legÃ­veis e descritivos
- Evitar mocks excessivos no inÃ­cio
- Priorizar testes de comportamento

---

## 8. Regra ObrigatÃ³ria de TDD

Para qualquer implementaÃ§Ã£o:

1. Escrever os testes primeiro
2. Confirmar que falham
3. Implementar o mÃ­nimo necessÃ¡rio
4. Fazer os testes passarem
5. Refatorar com seguranÃ§a

Nunca implementar antes do teste.

---

## 9. EstratÃ©gia de Feature Slices

A aplicaÃ§Ã£o deve evoluir em slices verticais pequenos.

Cada slice deve:

- ser funcional
- ser testado
- entregar valor observÃ¡vel

Evitar:

- criar estruturas genÃ©ricas antecipadamente
- implementar mÃºltiplas features de uma vez
- abstraÃ§Ãµes prematuras

---

## 10. Roadmap do MVP

### Slice 0 â€” Bootstrap (Concluido)

- monorepo setup
- config TypeScript
- config testes
- estrutura de pastas
- scripts bÃ¡sicos

### Slice 1 â€” Registro de Agent (Concluido)

- agent conecta via WebSocket
- server registra device em memÃ³ria
- teste de registro

### Slice 2 â€” Listagem de Devices (Concluido)

- endpoint REST `/devices`
- web exibe lista
- testes de leitura

### Slice 3 â€” Parser de Comando (Concluido)

- parsing baseado em regras
- suporte a frases simples
- testes cobrindo parsing

### Slice 4 â€” Dispatch de Comando (Concluido)

- server envia comando ao agent
- agent responde ack
- testes de fluxo

### Slice 5 â€” Notify (Concluido)

- agent executa notificaÃ§Ã£o local
- testes de execuÃ§Ã£o

### Slice 6 â€” Open App (Concluido)

- agent abre app local
- testes de execuÃ§Ã£o

### Slice 7 — Histórico (Concluido)

- armazenar comandos em memÃ³ria
- endpoint de leitura
- testes de persistÃªncia

### Slice 8 - Fluxo MVP ponta a ponta no UI (Concluido)

- endpoint `POST /commands` no server para comando em linguagem natural
- web conectado aos endpoints reais (`/devices`, `/commands`, `POST /commands`)
- feedback de sucesso/erro no chat com testes de integração e unitários

### Slice 9 - Runtime local executavel (Concluido)

- entrypoints `main.ts` para server e agent
- scripts de runtime para subir server, agent e web
- config de ambiente centralizada em `.env.example`
- testes cobrindo runtime de server e runtime de agent

### Slice 10 - CORS para web (Concluido)

- headers CORS globais no server para requisições REST
- suporte a preflight `OPTIONS` para `POST /commands`
- testes de integração cobrindo GET e preflight

### Slice 11 - Autoload de .env no runtime (Concluido)

- runtime do server carrega `.env` automaticamente no entrypoint
- runtime do agent carrega `.env` automaticamente no entrypoint
- testes cobrindo leitura de variáveis a partir de arquivo `.env`

### Slice 12 - open_app real no agent (Concluido)

- launcher real para Windows usando `cmd /c start` com allowlist de aliases
- aliases suportados: spotify, chrome, vscode (com sinônimos mapeados)
- erro de launcher gera log estruturado no agent sem quebrar ack
- testes unitários do launcher e integração de ack em erro

### Slice 13 - notify real no agent (Concluido)

- parser suporta `Notificar "mensagem" no <device>` com `intent: notify`
- launcher real de notify no Windows via PowerShell + toast WinRT
- falhas de notify geram log estruturado no agent sem quebrar ack
- testes unitarios de parser/launcher e integracao ponta a ponta via `POST /commands`

### Slice 14 - set_volume real no agent (Concluido)

- parser suporta `Definir volume para <0-100>[% opcional] no <device>` com `intent: set_volume`
- launcher real de set_volume no Windows via PowerShell + CoreAudio (master volume do device padrao)
- falhas de set_volume geram log estruturado no agent sem quebrar ack
- testes unitarios do launcher/parser e integracao ponta a ponta via `POST /commands`

### Slice 15 - play_media real no agent (Concluido)

- parser suporta `Tocar "midia" no <device>` com `intent: play_media`
- launcher real de play_media no Windows via `cmd /c start` (URL direta ou busca YouTube para texto)
- falhas de play_media geram log estruturado no agent sem quebrar ack
- testes unitarios do launcher/parser e integracao ponta a ponta via `POST /commands`

### Slice 16 - resultado real de execucao no fluxo completo (Concluido)

- `command.ack` agora representa resultado final com `status: success | failed`
- falhas incluem `reason` obrigatorio no protocolo, no `POST /commands` e no historico
- agent envia `failed` para erro de launcher, params invalidos e intent nao suportada
- web mapeia `success`/`failed` corretamente e exibe `reason` quando houver
- testes de protocolo, integracao server/agent, submit endpoint e web atualizados e verdes

### Slice 17 - catalogo canonico de reason + UX de falha no web (Concluido)

- `reason` de falha padronizado para: `invalid_params`, `unsupported_intent`, `execution_error`
- agent envia apenas codigos canonicos no ack, mantendo detalhe tecnico no log local
- web traduz codigos canonicos para mensagens amigaveis e aplica fallback para reason desconhecido/ausente
- contratos de tipos (`protocol` e `shared-types`) tipados com uniao de reasons canonicos
- testes de integracao server/agent, `POST /commands`, protocol e web atualizados e verdes

### Slice 18 - presenca real de device + reconexao segura (Concluido)

- server marca device como `offline` quando o socket ativo fecha, mantendo o device cadastrado
- reconnect com mesmo `device.id` volta status para `online` e atualiza metadados do device
- fechamento de socket antigo apos reconexao nao derruba status do socket ativo
- `dispatchCommand` para device offline continua falhando como `not connected`
- testes de integracao de presenca (estado interno e `GET /devices`) adicionados e verdes


### Slice 19 - capacidades reais por device (Concluido)

- `agent.register` agora envia `capabilities` canônicas por device
- server persiste `capabilities` no cadastro/reconexao e expoe no `GET /devices`
- web remove baseline fixo e mapeia capacidades reais vindas do server
- validacao de protocolo rejeita capability fora da uniao canônica
- testes de protocolo, integracao server/agent/presenca e web atualizados e verdes


### Slice 20 - heartbeat leve de presenca (Concluido)

- protocolo WS ganhou `agent.heartbeat` com parse/create/validacao dedicados
- agent envia heartbeat periodico apos `agent.register` (default 5s) e limpa timer no disconnect
- server controla timeout por socket ativo (default 15s), renova por register/heartbeat e, ao expirar, marca `offline` e encerra socket
- heartbeat de socket stale apos reconexao e ignorado
- testes unitarios de protocol + integracao de presenca por heartbeat adicionados e verdes


### Slice 21 - parser ampliado (Concluido)

- parser agora aceita variacoes fixas de verbos/preposicoes para intents existentes (`open_app`, `notify`, `set_volume`, `play_media`)
- `notify` e `play_media` suportam entrada com e sem aspas
- separacao de device em `notify`/`play_media` sem aspas usa o ultimo `no|na|em`
- regressao dos formatos anteriores mantida com testes unitarios e integracao via `POST /commands`

### Slice 22 - autocomplete de device no web (Concluido)

- `CommandComposer` recebe devices reais da pagina e nao usa mais lista fixa para sugestao de alvo
- ao digitar contexto com `no|na|em`, web sugere apenas devices `online`
- sugestoes suportam click, Enter, Tab e Escape com substituicao do fragmento de device no final da frase
- helpers puros de sugestao/filtro/ordenacao cobertos por testes unitarios

### Slice 23 - hostname automatico + apelido opcional por device (Concluido)

- agent passa a usar os.hostname() como default real para id/hostname e name fallback
- server ganhou PATCH /devices/:id para rename de apelido com validacao (trim + collapse spaces, obrigatorio, unico case-insensitive)
- em reconexao com mesmo id, server preserva apelido customizado e atualiza hostname/capabilities/status
- resolucao de target no POST /commands agora tenta name (apelido) primeiro e faz fallback para hostname
- web ganhou edicao inline de apelido no card de device e chamada real de rename via luna-api, com refresh apos salvar
- testes de agent/server/web adicionados e regressao completa verde

### Slice 24 - descoberta de agents na rede (descobrir + aprovar) (Concluido)

- server recebe anuncios UDP `agent.discovery.announce` e mantem lista em memoria de agents descobertos
- novos endpoints: `GET /discovery/agents` e `POST /discovery/agents/:id/approve`
- aprovacao cria device offline usando `hostname` como nome inicial (alias depois pode ser editado no web)
- agent passa a anunciar disponibilidade via UDP periodico para host/porta do server
- web ganhou painel de discovery com lista pendente e botao de aprovacao
- testes de protocol, agent announcer, integracao server e API web adicionados; regressao completa verde

### Slice 25 - validacao de capability antes do dispatch (Concluido)

- server valida o intent contra as capabilities do device antes de enviar command.dispatch
- quando o device nao suporta o intent, server retorna falha rapida com status failed e reason unsupported_intent
- falha rapida nao envia mensagem para o agent e fica registrada no historico em memoria
- testes de integracao em POST /commands cobrem falha rapida, ausencia de dispatch no agent e regressao do fluxo suportado

### Slice 26 - refactor inicial de modularizacao do server (Concluido)

- apps/server/src/index.ts foi simplificado com extracao de utilitarios puros para arquivos dedicados
- novos modulos: value-utils, http-utils, device-utils e route-utils
- fluxo e contratos foram mantidos sem alteracao de comportamento
- regressao validada com todos os testes de integracao do server verdes

### Slice 27 - modularizacao dos handlers HTTP do server (Concluido)

- handlers de submit, rename e approve foram extraidos de apps/server/src/index.ts
- novo modulo apps/server/src/http-request-handlers.ts centraliza regras HTTP dessas rotas
- index.ts passou a delegar para handlers dedicados, mantendo contratos e respostas
- regressao validada com testes de integracao do server verdes

### Slice 28 - modularizacao do fluxo WebSocket do server (Concluido)

- fluxo de conexao e mensagens WebSocket (register, heartbeat e command ack) foi extraido de apps/server/src/index.ts
- novo modulo apps/server/src/websocket-connection-handlers.ts centraliza regras de presenca e processamento de ack
- start() no index.ts ficou mais enxuto, apenas fazendo o wiring do servidor e delegando handlers
- regressao validada com testes de integracao do server verdes

### Slice 29 - modularizacao do dispatch e pending acks (Concluido)

- dispatchCommand foi extraido de apps/server/src/index.ts para apps/server/src/command-dispatcher.ts
- ciclo de pending acks (create, timeout, cleanup e settle por ack) foi centralizado no novo modulo
- handler WebSocket passou a delegar o settle de ack para o dispatcher, reduzindo duplicacao de responsabilidade
- regressao validada com testes de integracao do server verdes

### Slice 30 - modularizacao do fluxo de discovery UDP (Concluido)

- fluxo de discovery UDP foi extraido de apps/server/src/index.ts para apps/server/src/agent-discovery-udp.ts
- start/stop do socket UDP passaram para funcoes dedicadas, mantendo bind, parse e atualizacao da lista descoberta
- index.ts passou a apenas orquestrar o lifecycle, reduzindo responsabilidade de rede no start/stop
- regressao validada com testes de integracao do server verdes

### Slice 31 - modularizacao do lifecycle de runtime do server (Concluido)

- start/stop de runtime (http, ws e udp) foi extraido de apps/server/src/index.ts para apps/server/src/server-runtime.ts
- index.ts passou a delegar bootstrap/teardown de infraestrutura para funcoes dedicadas de runtime
- ordem de inicializacao e encerramento foi preservada, mantendo contratos atuais
- regressao validada com testes de integracao do server verdes

### Slice 32 - modularizacao da presenca e heartbeat timeout (Concluido)

- logica de presenca foi extraida para a classe PresenceService em apps/server/src/presence-service.ts
- classe recebe dependencias por construtor (devices, deviceSockets e heartbeatTimeoutMs)
- handler WebSocket passou a depender do servico de presenca em vez de funcoes soltas
- limpeza dos timers de heartbeat no stop passou a usar metodo dedicado do servico
- regressao validada com testes de integracao do server verdes

### Slice 33 - camada de aplicacao com use cases + DI manual (Concluido)

- casos de uso de submit, rename e approve foram extraidos para classes dedicadas em apps/server/src/application
- createHttpRequestHandlers passou a atuar como adapter HTTP, delegando regras de negocio aos use cases
- dependencias foram injetadas manualmente por construtor (maps e dispatch), sem framework de DI
- cobertura inicial adicionada com testes unitarios dos 3 use cases e regressao completa do server verde

### Slice 34 - portas da camada de aplicacao (Concluido)

- contratos de portas foram extraidos para apps/server/src/application/ports.ts
- use cases de submit, rename e approve passaram a depender de portas injetadas em vez de Map/funcoes concretas
- http-request-handlers passou a montar adapters in-memory para lookup de device, escrita de device, discovery e dispatch
- contratos HTTP, mensagens e codigos de status foram preservados sem alteracao de comportamento
- regressao validada com testes unitarios dos use cases e suite completa do server verde

### Slice 35 - artefatos separados de build (server vs agent) (Concluido)

- criado builder de artefatos com targets explicitos server e agent
- artifact de server inclui apenas dist/apps/server + dist/packages/{shared-types,protocol,command-parser}
- artifact de agent inclui apenas dist/apps/agent + dist/packages/{shared-types,protocol}
- scripts adicionados: build:artifact:server, build:artifact:agent e build:artifacts
- testes unitarios adicionados para garantir separacao entre os artefatos e evitar mistura de arquivos de app

### Slice 36 - distribuicao do server via Docker com web embutido (Concluido)

- server passou a servir web exportado de forma opcional via LUNA_SERVER_STATIC_DIR, mantendo prioridade total das rotas REST e WebSocket
- web passou a usar mesma origem por padrao quando NEXT_PUBLIC_LUNA_SERVER_URL nao estiver configurado
- artifact de server agora inclui web exportado e node_modules/@luna/* compilado para runtime empacotado
- novo build embutido do web limpa NEXT_PUBLIC_LUNA_SERVER_URL para evitar hardcode de host local na distribuicao
- adicionado apps/server/Dockerfile multi-stage para imagem unica com server + web
- scripts adicionados: build:web:embedded, docker:build:server e docker:run:server
- smoke test Docker cobre subida do container, GET /devices, GET / e leitura de variavel de porta; quando Docker nao estiver disponivel, o teste faz skip explicito

### Slice 37 - persistencia local do estado do server (Concluido)

- runtime do server ganhou `LUNA_SERVER_STATE_FILE` opcional, com default em `./data/server-state.json`
- novo store local versionado em JSON persiste `devices`, aliases explicitos e historico de comandos
- startup do server hidrata o snapshot persistido e normaliza devices carregados para `offline`
- mutacoes relevantes agora salvam estado apos register/reconnect, offline por close ou heartbeat timeout, rename, approve e append no historico
- arquivo ausente inicia estado vazio; JSON invalido ou schema invalido falham o startup com erro explicito
- escrita do snapshot e atomica via arquivo temporario + rename, criando o diretorio pai quando necessario
- testes unitarios do store, integracao de restart e runtime com arquivo corrompido adicionados e verdes

### Slice 38 - pacote executavel do agent (Concluido)

- artifact do agent agora inclui runtime Node embutido, dependencias externas `dotenv` e `ws`, `.env.example` proprio e launcher nativo da plataforma do build
- launcher do pacote executa a partir da raiz do artifact e, no primeiro run sem `.env`, gera o arquivo a partir do template, orienta ajuste de `LUNA_AGENT_SERVER_URL` e encerra com codigo 1
- segundo run do launcher usa o runtime embutido para iniciar `dist/apps/agent/src/main.js` sem depender de Node pre-instalado na maquina alvo
- builder ganhou overrides opcionais de `runtimeExecutablePath` e `targetPlatform` para cobertura unitaria do empacotamento
- smoke test do pacote isolado fora do monorepo valida bootstrap de `.env` e conexao real do agent ao server
- documentacao operacional atualizada com fluxo de build e primeiro uso do pacote do agent

### Slice 39 - dispatcher de intents do agent via strategy registry (Concluido)

- execucao de intents no agent foi extraida de `apps/agent/src/index.ts` para o novo modulo `apps/agent/src/intent-dispatcher.ts`
- novo dispatcher aplica strategy registry tipado para `notify`, `open_app`, `set_volume` e `play_media`, preservando `ack` canonico (`success|failed` com `invalid_params|unsupported_intent|execution_error`)
- fluxo de `connectAgent` foi mantido, incluindo ordem de processamento (executa intent, chama `onCommand`, envia `command.ack` no `finally`)
- erro de callback em `onCommand` continua sem quebrar envio de `ack`, coberto por novo teste de integracao em `command-dispatch.integration.test.ts`
- testes unitarios do dispatcher adicionados em `apps/agent/test/intent-dispatcher.unit.test.ts` e regressao minima de dispatch/execucao validada verde

### Slice 40 - parser em pipeline de regras (chain, multi-arquivos) (Concluido)

- parser foi refatorado para chain de regras ordenadas com extracao para modulos dedicados em `packages/command-parser/src/rules/`
- tipos e constantes publicas foram movidos para `parser-types.ts`, com `index.ts` mantendo os mesmos exports publicos
- utilitarios e padroes de parsing foram centralizados em `parser-utils.ts`, incluindo split por ultimo separador de device
- novo orquestrador `parser-pipeline.ts` aplica regras na mesma ordem anterior e preserva semantica de early-return para match invalido
- testes de caracterizacao de precedencia (quoted sobre unquoted e fallback open_app) adicionados em `parser-pipeline.unit.test.ts`
- regressao validada com `command-parser.unit.test.ts` e `command-submit.integration.test.ts` verdes

### Slice 41 - padronizacao de Result na camada de aplicacao do server (Concluido)

- criado contrato generico `UseCaseResult<Success, ErrorCode>` com helpers `ok(data)` e `err(code)` em `apps/server/src/application/result.ts`
- use cases de submit, rename e approve passaram a retornar codigos de erro de dominio (`error.code`) em vez de `statusCode/message`
- `http-request-handlers.ts` passou a mapear `error.code` para HTTP por caso de uso, preservando os mesmos status codes e mensagens externas
- payload de sucesso dos use cases foi padronizado para `kind: ok` com `data`, sem alterar contrato das rotas
- regressao validada com unitarios dos 3 use cases e integracoes de submit, rename e discovery/approve verdes

### Slice 42 - presenca com transicoes explicitas via state machine leve (Concluido)

- criada funcao pura de transicao em `apps/server/src/presence-state-machine.ts` cobrindo eventos `register`, `socket_close`, `heartbeat` e `heartbeat_timeout`
- `PresenceService` passou a aplicar a state machine para transicoes online/offline e para ignorar eventos stale de forma explicita
- fluxo de register/heartbeat/close no handler WebSocket foi ajustado para delegar decisoes de presenca ao `PresenceService`
- semantica de reconnect, stale socket e timeout foi preservada, sem mudanca de contratos HTTP/WS
- testes unitarios da state machine adicionados em `apps/server/test/presence-state-machine.unit.test.ts`
- regressao de presenca validada com `device-presence.integration.test.ts` e `heartbeat-presence.integration.test.ts` verdes

### Slice 43 - repositorios in-memory (ports & adapters completo) (Concluido)

- acesso direto a colecoes foi encapsulado em portas de infraestrutura em `apps/server/src/repositories/ports.ts`
- adapters concretos in-memory foram implementados em `apps/server/src/repositories/in-memory.ts` para devices, discovery, aliases, historico, conexoes e pending acks
- wiring do server em `apps/server/src/index.ts` passou a injetar repositorios no lugar de `Map`/array, incluindo leitura e persistencia de snapshot via metodos de repositorio
- consumidores (`http-request-handlers`, `command-dispatcher`, `presence-service`, `websocket-connection-handlers`, `agent-discovery-udp` e `server-runtime`) foram refatorados para depender de portas de repositorio
- testes unitarios dos repositorios adicionados em `apps/server/test/in-memory-repositories.unit.test.ts`
- regressao minima validada com `device-list.integration.test.ts`, `command-history.integration.test.ts`, `agent-discovery.integration.test.ts`, `command-dispatch.integration.test.ts`, `device-presence.integration.test.ts` e `heartbeat-presence.integration.test.ts` verdes

### Slice 44 - HTTP handlers com pipeline de request (Concluido)

- parse e validacao de body JSON para `POST /commands` e `PATCH /devices/:id` foram centralizados em um pipeline unico interno em `apps/server/src/http-request-handlers.ts`
- validadores dedicados (`validateSubmitBody` e `validateRenameBody`) passaram a encapsular regras de campos obrigatorios sem duplicar `try/catch` por handler
- mensagens e status de erro foram preservados (`Invalid JSON body.`, `rawText is required.`, `name is required.`), mantendo contratos HTTP externos
- `handleApproveDiscoveredAgent` permaneceu sem leitura de body e sem alteracoes comportamentais
- testes de integracao adicionados para JSON invalido e campo obrigatorio ausente em submit e rename
- regressao validada com `command-submit.integration.test.ts`, `device-rename.integration.test.ts` e `agent-discovery.integration.test.ts` verdes

### Slice 45 - schemas zod no pipeline de request com contrato de erro retrocompativel (Concluido)

- pipeline de parsing/validacao em `apps/server/src/http-request-handlers.ts` passou a usar schemas `zod` para `POST /commands` e `PATCH /devices/:id`
- schemas `submitCommandBodySchema` e `renameDeviceBodySchema` substituem validacao manual e mantem regra de string nao vazia sem alterar payload de entrada
- mapeamento de erro foi mantido retrocompativel: JSON invalido retorna `Invalid JSON body.`, body invalido continua retornando `rawText is required.` ou `name is required.`
- testes de integracao foram ampliados para tipos invalidos de campos obrigatorios em submit e rename, preservando o contrato HTTP existente
- regressao validada com `command-submit.integration.test.ts`, `device-rename.integration.test.ts` e `agent-discovery.integration.test.ts` verdes

### Slice 46 - runtime Docker do server com dependencias completas e imports ESM corrigidos (Concluido)

- Dockerfile do server passou a copiar `node_modules/zod` para a imagem final, junto de `dotenv` e `ws`, evitando `ERR_MODULE_NOT_FOUND` no boot
- builder de artifacts passou a copiar `@luna/*` para `node_modules` a partir do `dist` ja reescrito (com `.js` nos imports relativos), eliminando falha de runtime em `@luna/command-parser`
- novo teste unitario `apps/server/test/docker-runtime-dependencies.unit.test.ts` garante presenca explicita de `dotenv`, `ws` e `zod` no runtime Docker
- `apps/server/test/build-artifacts.unit.test.ts` ganhou cobertura para garantir rewrite de imports relativos tambem nos pacotes workspace copiados para `node_modules`
- validacao real em container confirmou boot do server e resposta de `GET /devices` com sucesso

### Slice 47 - configuracao de conexao do agent via CLI (Concluido)

- runtime do agent ganhou parser de argumentos CLI: `--server-url`, `--server-host`, `--server-port`, `--device-id`, `--device-name`, `--device-hostname`
- resolucao de configuracao agora aplica precedencia `CLI > .env > defaults`, permitindo definir a porta do Luna Server no momento de subir o agent
- launchers do artifact (`run-agent.cmd` e `run-agent.sh`) passaram a encaminhar argumentos para o runtime (`%*` e `"$@"`)
- launchers nao encerram mais no primeiro bootstrap de `.env`; quando ausente, criam o arquivo e seguem com defaults/CLI
- testes de runtime do agent cobrem parse de CLI e conexao usando apenas argumentos de linha de comando
- smoke test do pacote do agent valida conexao com runtime embutido usando argumentos CLI

### Slice 48 - runtime portavel de Linux no artifact do agent (Concluido)

- build do artifact do agent ganhou estrategia de runtime portavel para Linux baseada no Node oficial (`nodejs.org/dist`) em vez de reutilizar o `process.execPath` do builder
- novo cache local `.portable-runtime-cache/` evita downloads repetidos do runtime em builds seguintes
- URL do runtime Linux foi padronizada por helper dedicado com validacao explicita de arquitetura suportada (`x64` e `arm64`)
- builder agora aceita resolver customizavel de runtime (`resolveAgentRuntimeExecutablePath`) para testes deterministicos sem rede
- cobertura de testes ampliada em `build-artifacts.unit.test.ts` para URL de runtime portavel e para uso do resolver customizado
- smoke test do artifact do agent foi ajustado para isolamento de artefato em pasta temporaria e validacao do runtime empacotado via CLI

### Slice 49 - pacote npm CLI do agent (Concluido)

- novo builder dedicado de pacote npm CLI em `apps/agent/src/build-npm-package.ts`, gerando estrutura publicavel em `dist-packages/agent-cli`
- pacote gerado publica o binario `luna-agent` como arquivo unico bundle CommonJS com shebang (`#!/usr/bin/env node`)
- novo entrypoint de build `apps/agent/src/build-npm-package.main.ts` para execucao via script de monorepo
- scripts adicionados no root: `build:package:agent-cli` (gera pacote) e `pack:package:agent-cli` (gera tarball `.tgz`)
- testes unitarios adicionados em `apps/agent/test/build-npm-package.unit.test.ts` cobrindo metadata custom/default e estrutura de saida
- documentacao atualizada em `README.md` e `RUN_LOCAL.md` com fluxo de build e empacotamento npm do agent

### Slice 50 - docs de distribuicao do agent via pacote npm publicado (Concluido)

- README.md passou a orientar usuarios finais a executar o agent via pacote publicado @vitorqf/luna-agent em vez de build local
- RUN_LOCAL.md substituiu o fluxo de build/pack local do pacote por instalacao/execucao via npm (npm exec ou npm install -g)
- comandos de build de artefato permanecem documentados apenas para contexto de desenvolvimento/manutencao do monorepo
- validacao manual dos comandos documentados foi realizada durante o ajuste de documentacao

### Slice 51 - readme no pacote npm publicado do agent (Concluido)

- builder do pacote npm do agent passou a gerar README.md automaticamente dentro de dist-packages/agent-cli
- package.json gerado passou a incluir README.md na lista files para empacotamento explicito
- README do pacote documenta execucao via npm exec e as flags CLI suportadas
- testes unitarios do builder foram ampliados para validar existencia/conteudo do README e metadata atualizada de files
- validacao via npm pack confirmou README.md presente no tarball publicado

### Slice 52 - reconexao automatica resiliente do agent (Concluido)

- runtime do agent ganhou supervisor de conexao com retry automatico quando o server esta indisponivel no boot e quando a conexao cai apos estar online
- politica de retry implementada com backoff exponencial sem jitter (fator 2) e teto configuravel, com reset para o delay inicial apos reconexao bem-sucedida
- novas env vars publicas no runtime do agent: LUNA_AGENT_RECONNECT_INITIAL_DELAY_MS (default 1000) e LUNA_AGENT_RECONNECT_MAX_DELAY_MS (default 30000)
- validacao de configuracao adicionada para garantir delays inteiros positivos e max >= initial, com erro explicito em caso invalido
- connectAgent passou a aceitar callback opcional onDisconnect para o supervisor decidir a reconexao sem alterar o contrato de mensagens do protocolo
- testes de integracao do runtime cobrem boot sem server com recuperacao posterior, reconexao apos restart do server e parada do loop de retry apos disconnect programatico
- runtime de stop do server passou a terminar clientes WebSocket ativos antes do close para permitir restart deterministico durante os testes de reconexao
- documentacao atualizada em .env.example, README.md e RUN_LOCAL.md

### Slice 53 - catalogo compartilhado canonico de contratos (Concluido)

- `@luna/shared-types` passou a exportar catalogos runtime canonicos para device status, capabilities, command status, failure reasons e intents
- novos helpers puros adicionados em `shared-types`: `isDeviceStatus`, `isDeviceCapability`, `isCommandStatus`, `isCommandFailureReason` e `isCommandIntent`
- `packages/command-parser` passou a reexportar os intent constants a partir de `@luna/shared-types`, preservando o contrato publico do parser
- testes adicionados/atualizados em `shared-types`, `command-parser` e `protocol`; regressao dos packages validada verde
### Slice 54 - alinhamento de contratos no web/protocol/server/agent (Concluido)

- `protocol` passou a consumir status, reasons e guards canonicos a partir de `@luna/shared-types`, removendo validacoes locais duplicadas
- `agent` passou a reutilizar o catalogo compartilhado de capabilities e intents, preservando o mesmo comportamento de ack para intents suportadas e nao suportadas
- `server` alinhou validacao do state store e o tipo de acknowledgement do dispatcher aos contratos canonicos compartilhados
- `web` passou a usar tipos compartilhados para `Device.status`, `Device.capabilities`, discovery e submit ack, mantendo estados de UI (`pending` e `error`) locais
- capacidades e exemplos fora do escopo canonico atual foram removidos do web (`screenshot`, `shutdown` e placeholder de desligar)
- testes de protocolo, agent, server e web foram atualizados; suites tocadas pelo slice estao verdes

### Slice 55 - extracao da sessao de conexao do agent (Concluido)

- logica de handshake WebSocket, register inicial, parsing de `command.dispatch`, execucao de intent e envio de `command.ack` foi extraida para o novo modulo interno `apps/agent/src/agent-session.ts`
- `connectAgent` permaneceu como orquestrador de lifecycle, mantendo ownership de heartbeat, discovery announcer e callback `onDisconnect`
- contrato publico de `connectAgent` foi preservado, sem mudancas em runtime env/CLI ou no fluxo de reconnect
- testes unitarios dedicados de sessao adicionados e regressao de runtime/dispatch validada verde

### Slice 56 - extracao do lifecycle operacional do agent (Concluido)

- heartbeat, discovery announcer e teardown local foram extraidos para o novo modulo interno `apps/agent/src/agent-operational-lifecycle.ts`
- `connectAgent` passou a apenas resolver executores/capabilities, criar a sessao e delegar o lifecycle operacional
- cleanup de heartbeat/discovery foi unificado em caminho idempotente compartilhado entre `close` e `disconnect`, preservando o callback `onDisconnect`
- testes unitarios dedicados do lifecycle adicionados e regressao de runtime/dispatch validada verde

## 11. Critérios de Conclusão por Slice

Cada slice deve:

- Ter testes cobrindo o comportamento principal
- Ter código mínimo necessário
- Não introduzir complexidade desnecessária
- Ser executável/testável isoladamente

---

## 12. Regras de Refactor

- SÃ³ refatorar com testes verdes
- Refactors devem ser pequenos
- NÃ£o mudar comportamento durante refactor
- Evitar refactors globais grandes

---

## 13. Modelagem de DomÃ­nio (Inicial)

### Device

- id
- name
- hostname
- status
- capabilities

### Capability

- open_app
- notify
- set_volume
- play_media

### Command

- id
- rawText
- intent
- targetDeviceId
- params
- status

---

## 14. PrincÃ­pios para Evitar Overengineering

- NÃ£o generalizar antes da necessidade
- NÃ£o criar abstraÃ§Ãµes sem 2+ usos reais
- Preferir soluÃ§Ãµes diretas
- Adiar decisÃµes complexas
- Usar in-memory antes de banco real

---

## 15. Regras de ImplementaÃ§Ã£o

- Um slice por vez
- Sempre comeÃ§ar pelos testes
- Validar comportamento antes de avanÃ§ar
- NÃ£o implementar features fora do roadmap
- NÃ£o adicionar voz ou IoT no MVP inicial

---

## 16. DefiniÃ§Ã£o de Sucesso do MVP

O MVP Ã© considerado vÃ¡lido quando:

- Dois devices conectam via agent
- Devices aparecem no web
- UsuÃ¡rio envia comando em linguagem natural
- Server interpreta corretamente
- Agent executa aÃ§Ã£o
- Resultado aparece no UI

Exemplo:

Input:
"Abrir Spotify no Notebook 2"

Resultado:

- Spotify abre no dispositivo correto
- UI mostra sucesso

---

## 17. Fluxo de Trabalho Esperado

Para cada etapa:

1. Identificar o slice atual
2. Definir testes necessÃ¡rios
3. Escrever testes
4. Confirmar falha
5. Implementar cÃ³digo mÃ­nimo
6. Validar testes passando
7. Refatorar (se necessÃ¡rio)
8. Registrar progresso

---

## 18. Prioridade Atual

Slice 56 concluido em 2026-04-03.

Proximo passo recomendado:

-> Slice 57 - modularizacao da configuracao do runtime do agent

### Findings de refactor atuais (2026-04-03)

1. Catalogos canonicos duplicados

- capabilities, reasons e alguns unions de status estao redefinidos em `shared-types`, `protocol`, `agent`, `server` e `web`
- isso aumenta risco de drift entre contratos, persistencia e UI
- o web ainda carrega capacidades fora do escopo canonico atual do MVP

2. `connectAgent` com responsabilidades demais

- handshake WebSocket
- register
- processamento de mensagens
- execucao de intent
- envio de ack
- heartbeat
- discovery announcer
- cleanup e disconnect

3. `apps/agent/src/main.ts` como runtime monolitico

- parsing de CLI
- leitura de env
- resolucao de precedencia
- supervisor de reconnect
- sinais de processo
- bootstrap final

4. Composicao de transporte do server ainda concentrada

- `apps/server/src/index.ts` ainda concentra route switch HTTP, hydrate de estado, start e stop
- `apps/server/src/http-request-handlers.ts` mistura wiring de adapters, parsing, validacao e error mapping

5. Builder de artifacts com acoplamento alto

- `apps/server/src/build-artifacts.ts` concentra download de runtime, extracoes, rewrite de imports, launcher scripts e empacotamento por target

6. Dashboard web com responsabilidades acumuladas

- `apps/web/app/page.tsx` concentra polling, fetch inicial, mapping de snapshot, submit de comando, rename e approve

7. Duplicacao e codigo morto no web

- hooks duplicados (`use-toast` e `use-mobile`)
- `mock-data.ts` ainda contem datasets e exemplos fora do contrato atual

8. Testes de integracao crescendo como arquivos monoliticos

- repeticao de helpers async (`sleep`, `waitForAssertion`, `setup/teardown`)
- arquivos muito grandes dificultam manutencao e leitura

### Slices de refactor propostos

### Slice 53 - catalogo compartilhado canonico de contratos (Concluido)

- mover capabilities, reasons e helpers de validacao reutilizaveis para `@luna/shared-types`
- reduzir duplicacao de unions/string literals entre packages e apps
- manter contrato externo inalterado

### Slice 54 - alinhamento de contratos no web/protocol/server/agent

- substituir arrays e unions locais pelos contratos canonicos compartilhados
- remover capacidades fora do escopo canonico atual do web
- manter UX e payloads externos sem mudanca de comportamento

### Slice 55 - extracao da sessao de conexao do agent

- separar de `connectAgent` o handshake, register, recebimento de mensagens e envio de ack
- deixar a funcao principal apenas como orquestradora de uma sessao dedicada

### Slice 56 - extracao do lifecycle operacional do agent (Concluido)

- mover heartbeat, discovery announcer e cleanup para um modulo proprio
- unificar caminho de teardown para evitar duplicacao entre `close` e `disconnect`

### Slice 57 - modularizacao da configuracao do runtime do agent

- extrair parsing de CLI, leitura de env e resolucao de configuracao de `apps/agent/src/main.ts`
- preservar precedencia `CLI > .env > defaults`

### Slice 58 - extracao do supervisor de reconnect do agent

- mover politica de retry/backoff/shutdown para um modulo dedicado
- manter entrypoint do runtime como bootstrap fino

### Slice 59 - tabela declarativa de rotas HTTP do server

- substituir o `if` chain de `handleRequest` por um registro declarativo de rotas
- manter rotas, status codes e payloads existentes

### Slice 60 - separacao dos adapters HTTP do server

- dividir `http-request-handlers.ts` em parsing de request, wiring de use cases e mapeamento de erros
- reduzir acoplamento do adapter HTTP com repositorios concretos

### Slice 61 - decomposicao do builder de artifacts

- separar resolver de runtime portavel, rewrite de JS ESM, launcher templates e empacotadores por target
- reduzir blast radius de mudancas no pipeline de build

### Slice 62 - controller/hook da dashboard web

- extrair polling, refresh, fetch inicial e estado global da dashboard para um hook dedicado
- deixar `page.tsx` focado em composicao de UI

### Slice 63 - hooks de acoes da dashboard web

- extrair submit de comando, rename de device e approve de discovery para hooks/flows dedicados
- manter comportamento atual do UI

### Slice 64 - limpeza de duplicacao e codigo morto no web

- remover duplicatas de hooks
- reduzir `mock-data.ts` para fixtures realmente usadas
- apagar exemplos e tipos nao suportados pelo MVP atual

### Slice 65 - test kit compartilhado

- criar helpers compartilhados para polling, portas temporarias e setup/teardown de server-agent
- reduzir repeticao na suite de integracao

### Slice 66 - fatiamento dos testes monoliticos

- dividir specs muito grandes por comportamento/intencao
- manter cobertura atual com arquivos menores e mais focados
## 19. ObservaÃ§Ã£o Final

Este projeto deve evoluir como um sistema incremental, testado e funcional em todas as etapas.

Evitar grandes implementaÃ§Ãµes de uma vez.

Sempre priorizar:

- clareza
- simplicidade
- feedback rÃ¡pido
- cÃ³digo testÃ¡vel

Antes de implementar qualquer cÃ³digo, leia o AGENTS.md e me diga:

1. qual Ã© o prÃ³ximo slice
2. qual Ã© o objetivo exato dele
3. quais testes serÃ£o escritos primeiro
4. qual Ã© o menor incremento funcional possÃ­vel para concluir esse slice

SÃ³ depois disso comece a implementar.

Sempre atualize o AGENTS.md quando concluir um slice

