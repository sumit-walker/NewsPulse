import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getCluster } from "../api";
import ArticleCard from "../components/ArticleCard";

export default function ClusterDetail() {
  const { id } = useParams();
  const [cluster, setCluster] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getCluster(id).then(setCluster).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page"><div className="loading">Loading...</div></div>;
  if (!cluster) return <div className="page"><div className="loading">Cluster not found</div></div>;

  return (
    <div className="page">
      <Link to="/clusters" className="back-link">← Back to clusters</Link>

      <div className="cluster-header">
        <h2>{cluster.label}</h2>
        <div className="cluster-meta">
          <span>{cluster.article_count} articles</span>
          <span>{cluster.time_start?.slice(0, 10)} → {cluster.time_end?.slice(0, 10)}</span>
        </div>
        <div className="keywords">
          {cluster.keywords?.map((kw) => <span key={kw} className="kw">{kw}</span>)}
        </div>
      </div>

      <div className="grid">
        {cluster.articles?.map((a) => <ArticleCard key={a.article_id} article={a} />)}
      </div>
    </div>
  );
}
