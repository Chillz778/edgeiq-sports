from typing import Any
from time import monotonic
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from .providers import FootballProvider
from .analysis import analyze
from .config import _request_token

app = FastAPI(title="EdgeIQ Sports API", version="0.1.0", description="Football fixture search and transparent statistical analysis")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["GET"], allow_headers=["*"])
provider = FootballProvider()
analysis_cache: dict[int, tuple[float, dict[str, Any]]] = {}


@app.middleware("http")
async def bind_worker_secrets(request, call_next):
    env = request.scope.get("env")
    token = getattr(env, "FOOTBALL_DATA_TOKEN", "") if env is not None else ""
    reset = _request_token.set(str(token) if token else "")
    try:
        return await call_next(request)
    finally:
        _request_token.reset(reset)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/fixtures")
async def fixtures(q: str = Query(default="", max_length=120)) -> dict[str, Any]:
    try:
        found = await provider.upcoming()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="The football data provider is unavailable. Please retry shortly.") from exc
    query = q.strip().casefold()
    if query:
        found = [f for f in found if query in " ".join((f.get("home", ""), f.get("away", ""), f.get("league", ""), f.get("country", ""))).casefold()]
    found.sort(key=lambda f: f.get("kickoff", ""))
    return {"fixtures": found[:250], "demo": bool(found) and all(f.get("demo", False) for f in found)}


@app.get("/api/fixtures/{fixture_id}/analysis")
async def fixture_analysis(fixture_id: int) -> dict[str, Any]:
    cached = analysis_cache.get(fixture_id)
    if cached and monotonic() - cached[0] < provider.config.data_cache_seconds:
        return cached[1]
    try:
        found = await provider.upcoming()
    except Exception as exc:
        raise HTTPException(status_code=502, detail="The football data provider is unavailable. Please retry shortly.") from exc
    fixture = next((f for f in found if f["id"] == fixture_id), None)
    if fixture is None:
        raise HTTPException(status_code=404, detail="Fixture not found in current upcoming fixtures.")
    try:
        fixture = await provider.fixture_with_statistics(fixture)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Fixture found, but the provider could not return its supporting statistics.") from exc
    result = analyze(fixture)
    analysis_cache[fixture_id] = (monotonic(), result)
    return result
