import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getClusters } from "../api";

export default function Clusters() {
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getClusters().then(setClusters).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><div className="loading">Loading...</div></div>;

  return (
    <div className="page">
      <h2>Topic Clusters</h2>
      <p className="subtitle">{clusters.length} clusters from connected news stories</p>

      <div className="cluster-list">
        {clusters.map((c) => (
          <Link to={`/clusters/${c.cluster_id}`} key={c.cluster_id} className="cluster-card">
            <h3>{c.label}</h3>
            <div className="cluster-meta">
              <span className="count">{c.article_count} articles</span>
              <span className="range">
                {c.time_start?.slice(0, 10)} → {c.time_end?.slice(0, 10)}
              </span>
            </div>
            <div className="keywords">
              {c.keywords?.slice(0, 5).map((kw) => (
                <span key={kw} className="kw">{kw}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
