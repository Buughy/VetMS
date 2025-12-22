# VetMS (Local‑First Veterinary Practice Management)

Offline-first single‑PC app to replace a complex Google Sheets workflow.

## Tech
- Frontend: React + Vite + Tailwind (TypeScript strict)
- Backend: Fastify (TypeScript strict)
- DB: SQLite (`better-sqlite3`) stored in `./data/vetms.sqlite`
- Packaging: Docker (single container serving API + static frontend)

## Quick start (Docker)
```sh
docker compose up --build
```
Then open:
- http://localhost:3000

Data persists in `./data/` via a Docker volume mount.

## Dev (no Docker)
### Install
```sh
npm install
```

### Run API + Web (two terminals)
```sh
npm run dev:api
```
```sh
npm run dev:web
```

- Web: http://localhost:5173
- API: http://localhost:3000 (CORS enabled for dev)

The Vite dev server uses [apps/web/.env.development](apps/web/.env.development) to reach the API.

The API `dev` script is configured to use the root `./data/` directory, so it shares the same database as the Docker environment.


## Scripts
- `npm run build` builds both workspaces
- `npm run typecheck` runs TypeScript checks

## Auto-start on Mac
To start the VetMS server automatically when your Mac turns on (using `launchd`):

1. Open a terminal in the project root.
2. Run the install script:
   ```sh
   chmod +x scripts/mac-install-service.sh
   ./scripts/mac-install-service.sh
   ```
3. This will build the project and register a user service. The server will start immediately and restart on login.
4. Logs are available at `/tmp/vetms.log` and `/tmp/vetms.error.log`.


## Notes
- Invoice friendly IDs are generated as `INV-YYYY-###`.
- Invoice items snapshot product name + price to preserve history.
