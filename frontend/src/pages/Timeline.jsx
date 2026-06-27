import { useEffect, useState } from "react";
import { getTimeline } from "../api";

const COLORS = ["#e8b84b", "#4b7be8", "#e84b4b", "#4be8b8", "#b84be8", "#e88b4b"];

export default function Timeline() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTimeline().then(setEntries).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><div className="loading">Loading...</div></div>;
  if (!entries.length) return <div className="page"><div className="loading">No timeline data</div></div>;

  const min = new Date(entries[0].start).getTime();
  const max = new Date(entries[entries.length - 1].end).getTime();
  const range = max - min || 1;

  return (
    <div className="page">
      <h2>Timeline</h2>
      <p className="subtitle">{entries.length} story clusters over time</p>

      <div className="timeline-container">
        {entries.map((e, i) => {
          const start = ((new Date(e.start).getTime() - min) / range) * 100;
          const end = ((new Date(e.end).getTime() - min) / range) * 100;
          const bar = Math.max(end - start, 2);
          const color = COLORS[i % COLORS.length];

          return (
            <div key={e.label} className="tl-row">
              <span className="tl-label">{e.label}</span>
              <div className="tl-track">
                <div
                  className="tl-bar"
                  style={{
                    marginLeft: `${start}%`,
                    width: `${bar}%`,
                    background: color,
                  }}
                  title={`${e.label}: ${e.count} articles`}
                />
              </div>
              <span className="tl-count">{e.count}</span>
            </div>
          );
        })}
      </div>

      <div className="timeline-list">
        {entries.map((e, i) => (
          <div key={e.label} className="tl-card" style={{ borderLeftColor: COLORS[i % COLORS.length] }}>
            <h3>{e.label}</h3>
            <p className="tl-dates">{e.start?.slice(0, 10)} → {e.end?.slice(0, 10)}</p>
            <p className="tl-count">{e.count} articles</p>
            <div className="keywords">
              {e.keywords?.slice(0, 5).map((kw) => <span key={kw} className="kw">{kw}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
