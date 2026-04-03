# Run Luna Locally

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment

Copy `.env.example` values to your shell (or your preferred `.env` loader).

Required variables for runtime:

- `LUNA_SERVER_HOST`
- `LUNA_SERVER_PORT`
- `LUNA_SERVER_STATIC_DIR` (optional)
- `LUNA_SERVER_STATE_FILE` (optional, defaults to `./data/server-state.json`)
- `LUNA_AGENT_SERVER_URL`
- `LUNA_AGENT_DEVICE_ID`
- `LUNA_AGENT_DEVICE_NAME`
- `LUNA_AGENT_DEVICE_HOSTNAME`
- `NEXT_PUBLIC_LUNA_SERVER_URL` (optional for standalone web dev)

## 3. Run the embedded Docker image

Build the image:

```bash
npm run docker:build:server
```

Run the image:

```bash
npm run docker:run:server
```

Persistence note:

- The default server state file inside the container is `/app/data/server-state.json`.
- To keep state across container recreation, mount a volume or bind mount that path.

Validation:

1. Open `http://127.0.0.1:4000/`.
2. Check `http://127.0.0.1:4000/devices`.
3. Confirm the embedded web loads from the same origin.

## 4. Start services locally (separate terminals)

Terminal 1:

```bash
npm run start:server
```

Terminal 2:

```bash
npm run start:agent
```

Terminal 3:

```bash
npm run start:web
```

If port `3000` is busy, Next.js will automatically use the next available port.

## 5. Build the embedded server artifact locally

```bash
npm run build:artifact:server
```

This generates `dist-artifacts/server` with:

- compiled server runtime under `dist/`
- exported web under `web/`
- compiled internal workspace packages under `node_modules/@luna`

## 6. Build the agent package locally

```bash
npm run build:artifact:agent
```

This generates `dist-artifacts/agent` with:

- compiled agent runtime under `dist/`
- internal workspace packages under `node_modules/@luna`
- external runtime dependencies under `node_modules/`
- embedded Node runtime under `runtime/`
- local bootstrap files `.env.example` and `run-agent.cmd` or `run-agent.sh`

First package run:

1. Copy `dist-artifacts/agent` to the target machine.
2. Run `run-agent.cmd` on Windows or `./run-agent.sh` on Unix-like systems.
3. If `.env` does not exist, the launcher creates it from `.env.example` and continues execution.
4. Prefer passing runtime overrides via CLI when starting the agent, for example:
   - Windows: `run-agent.cmd --server-host 192.168.0.10 --server-port 4000`
   - Unix: `./run-agent.sh --server-host 192.168.0.10 --server-port 4000`

## 7. Manual validation

1. Open the web UI.
2. Send `Abrir Spotify no Notebook 2`.
3. Check UI success feedback and agent log output.
4. Restart the server and confirm approved devices plus command history are preserved.

## 8. Run agent from npm package (recommended for users)

Run without global install:

```bash
npm exec --yes --package @vitorqf/luna-agent luna-agent -- \
  --server-host 192.168.0.10 --server-port 4000
```

Optional global install:

```bash
npm install -g @vitorqf/luna-agent
luna-agent --server-host 192.168.0.10 --server-port 4000
```
