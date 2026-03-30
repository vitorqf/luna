# AGENTS.md

## 1. Objetivo do Projeto

Luna é uma assistente virtual self-hosted voltada para homelabs, com foco em orquestrar dispositivos e serviços locais através de comandos em linguagem natural.

O objetivo do MVP é validar o fluxo principal:

1. Receber um comando em texto
2. Interpretar a intenção
3. Identificar o dispositivo alvo
4. Enviar o comando para um agent
5. Executar a ação no dispositivo
6. Retornar sucesso ou erro ao usuário

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
- Comunicação server ↔ agent
- Parser simples baseado em regras
- Execução de comandos básicos
- Feedback de sucesso/erro
- Histórico básico de comandos

---

## 3. Fora do Escopo (MVP)

- Voz (STT/TTS)
- Descoberta automática de dispositivos na rede
- Integrações complexas (Home Assistant, MQTT, etc.)
- Multiusuário
- Autenticação avançada
- Controle de permissões
- Alta disponibilidade
- Execução distribuída complexa

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
- Orquestração de comandos

#### web

- UI de chat
- Listagem de devices
- Visualização de histórico

#### agent

- Conexão com server
- Execução de comandos locais
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
- Jest (aceitável)

Critérios:

- rápido
- simples
- suporte a monorepo

---

## 6. Convenções de Código

- TypeScript estrito
- Funções pequenas e puras sempre que possível
- Evitar classes desnecessárias no início
- Preferir composição sobre abstração prematura
- Nomear baseado em intenção, não implementação

---

## 7. Estratégia de Testes

### Tipos de teste usados

- Unitários (principal)
- Integração leve (quando necessário)

### Regras

- Todo comportamento novo deve ter teste
- Testes devem ser legíveis e descritivos
- Evitar mocks excessivos no início
- Priorizar testes de comportamento

---

## 8. Regra Obrigatória de TDD

Para qualquer implementação:

1. Escrever os testes primeiro
2. Confirmar que falham
3. Implementar o mínimo necessário
4. Fazer os testes passarem
5. Refatorar com segurança

Nunca implementar antes do teste.

---

## 9. Estratégia de Feature Slices

A aplicação deve evoluir em slices verticais pequenos.

Cada slice deve:

- ser funcional
- ser testado
- entregar valor observável

Evitar:

- criar estruturas genéricas antecipadamente
- implementar múltiplas features de uma vez
- abstrações prematuras

---

## 10. Roadmap do MVP

### Slice 0 — Bootstrap (Concluido)

- monorepo setup
- config TypeScript
- config testes
- estrutura de pastas
- scripts básicos

### Slice 1 — Registro de Agent (Concluido)

- agent conecta via WebSocket
- server registra device em memória
- teste de registro

### Slice 2 — Listagem de Devices (Concluido)

- endpoint REST `/devices`
- web exibe lista
- testes de leitura

### Slice 3 — Parser de Comando (Concluido)

- parsing baseado em regras
- suporte a frases simples
- testes cobrindo parsing

### Slice 4 — Dispatch de Comando (Concluido)

- server envia comando ao agent
- agent responde ack
- testes de fluxo

### Slice 5 — Notify (Concluido)

- agent executa notificação local
- testes de execução

### Slice 6 — Open App (Concluido)

- agent abre app local
- testes de execução

### Slice 7 � Hist�rico (Concluido)

- armazenar comandos em memória
- endpoint de leitura
- testes de persistência

### Slice 8 - Fluxo MVP ponta a ponta no UI (Concluido)

- endpoint `POST /commands` no server para comando em linguagem natural
- web conectado aos endpoints reais (`/devices`, `/commands`, `POST /commands`)
- feedback de sucesso/erro no chat com testes de integra��o e unit�rios

### Slice 9 - Runtime local executavel (Concluido)

- entrypoints `main.ts` para server e agent
- scripts de runtime para subir server, agent e web
- config de ambiente centralizada em `.env.example`
- testes cobrindo runtime de server e runtime de agent

### Slice 10 - CORS para web (Concluido)

- headers CORS globais no server para requisi��es REST
- suporte a preflight `OPTIONS` para `POST /commands`
- testes de integra��o cobrindo GET e preflight

### Slice 11 - Autoload de .env no runtime (Concluido)

- runtime do server carrega `.env` automaticamente no entrypoint
- runtime do agent carrega `.env` automaticamente no entrypoint
- testes cobrindo leitura de vari�veis a partir de arquivo `.env`

### Slice 12 - open_app real no agent (Concluido)

- launcher real para Windows usando `cmd /c start` com allowlist de aliases
- aliases suportados: spotify, chrome, vscode (com sin�nimos mapeados)
- erro de launcher gera log estruturado no agent sem quebrar ack
- testes unit�rios do launcher e integra��o de ack em erro

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

- `agent.register` agora envia `capabilities` can�nicas por device
- server persiste `capabilities` no cadastro/reconexao e expoe no `GET /devices`
- web remove baseline fixo e mapeia capacidades reais vindas do server
- validacao de protocolo rejeita capability fora da uniao can�nica
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

## 11. Crit�rios de Conclus�o por Slice

Cada slice deve:

- Ter testes cobrindo o comportamento principal
- Ter c�digo m�nimo necess�rio
- N�o introduzir complexidade desnecess�ria
- Ser execut�vel/test�vel isoladamente

---

## 12. Regras de Refactor

- Só refatorar com testes verdes
- Refactors devem ser pequenos
- Não mudar comportamento durante refactor
- Evitar refactors globais grandes

---

## 13. Modelagem de Domínio (Inicial)

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

## 14. Princípios para Evitar Overengineering

- Não generalizar antes da necessidade
- Não criar abstrações sem 2+ usos reais
- Preferir soluções diretas
- Adiar decisões complexas
- Usar in-memory antes de banco real

---

## 15. Regras de Implementação

- Um slice por vez
- Sempre começar pelos testes
- Validar comportamento antes de avançar
- Não implementar features fora do roadmap
- Não adicionar voz ou IoT no MVP inicial

---

## 16. Definição de Sucesso do MVP

O MVP é considerado válido quando:

- Dois devices conectam via agent
- Devices aparecem no web
- Usuário envia comando em linguagem natural
- Server interpreta corretamente
- Agent executa ação
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
2. Definir testes necessários
3. Escrever testes
4. Confirmar falha
5. Implementar código mínimo
6. Validar testes passando
7. Refatorar (se necessário)
8. Registrar progresso

---

## 18. Prioridade Atual

Slice 34 concluido em 2026-03-30.

Proximo passo recomendado:

-> Slice 35: extrair parser/resolvedor de target para portas explicitas da aplicacao e mover o wiring de composicao para modulo dedicado, mantendo comportamento atual

## 19. Observação Final

Este projeto deve evoluir como um sistema incremental, testado e funcional em todas as etapas.

Evitar grandes implementações de uma vez.

Sempre priorizar:

- clareza
- simplicidade
- feedback rápido
- código testável

Antes de implementar qualquer código, leia o AGENTS.md e me diga:

1. qual é o próximo slice
2. qual é o objetivo exato dele
3. quais testes serão escritos primeiro
4. qual é o menor incremento funcional possível para concluir esse slice

Só depois disso comece a implementar.

Sempre atualize o AGENTS.md quando concluir um slice

