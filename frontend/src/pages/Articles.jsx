import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getArticles } from "../api";
import ArticleCard from "../components/ArticleCard";

export default function Articles() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const page = Number(searchParams.get("page")) || 1;
  const source = searchParams.get("source") || "";
  const q = searchParams.get("q") || "";

  useEffect(() => {
    setLoading(true);
    getArticles({ page, source, q, per_page: 12 })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, source, q]);

  function setParam(key, val) {
    const next = new URLSearchParams(searchParams);
    if (val) next.set(key, val);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    setSearchParams(next);
  }

  return (
    <div className="page">
      <div className="filters">
        <input
          type="text"
          placeholder="Search headlines…"
          value={q}
          onChange={(e) => setParam("q", e.target.value)}
          className="search-input"
        />
        <select value={source} onChange={(e) => setParam("source", e.target.value)} className="source-select">
          <option value="">All Sources</option>
          {data?.sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          <div className="stats">{data?.total} articles found</div>
          <div className="grid">
            {data?.articles.map((a) => <ArticleCard key={a.article_id} article={a} />)}
          </div>

          {data && data.total_pages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>← Prev</button>
              <span className="current">Page {page} of {data.total_pages}</span>
              <button disabled={page >= data.total_pages} onClick={() => setParam("page", String(page + 1))}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
