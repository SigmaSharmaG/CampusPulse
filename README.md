# CampusPulse

CampusPulse is a live campus-occupancy dashboard. It combines polygon-based campus zones, PostGIS spatial queries, a five-second density simulation, WebSocket updates, and an interactive React map.

## Run with Docker Compose

Requirements: Docker Desktop with Compose.

```powershell
Copy-Item .env.example .env
docker compose up --build
```

Open the dashboard at <http://localhost:5173>; the API and interactive OpenAPI docs are at <http://localhost:8000> and <http://localhost:8000/docs>. Compose starts PostGIS, waits for its health check, then starts the API and the Vite server. The first API startup enables PostGIS, creates tables, and seeds the sample campus zones. The credentials in `.env.example` are for local development only; replace them and set a suitably restricted `CORS_ORIGINS` before deployment.

The Compose setup mounts the frontend source for hot reload and stores database files in the `campuspulse-postgres` named volume. Stop the services with `docker compose down`; database data is retained. To remove the local database and start fresh, use `docker compose down -v`.

## Local development

Copy `.env.example` to `.env`, change the database host in `DATABASE_URL` from `db` to `localhost`, make sure a PostGIS 16 database is available, and then start the API and frontend in separate terminals:

```powershell
python -m pip install -r backend/requirements.txt
python -m uvicorn app.main:app --app-dir backend --reload --host 0.0.0.0 --port 8000
```

```powershell
cd frontend
npm ci
npm run dev
```

The Vite dev server proxies `/api` and `/ws` to `http://localhost:8000`.

## API

- `GET /api/health` — API liveness.
- `GET /api/facilities` — all current facilities and GeoJSON geometry.
- `GET /api/facilities?bbox=west,south,east,north` — polygons intersecting a WGS84 bounding box.
- `GET /api/facilities?point=longitude,latitude` — the polygon covering a WGS84 point.
- `GET /api/facilities/{facility_id}/history` — up to ten density samples, oldest first.
- `WS /ws` — an initial `snapshot`, then `facility.updated` messages as the simulation advances. Idle clients receive a `ping` at the configured heartbeat interval.

HTTP errors use a consistent `{ "error": { "code": "...", "message": "...", "details": [...] } }` schema. Configure `DATABASE_URL`, JSON-array `CORS_ORIGINS`, `WS_HEARTBEAT_SECONDS`, and `SIMULATION_INTERVAL_SECONDS` with environment variables or `.env`.

## Checks

```powershell
cd frontend
npm ci
npm run build
```

Backend unit and HTTP-error contract checks:

```powershell
python -m pip install -r backend/requirements-test.txt
$env:PYTHONPATH = "backend"
python -m unittest discover -s backend/tests -v
```
