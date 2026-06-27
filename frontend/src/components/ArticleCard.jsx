import { cleanSummary } from "../utils";

const sourceColors = {
  "BBC News": "#bb1919",
  "NPR": "#006666",
  "The Guardian": "#052962",
  "Al Jazeera": "#c8102e",
  "CNN": "#cc0000",
};

export default function ArticleCard({ article }) {
  const color = sourceColors[article.source] || "#555";
  const date = (article.published || article.fetched_at || "").slice(0, 10);

  return (
    <div className="card">
      <div className="card-meta">
        <span className="badge" style={{ background: color }}>{article.source}</span>
        <span className="date">{date}</span>
      </div>
      <h3>{article.title}</h3>
      <p className="summary">{cleanSummary(article.summary)}</p>
      <a href={article.url} target="_blank" rel="noopener" className="read-link">
        Read article →
      </a>
    </div>
  );
}
