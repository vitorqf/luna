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
- `LUNA_AGENT_SERVER_URL`
- `LUNA_AGENT_DEVICE_ID`
- `LUNA_AGENT_DEVICE_NAME`
- `LUNA_AGENT_DEVICE_HOSTNAME`
- `NEXT_PUBLIC_LUNA_SERVER_URL`

## 3. Start services (separate terminals)

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

## 4. Manual validation

1. Open the web UI.
2. Send `Abrir Spotify no Notebook 2`.
3. Check UI success feedback and agent log output.
