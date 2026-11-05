from datetime import datetime, timezone
from math import exp, factorial
from typing import Any

MODEL_VERSION = "Poisson baseline v1.0"


def poisson(lam: float, k: int) -> float:
    return exp(-lam) * lam**k / factorial(k)


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def analyze(fixture: dict[str, Any]) -> dict[str, Any]:
    stats = fixture.get("stats", {})
    hf, af = stats.get("home_goals_for"), stats.get("away_goals_for")
    ha, aa = stats.get("home_goals_against"), stats.get("away_goals_against")
    if None not in (hf, af, ha, aa):
        home_lam = clamp((hf + aa) / 2 * 1.06, .15, 4)
        away_lam = clamp((af + ha) / 2 * .94, .15, 4)
        sample_conf = "Low"
        grid = {(h, a): poisson(home_lam, h) * poisson(away_lam, a) for h in range(8) for a in range(8)}
        grid_mass = sum(grid.values())
        grid = {score: probability / grid_mass for score, probability in grid.items()}
        home_win = sum(p for (h, a), p in grid.items() if h > a)
        draw = sum(p for (h, a), p in grid.items() if h == a)
        away_win = sum(p for (h, a), p in grid.items() if h < a)
        over25 = sum(p for (h, a), p in grid.items() if h + a >= 3)
        btts = sum(p for (h, a), p in grid.items() if h > 0 and a > 0)
        total_mean = home_lam + away_lam
        predictions = [
            pred("Match result", f"{fixture['home']} win", home_win, sample_conf, "Poisson goal model"),
            pred("Match result", "Draw", draw, sample_conf, "Poisson goal model"),
            pred("Match result", f"{fixture['away']} win", away_win, sample_conf, "Poisson goal model"),
            pred("Total goals", "Over 2.5", over25, sample_conf, "Poisson goal model"),
            pred("Total goals", "Under 2.5", 1 - over25, sample_conf, "Poisson goal model"),
            pred("Both teams to score", "Yes", btts, sample_conf, "Poisson goal model"),
            pred("Both teams to score", "No", 1 - btts, sample_conf, "Poisson goal model"),
        ]
        predictions.extend(_goal_team_markets(fixture["home"], home_lam, sample_conf))
        predictions.extend(_goal_team_markets(fixture["away"], away_lam, sample_conf))
        predictions.extend([
            pred("Double chance", f"{fixture['home']} or draw", home_win + draw, sample_conf, "Derived from match-result probabilities"),
            pred("Double chance", f"{fixture['away']} or draw", away_win + draw, sample_conf, "Derived from match-result probabilities"),
        ])
        most_likely = max(grid, key=grid.get)
        predictions.append(pred("Scoreline", f"{most_likely[0]}–{most_likely[1]}", grid[most_likely], "Low", "Most likely single scoreline"))
        first_half_home, first_half_away = home_lam * .45, away_lam * .45
        fh_over = 1 - exp(-(first_half_home + first_half_away)) * (1 + first_half_home + first_half_away)
        predictions.append(pred("First-half goals", "Over 0.5", fh_over, "Low", "Uses a simple first-half scoring share"))
        corners = _count_predictions(fixture, stats, "corners", "Corners", sample_conf)
        cards = _count_predictions(fixture, stats, "cards", "Cards", "Low")
        predictions.extend(corners + cards)
        demo_note = "Values are illustrative sample inputs; they are not verified team performance." if fixture.get("demo") else f"Recent venue-specific samples: {stats.get('home_sample', 0)} home matches and {stats.get('away_sample', 0)} away matches. Corner and card estimates are hidden because this provider does not supply those observations."
        summary = [f"{fixture['home']} input rate: {hf:.1f} goals for and {ha:.1f} against per match.", f"{fixture['away']} input rate: {af:.1f} goals for and {aa:.1f} against per match.", "Goal estimates use a simple Poisson baseline and do not account for confirmed lineups or late team news.", demo_note]
        return {"fixture": fixture, "predictions": predictions, "summary": summary, "data_quality": f"{fixture.get('source', 'Unknown source')} · retrieved {fixture.get('data_retrieved_at', 'time unavailable')} · {demo_note}", "model_version": MODEL_VERSION, "generated_at": datetime.now(timezone.utc).isoformat()}
    return {"fixture": fixture, "predictions": [], "summary": ["The connected provider returned fixture information but no verified performance sample for this match.", "Estimates are withheld until relevant historical statistics are available."], "data_quality": f"{fixture.get('source', 'Unknown source')} · fixture data only; match statistics unavailable.", "model_version": MODEL_VERSION, "generated_at": datetime.now(timezone.utc).isoformat()}


def _count_predictions(fixture: dict[str, Any], stats: dict[str, Any], key: str, label: str, confidence: str) -> list[dict[str, Any]]:
    home, away = stats.get(f"home_{key}"), stats.get(f"away_{key}")
    if home is None or away is None:
        return []
    total = home + away
    # Poisson count baseline. The independent count assumption is imperfect, so market confidence is capped at low.
    result = [pred(f"{label} total", f"Over {line}", _poisson_over(total, line), "Low", f"Expected combined count {total:.1f}; simple Poisson count assumption") for line in (8.5, 9.5, 10.5)]
    result.extend([
        pred(f"{label} team comparison", f"{fixture['home']} more", _poisson_more(home, away), "Low", "Independent Poisson count comparison; high uncertainty"),
        pred(f"{label} team comparison", f"{fixture['away']} more", _poisson_more(away, home), "Low", "Independent Poisson count comparison; high uncertainty"),
    ])
    return result


def _poisson_over(lam: float, line: float) -> float:
    threshold = int(line + 0.5)
    return 1 - sum(poisson(lam, k) for k in range(threshold))


def _poisson_more(left: float, right: float) -> float:
    return sum(poisson(left, i) * sum(poisson(right, j) for j in range(i)) for i in range(21))


def _goal_team_markets(team: str, lam: float, confidence: str) -> list[dict[str, Any]]:
    return [pred("Team goals", f"{team} over {line}", _poisson_over(lam, line), confidence, "Poisson scoring estimate") for line in (0.5, 1.5)]


def pred(market: str, outcome: str, probability: float, confidence: str, note: str) -> dict[str, Any]:
    return {"market": market, "outcome": outcome, "probability": round(max(0, min(1, probability)) * 100), "confidence": confidence, "note": note}
