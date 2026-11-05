import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { Activity, ArrowRight, CalendarDays, ChevronDown, Clock3, Crosshair, Search, ShieldCheck, Sparkles, Target, TrendingUp, Waves } from 'lucide-react'
import { getAnalysis, getFixtures } from './api'
import type { Analysis, Fixture } from './types'

const leagues = ['All competitions', 'UEFA Champions League', 'UEFA Europa League', 'Premier League', 'La Liga', 'Serie A', 'Bundesliga', 'Ligue 1', 'FIFA World Cup', 'European Championship']
const codeColor: Record<string, string> = { ARS: '#e84c4c', CHE: '#497cff', LIV: '#e65051', MCI: '#61bee3', TOT: '#dce6f4', NEW: '#ebebeb', RMA: '#f0ce65', BAR: '#e34764', ATM: '#ee626c', INT: '#5293ff', MIL: '#ec575c', BAY: '#ec5c5c', DOR: '#e9d94b', PSG: '#ed687d' }
function crest(code: string) { return <span className="crest" style={{ '--crest': codeColor[code] ?? '#9ca99f' } as CSSProperties}>{code.slice(0, 3)}</span> }
function dateParts(value: string) { const d = new Date(value); return { day: d.toLocaleDateString(undefined, { day: '2-digit' }), month: d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase(), time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) } }
function fixtureDate(value: string) { const d = new Date(value); return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) }

