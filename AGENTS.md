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

---

## 11. Critérios de Conclusão por Slice

Cada slice deve:

- Ter testes cobrindo o comportamento principal
- Ter código mínimo necessário
- Não introduzir complexidade desnecessária
- Ser executável/testável isoladamente

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

Slice 12 concluido em 2026-03-29.

Proximo passo recomendado:

-> Implementar a pr�xima intent real no agent via `POST /commands` (recomendado: notify), mantendo slices pequenos com TDD ponta a ponta

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
