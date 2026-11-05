# EdgeIQ Sports

A fixture-first football analysis app. The frontend is a React + TypeScript + Vite app; the backend is a FastAPI service with a replaceable football data provider and transparent Poisson goal estimates.

## Run locally

### Backend

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

For a fresh checkout, create a Python 3.12+ virtual environment at the project root, then install `backend/requirements.txt` into it before starting the server.

Set `FOOTBALL_DATA_TOKEN` in `backend/.env` to connect football-data.org. Its coverage and plan limits determine which competitions and historical matches are available. The current adapter uses match schedules and recent venue-specific goal records; corner data is not supplied and corner estimates are withheld.

### Frontend

```powershell
npm install
npm run dev
```

The development server proxies `/api` to `http://localhost:8000`.

## Render deployment

The app uses a Render Blueprint to publish the Vite frontend and FastAPI service as separate services. Push the repository to GitHub and create a Blueprint from `render.yaml`. During the initial setup, Render prompts for `FOOTBALL_DATA_TOKEN`; add it as a secret value there, never in Git. Both services use Render's free tier by default. Free web services spin down after 15 minutes idle and can take about a minute to wake up.

## Cloudflare deployment option

The app is configured as a Cloudflare Python Worker serving both the FastAPI API and the built Vite assets. Install `uv` and Node.js, then run `npm install` and `npm run build`. Add the football-data.org key to the Worker secret store as `FOOTBALL_DATA_TOKEN`; do not commit it or add it to `wrangler.jsonc`. Deploy with `uv run pywrangler deploy`. Cloudflare's FastAPI Worker support and static asset binding are described in the [Cloudflare FastAPI Worker guide](https://developers.cloudflare.com/workers/languages/python/packages/fastapi/).

## Current scope

- Search fixtures by team or competition and analyze a selected fixture.
- Browse up to five featured upcoming fixtures.
- Show goal estimates with data-quality notes. Corner and card estimates appear only when a connected provider supplies enough verified observations.
- Clearly distinguish demo data from provider data.
- No bookmaker, betting-slip, or bet-placement features.

Predictions are statistical estimates and are not guarantees.