export default function App() {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [search, setSearch] = useState('')
  const [league, setLeague] = useState(leagues[0])
  const [selected, setSelected] = useState<Analysis | null>(null)
  const [previews, setPreviews] = useState<Record<number, Analysis | null>>({})
  const [loading, setLoading] = useState(true)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { getFixtures().then(r => { setFixtures(r.fixtures); if ('warning' in r && r.warning) setError(r.warning) }).catch(() => setError('Could not load fixtures. Check that the API server is running.')).finally(() => setLoading(false)) }, [])
  const results = useMemo(() => { const q = search.toLowerCase().replace(/\b(vs|v|against)\b|[-–]/g, ' ').replace(/\s+/g, ' ').trim(); const priority: Record<string, number> = { 'UEFA Champions League': 0, 'UEFA Europa League': 1, 'FIFA World Cup': 2, 'European Championship': 3, 'Premier League': 4, 'La Liga': 5, 'Serie A': 6, Bundesliga: 7, 'Ligue 1': 8 }; return fixtures.filter(f => (league === 'All competitions' || f.league === league) && (!q || `${f.home} ${f.away} ${f.league} ${f.country}`.toLowerCase().includes(q))).sort((a, b) => (priority[a.league] ?? 9) - (priority[b.league] ?? 9) || a.kickoff.localeCompare(b.kickoff)) }, [fixtures, search, league])
  const featured = results.slice(0, 5)
  const featuredKey = featured.map(f => f.id).join(',')
  useEffect(() => {
    let active = true
    setPreviews({})
    featured.forEach(f => {
      getAnalysis(f.id).then(result => { if (active) setPreviews(current => ({ ...current, [f.id]: result })) })
        .catch(() => { if (active) setPreviews(current => ({ ...current, [f.id]: null })) })
    })
    return () => { active = false }
  }, [featuredKey])
  const choose = async (f: Fixture) => { setAnalysisLoading(true); setError(''); try { setSelected(previews[f.id] || await getAnalysis(f.id)); window.scrollTo({ top: 0, behavior: 'smooth' }) } catch { setError('Analysis could not be loaded. Please try again.') } finally { setAnalysisLoading(false) } }

  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#top"><span className="brand-mark"><Activity size={21} strokeWidth={2.5} /></span><span>edgeiq<span className="brand-sports"> SPORTS</span></span></a>
      <div className="side-label">WORKSPACE</div>
      <button className="nav-item active"><span className="nav-icon">▦</span> Overview</button>
      <button className="nav-item" onClick={() => { setSelected(null); document.querySelector('#fixtures')?.scrollIntoView({ behavior: 'smooth' }) }}><CalendarDays size={17} /> Fixtures</button>
      <button className="nav-item" onClick={() => setSelected(null)}><TrendingUp size={17} /> Predictions</button>
      <div className="side-bottom"><div className="live-card"><span className="live-dot" /> DATA STATUS <span className="live-right">{fixtures[0]?.demo ? 'DEMO' : 'LIVE'}</span><p>{fixtures[0]?.demo ? 'Illustrative preview only' : 'Provider connected'}</p></div><div className="side-foot">EDGEIQ SPORTS <span>v1.0</span></div></div>
    </aside>
    <main id="top" className="main-content">
      <header className="topbar"><div className="crumb">Workspace <span>/</span> Overview</div><div className="top-right"><span className="today-label"><span className="live-dot" /> FOOTBALL INTELLIGENCE</span><span className="avatar">E</span></div></header>
      {selected ? <AnalysisView analysis={selected} onBack={() => setSelected(null)} /> : <>
        <section className="hero">
          <div className="hero-copy"><div className="eyebrow"><Sparkles size={13} /> THE MATCHDAY BRIEFING</div><h1>See the game<br /><span>more clearly.</span></h1><p>Thoughtful football analysis, backed by data.<br />Find a fixture and see what the numbers say.</p><div className="search-box"><Search size={19} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search a team, fixture or competition..." /><kbd>↵</kbd></div><div className="hero-meta"><span><span className="live-dot" /> {fixtures.length} UPCOMING FIXTURES</span><span>UPDATED {fixtures[0] ? new Date(fixtures[0].kickoff).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase() : '—'}</span></div></div>
          <div className="hero-visual"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="pitch-line center-line"/><div className="pitch-line center-circle"/><div className="pitch-line box-left"/><div className="pitch-line box-right"/><div className="pitch-dot dot-one"/><div className="pitch-dot dot-two"/><div className="visual-tag"><span className="live-dot"/> DATA-LED INSIGHT</div><div className="visual-score"><div className="visual-score-top">ANALYSIS PREVIEW <span>01 / 05</span></div><div className="visual-teams"><div>{crest('ARS')}<span>ARS</span></div><b>VS</b><div>{crest('CHE')}<span>CHE</span></div></div><div className="visual-prediction"><span>PREVIEW</span><strong>Choose a fixture</strong><span className="confidence-chip">DEMO</span></div></div></div>
        </section>
        <section className="metrics-row"><Metric icon={<CalendarDays size={17}/>} label="FIXTURES TRACKED" value={String(fixtures.length).padStart(2, '0')} note="Upcoming matches"/><Metric icon={<Crosshair size={17}/>} label="MARKETS COVERED" value="04" note="Goals · result · totals"/><Metric icon={<ShieldCheck size={17}/>} label="DATA APPROACH" value="01" note="Transparent models"/><Metric icon={<TrendingUp size={17}/>} label="MODEL STATUS" value="LIVE" note="Estimates, not guarantees" live/></section>
        {error && <div className="error-banner">{error}</div>}
        <section id="fixtures" className="fixtures-section"><div className="section-head"><div><div className="section-kicker">THE CALENDAR</div><h2>{search ? 'Search results' : 'Upcoming fixtures'} <span className="count-pill">{featured.length}</span></h2><p>Pick a fixture to explore the form, the data and the probabilities.</p></div><label className="league-select"><select value={league} onChange={e => setLeague(e.target.value)}>{leagues.map(l => <option key={l}>{l}</option>)}</select><ChevronDown size={14}/></label></div>
          {loading ? <div className="loading-state"><span className="spinner"/> Gathering the latest fixtures…</div> : featured.length ? <div className="fixture-grid">{featured.map((f, i) => <FixtureCard key={f.id} fixture={f} index={i} preview={previews[f.id]} onClick={() => choose(f)} busy={analysisLoading}/>)}</div> : <div className="empty-state"><Search size={24}/><h3>No fixtures found</h3><p>Try a team name, league, or a different search.</p></div>}
          <div className="section-foot"><span>Showing up to five featured fixtures</span><span>Kickoff times shown in your local timezone</span></div>
        </section>
        <footer className="disclaimer"><span><ShieldCheck size={15}/></span><p><strong>A note on predictions</strong> Every probability is a statistical estimate based on available data. Football is unpredictable; no outcome is guaranteed.</p><button onClick={() => document.querySelector('#fixtures')?.scrollIntoView({ behavior: 'smooth' })}>ABOUT OUR APPROACH <ArrowRight size={13}/></button></footer>
      </>}
      {analysisLoading && <div className="loading-overlay"><div><span className="spinner"/> Preparing fixture analysis…</div></div>}
    </main>
  </div>
}
function Metric({ icon, label, value, note, live }: { icon: ReactNode; label: string; value: string; note: string; live?: boolean }) { return <div className="metric"><div className="metric-top"><span className="metric-icon">{icon}</span><span>{label}</span></div><div className={`metric-value ${live ? 'small-value' : ''}`}>{value}</div><div className="metric-note">{note}</div></div> }
function FixtureCard({ fixture: f, index, preview, onClick, busy }: { fixture: Fixture; index: number; preview?: Analysis | null; onClick: () => void; busy: boolean }) {
  const d = dateParts(f.kickoff)
  const best = preview?.predictions.filter(p => p.market !== 'Scoreline').sort((a, b) => b.probability - a.probability)[0]
  return <article className="fixture-card">
    <div className="card-top"><span className="competition"><span className="league-mark">✳</span>{f.league}{f.demo && <span className="demo-pill">DEMO</span>}</span><span className="match-number">MATCH 0{index + 1}</span></div>
    <div className={`best-outcome ${preview === undefined ? 'is-pending' : ''}`} aria-live="polite">
      <div className="best-outcome-label"><Target size={16}/><span>MOST LIKELY MODEL OUTCOME</span></div>
      {best ? <><strong>{best.outcome}</strong><span>{best.market} · {best.probability}% estimated probability · {best.confidence} confidence</span></> : preview === undefined ? <span className="outcome-status">Calculating from recent team form…</span> : preview === null ? <span className="outcome-status">Preview unavailable right now. Open analysis to retry.</span> : <span className="outcome-status">Not enough verified form to rank an outcome.</span>}
    </div>
    <div className="match-date"><span className="date-block"><b>{d.day}</b><small>{d.month}</small></span><span>{fixtureDate(f.kickoff)}</span><span className="time"><Clock3 size={16}/>{d.time}</span></div>
    <div className="teams"><div className="team"><span className="team-crest">{crest(f.home_code)}</span><span>{f.home}</span></div><span className="versus">VS</span><div className="team"><span className="team-crest">{crest(f.away_code)}</span><span>{f.away}</span></div></div>
    <div className="card-insight"><span className="insight-glyph"><TrendingUp size={17}/></span><div><small>DATA NOTE</small><p>{f.demo ? 'Illustrative preview figures only.' : preview?.summary?.[0] ?? 'Available team form is being loaded.'}</p></div></div>
    <button className="analyze-button" onClick={onClick} disabled={busy}>Open full analysis <ArrowRight size={17}/></button>
  </article>
}
function AnalysisView({ analysis: a, onBack }: { analysis: Analysis; onBack: () => void }) { const f = a.fixture; const d = dateParts(f.kickoff); const groups = [{ title: 'MATCH & GOALS', icon: <Target size={16}/>, rows: a.predictions.filter(p => ['Match result', 'Double chance', 'Total goals', 'Both teams to score', 'First-half goals', 'Team goals', 'Scoreline'].includes(p.market)) }, { title: 'CORNERS', icon: <FlagIcon/>, rows: a.predictions.filter(p => p.market.toLowerCase().includes('corner')) }, { title: 'CARDS', icon: <ShieldCheck size={16}/>, rows: a.predictions.filter(p => p.market.toLowerCase().includes('card')) }, { title: 'PLAYER INSIGHTS', icon: <Crosshair size={16}/>, rows: a.predictions.filter(p => p.market.toLowerCase().includes('player')) }]; return <div className="analysis-page"><button className="back-button" onClick={onBack}>← Back to fixtures</button><div className="analysis-heading"><div><div className="eyebrow"><Sparkles size={13}/> FIXTURE INTELLIGENCE</div><h1>Match <span>analysis</span></h1><p>{f.league} · {fixtureDate(f.kickoff)} · {d.time} local time</p></div><span className="quality-tag"><span className="live-dot"/> {f.demo ? 'DEMO DATA' : 'PROVIDER DATA'}</span></div><div className="match-banner"><div className="match-side">{crest(f.home_code)}<strong>{f.home}</strong><small>HOME</small></div><div className="match-center"><span>{f.league.toUpperCase()}</span><b>VS</b><small>{d.day} {d.month} · {d.time}</small></div><div className="match-side right">{crest(f.away_code)}<strong>{f.away}</strong><small>AWAY</small></div></div><div className="analysis-layout"><div className="analysis-main"><div className="panel-title"><div><span className="section-kicker">MODEL OUTPUT</span><h2>Probability estimates</h2></div><span className="model-tag">{a.model_version}</span></div><p className="panel-intro">Estimates below come from available team performance data. Markets without enough reliable data are not shown.</p>{f.demo && <div className="demo-warning">Illustrative demonstration only. These sample figures do not describe verified team performance.</div>}{!f.demo && <div className="data-footnote"><ShieldCheck size={15}/>Corners and card estimates are unavailable from this provider and are hidden.</div>}{groups.filter(g => g.rows.length).map(g => <section className="market-group" key={g.title}><h3>{g.icon}{g.title}</h3><div className="prediction-list">{g.rows.map(p => <div className="prediction-row" title={p.note} key={`${p.market}-${p.outcome}`}><div className="prediction-name"><strong>{p.market}</strong><span>{p.outcome}</span></div><div className="probability-track"><span style={{ width: `${p.probability}%` }}/></div><strong className="probability-value">{p.probability}%</strong><span className={`confidence ${p.confidence.toLowerCase()}`}>{p.confidence}</span></div>)}</div></section>)}{!a.predictions.length && <div className="empty-state"><p>There is not enough verified data to produce estimates for this fixture.</p></div>}<div className="data-footnote"><ShieldCheck size={15}/>{a.data_quality}</div></div><aside className="analysis-aside"><div className="aside-card"><div className="aside-title"><Sparkles size={16}/><span>THE READ</span></div><h3>What the numbers suggest</h3><ul>{a.summary.map((s, i) => <li key={i}><span className="summary-dot"/>{s}</li>)}</ul></div><div className="aside-card stats-card"><div className="aside-title"><Activity size={16}/><span>TEAM SNAPSHOT</span></div><div className="stat-line"><span>Home goals / match</span><b>{f.stats.home_goals_for?.toFixed(1) ?? '—'}</b></div><div className="stat-line"><span>Away goals / match</span><b>{f.stats.away_goals_for?.toFixed(1) ?? '—'}</b></div><div className="stat-line"><span>Home sample matches</span><b>{f.stats.home_sample ?? '—'}</b></div><div className="stat-line"><span>Away sample matches</span><b>{f.stats.away_sample ?? '—'}</b></div><small className="stat-source">{f.demo ? 'Illustrative demo inputs · not observed match data' : 'Goal form · recent matches at the same venue. Corners and cards are not supplied by this provider.'}</small></div><div className="mini-disclaimer">Probabilities describe model uncertainty and are not predictions of certainty. No result is guaranteed.</div></aside></div><div className="analysis-timestamp"><span>DATA SOURCE: {f.source.toUpperCase()}</span><span>GENERATED {new Date(a.generated_at).toLocaleString()}</span><span>MODEL {a.model_version}</span></div></div> }
function FlagIcon() { return <Waves size={16}/> }
