import asyncio
from datetime import datetime, timedelta, timezone
from time import monotonic
from collections import deque
from typing import Any

from urllib.parse import urlencode

from .config import football_data_token, settings


async def _fetch_json(url: str, params: dict[str, Any], token: str) -> tuple[int, dict[str, Any]]:
    query = urlencode(params)
    target = f"{url}?{query}" if query else url
    headers = {"X-Auth-Token": token}
    try:
        from js import fetch  # type: ignore[import-not-found]
    except ImportError:
        import httpx

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(target, headers=headers)
        return response.status_code, response.json() if response.content else {}
    response = await fetch(target, {"method": "GET", "headers": headers})
    body = await response.json()
    return int(response.status), body


def _check_response(status: int, body: dict[str, Any], historical: bool = False) -> dict[str, Any]:
    if status == 401:
        raise RuntimeError("football-data.org rejected the token. Check FOOTBALL_DATA_TOKEN.")
    if status == 403:
        suffix = "historical match data" if historical else "this competition or endpoint"
        raise RuntimeError(f"football-data.org denied access to {suffix} on the current plan.")
    if status == 429:
        raise RuntimeError("football-data.org rate limit reached. Please retry later.")
    if status >= 400:
        raise RuntimeError("football-data.org returned an unsuccessful response.")
    return body


class FootballProvider:
    """football-data.org v4 adapter. Unsupported statistics are deliberately omitted."""

    def __init__(self) -> None:
        self.config = settings()
        self._fixtures: tuple[float, list[dict[str, Any]]] | None = None
        self._call_times: deque[float] = deque()
        self._rate_lock = asyncio.Lock()
        self._fixture_lock = asyncio.Lock()

    async def _request(self, url: str, params: dict[str, Any], token: str, historical: bool = False) -> dict[str, Any]:
        # Leave a little headroom under the provider's Free plan limit of 10 calls/minute.
        while True:
            async with self._rate_lock:
                now = monotonic()
                while self._call_times and now - self._call_times[0] >= 60:
                    self._call_times.popleft()
                if len(self._call_times) < 9:
                    self._call_times.append(now)
                    break
                wait = max(0.1, 60 - (now - self._call_times[0]) + 0.1)
            await asyncio.sleep(wait)
        status, body = await _fetch_json(url, params, token)
        return _check_response(status, body, historical)

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        token = football_data_token()
        if not token:
            raise RuntimeError("Football data token is not configured.")
        url = f"{self.config.football_data_base_url.rstrip('/')}/{path.lstrip('/')}"
        return await self._request(url, params or {}, token)

    async def upcoming(self) -> list[dict[str, Any]]:
        async with self._fixture_lock:
            return await self._load_upcoming()

    async def _load_upcoming(self) -> list[dict[str, Any]]:
        now = datetime.now(timezone.utc).timestamp()
        if self._fixtures and now - self._fixtures[0] < self.config.data_cache_seconds:
            return self._fixtures[1]
        today = datetime.now(timezone.utc).date()
        payloads = []
        # football-data.org limits a date range to ten days per request. A 30-day
        # window ensures later European competition rounds can appear in search.
        for offset in (0, 10, 20):
            start = today + timedelta(days=offset)
            end = start + timedelta(days=9)
            payloads.append(await self._get("matches", {"dateFrom": start.isoformat(), "dateTo": end.isoformat(), "status": "SCHEDULED"}))
        retrieved = datetime.now(timezone.utc).isoformat()
        fixtures = []
        for match in (match for payload in payloads for match in payload.get("matches", [])):
            home = match.get("homeTeam") or {}
            away = match.get("awayTeam") or {}
            comp = match.get("competition") or {}
            home_name = home.get("name") or home.get("shortName") or "Home team"
            away_name = away.get("name") or away.get("shortName") or "Away team"
            home_short = home.get("shortName") or home_name or "HOME"
            away_short = away.get("shortName") or away_name or "AWAY"
            area = match.get("area") or comp.get("area") or {}
            # football-data.org exposes Spain's top flight under its legacy
            # competition name, "Primera Division" (code PD). Use the familiar
            # La Liga label in EdgeIQ while retaining the provider code for
            # reliable competition identity.
            competition_code = comp.get("code") or ""
            competition_name = comp.get("name") or "Football"
            if competition_code == "PD":
                competition_name = "La Liga"
            fixtures.append({
                "id": match["id"], "home": home_name, "away": away_name,
                "home_code": home.get("tla") or home_short[:3].upper(),
                "away_code": away.get("tla") or away_short[:3].upper(),
                "league": competition_name, "country": area.get("name", ""),
                "kickoff": match.get("utcDate"), "venue": match.get("venue"), "status": match.get("status", "SCHEDULED"),
                "source": "football-data.org", "data_retrieved_at": retrieved, "demo": False,
                "home_team_id": home.get("id"), "away_team_id": away.get("id"), "competition_id": comp.get("id"),
                "competition_code": competition_code,
                "stats": {"home_goals_for": None, "away_goals_for": None, "home_goals_against": None,
                          "away_goals_against": None, "home_corners": None, "away_corners": None,
                          "home_cards": None, "away_cards": None},
            })
        self._fixtures = (now, fixtures)
        return fixtures

    async def fixture_with_statistics(self, fixture: dict[str, Any]) -> dict[str, Any]:
        # Recent venue-specific finished matches provide only goal form. The provider does not
        # expose corner counts; do not infer corners from unrelated data.
        kickoff_date = datetime.fromisoformat(fixture["kickoff"].replace("Z", "+00:00")).date()
        date_from = (kickoff_date - timedelta(days=365)).isoformat()
        date_to = (kickoff_date - timedelta(days=1)).isoformat()
        tasks = []
        token = football_data_token()
        for team_id, venue in ((fixture.get("home_team_id"), "HOME"), (fixture.get("away_team_id"), "AWAY")):
            if not team_id:
                tasks.append(None)
                continue
            url = f"{self.config.football_data_base_url.rstrip('/')}/teams/{team_id}/matches"
            body = await self._request(url, {"dateFrom": date_from, "dateTo": date_to, "status": "FINISHED", "venue": venue, "limit": 10}, token, historical=True)
            tasks.append(body.get("matches", []))
        stats = dict(fixture.get("stats", {}))
        for side, matches in zip(("home", "away"), tasks):
            if not matches:
                continue
            gf, ga = [], []
            for match in matches:
                score = match.get("score", {}).get("fullTime", {})
                h, a = score.get("home"), score.get("away")
                if h is None or a is None:
                    continue
                is_home = match.get("homeTeam", {}).get("id") == fixture.get(f"{side}_team_id")
                gf.append(h if is_home else a)
                ga.append(a if is_home else h)
            if gf:
                stats[f"{side}_goals_for"] = sum(gf) / len(gf)
                stats[f"{side}_goals_against"] = sum(ga) / len(ga)
                stats[f"{side}_sample"] = len(gf)
        result = {**fixture, "stats": stats}
        result["data_retrieved_at"] = datetime.now(timezone.utc).isoformat()
        return result
