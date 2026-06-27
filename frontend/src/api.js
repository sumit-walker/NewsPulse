const BASE = import.meta.env.VITE_API_URL || "";

export async function getArticles(opts = {}) {
  const params = new URLSearchParams();
  if (opts.page) params.set("page", String(opts.page));
  if (opts.source) params.set("source", opts.source);
  if (opts.q) params.set("q", opts.q);
  if (opts.per_page) params.set("per_page", String(opts.per_page));
  const res = await fetch(`${BASE}/articles?${params}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getArticle(id) {
  const res = await fetch(`${BASE}/articles/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getClusters() {
  const res = await fetch(`${BASE}/clusters`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getCluster(id) {
  const res = await fetch(`${BASE}/clusters/${id}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getTimeline() {
  const res = await fetch(`${BASE}/timeline`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function triggerIngest() {
  const res = await fetch(`${BASE}/ingest/trigger`, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
