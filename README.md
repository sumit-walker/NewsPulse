# NewsPulse — RSS News Aggregator with Topic Clustering

A full-stack news aggregator that fetches articles from multiple RSS feeds, groups related stories into topic clusters, and displays them on an interactive timeline.

## Architecture

```
React (Vite) ──► Node.js (Express) ──► MongoDB Atlas ◄── Python (scraper + cluster)
```

| Layer | Tech | Role |
|-------|------|------|
| Frontend | React + Vite | Interactive UI: articles, clusters, timeline |
| API | Node.js / Express | REST API + serves frontend build + triggers Python |
| Database | MongoDB Atlas | Stores articles, clusters, job status |
| Data Pipeline | Python | Fetches RSS feeds, extracts bodies, groups into clusters |

## RSS Sources

| Source | Feed URL |
|--------|----------|
| BBC News | https://feeds.bbci.co.uk/news/rss.xml |
| NPR | https://feeds.npr.org/1001/rss.xml |
| The Guardian | https://www.theguardian.com/world/rss |
| Al Jazeera | https://www.aljazeera.com/xml/rss/all.xml |
| CNN | http://rss.cnn.com/rss/cnn_topstories.rss |

## Project Structure

```
├── .env                          # MongoDB URI, RSS URLs
├── requirements.txt              # Python dependencies
├── README.md
├── scraper/
│   ├── db.py                     # MongoDB connection helper
│   ├── scraper.py                # RSS fetch → extract → store
│   └── cluster.py                # Keyword-overlap clustering
├── backend/
│   ├── package.json
│   ├── .env                      # PORT, MONGODB_URI, SCRAPER_DIR
│   └── server.js                 # Express API + static file server
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── api.js                # API client
        ├── utils.js              # Helper functions (cleanSummary)
        ├── components/           # Navbar, ArticleCard
        └── pages/                # Articles, Clusters, ClusterDetail, Timeline
```

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB Atlas cluster (or local MongoDB)

### Backend (API + Frontend)

```bash
cd frontend
npm install
npm run build          # build React for production

cd ../backend
npm install
npm start              # http://localhost:3001
```

Opens both the API and the React app at `http://localhost:3001`.

### Development mode (hot reload)

```bash
# Terminal 1 — backend
cd backend
npm start

# Terminal 2 — frontend (with Vite dev server + proxy)
cd frontend
npm run dev            # http://localhost:5173
```

### Ingest data

```bash
pip install -r requirements.txt
cd scraper
python scraper.py      # fetches RSS feeds, stores articles
python cluster.py      # groups articles into topic clusters
```

Or trigger from the UI: click "Refresh" → `POST /ingest/trigger`.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /articles | Paginated articles (supports `?source=`, `?q=`, `?page=`) |
| GET | /articles/:id | Single article |
| GET | /clusters | All clusters |
| GET | /clusters/:id | Cluster with its articles |
| GET | /timeline | Timeline data |
| POST | /ingest/trigger | Run scraper + cluster pipeline |
| GET | /ingest/status/:jobId | Poll job status |

## Deployment

### Backend — Render

1. Create a **Web Service** on Render, point it to your GitHub repo.
2. **Root Directory**: `backend`
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. **Environment Variables**:

   | Variable | Value |
   |----------|-------|
   | `MONGODB_URI` | Your MongoDB Atlas connection string |
   | `MONGODB_DB` | `newspulse` |
   | `SCRAPER_DIR` | `../scraper` |

6. Deploy — the API will be available at `https://your-app.onrender.com`.

### Frontend — Netlify / Vercel

1. Import your GitHub repo.
2. **Base directory**: `frontend`
3. **Build command**: `npm run build`
4. **Publish directory**: `dist`
5. **Environment Variable**: `VITE_API_URL` = your Render backend URL
6. Deploy.

### Automated Ingest — GitHub Actions

The repo includes `.github/workflows/ingest.yml` — a cron job that hits `POST /ingest/trigger` every 6 hours, keeping your site up-to-date automatically. No manual intervention needed.

---

## Python Stack — Detailed Explanation

### `db.py` — Database Connector

Connects to MongoDB (your database, running in the cloud on Atlas). Both `scraper.py` and `cluster.py` need to save/read from the same database, so the connection code is shared here.

- `load_dotenv()` reads `.env` to get your MongoDB username/password/URL
- `get_db()` creates one connection (stored in `_client`) and reuses it — no need to reconnect every time
- `init_indexes()` creates indexes (like a book's index) for faster lookups on `article_id`, `source`, `published`, etc.

### `scraper.py` — The News Fetcher

Downloads RSS feeds from 5 news sites, reads each article, downloads the full article page, and saves everything to MongoDB.

**Step 1 — Define sources (RSS_FEEDS)**
An RSS feed is a URL that returns a list of latest articles in XML format.

**Step 2 — Pick articles apart (normalize_entry)**
Different news sites use different field names in their RSS:
- Some use `entry.summary`, others use `entry.description`
- Some put HTML in the summary, others don't

So `normalize_entry`:
1. Grabs the title and URL
2. Tries `summary` → `description` → `content` (whichever exists)
3. **Strips HTML tags** with `re.sub(r"<[^>]*>", "", summary)` — removes `<p>`, `<br>`, etc.
4. **Decodes HTML entities** with `unescape()` — converts `&amp;` → `&`, `&#39;` → `'`
5. Generates a unique ID using SHA256 hash of the URL

**Step 3 — Download full article (extract_body)**
RSS feeds only give a short summary, not the full article:
1. `requests.get(url)` downloads the full HTML page
2. `trafilatura.extract()` strips out ads, menus, sidebars — keeps only the article text (like "reader mode" in a browser)

**Step 4 — Save to MongoDB (sync_feeds)**
```python
db.articles.update_one(
    {"article_id": article["article_id"]},
    {"$setOnInsert": doc},
    upsert=True,
)
```
- `upsert=True`: "find this article, if it exists do nothing, if not, insert it"
- `$setOnInsert`: "only set these fields when inserting new"

Result: Running the scraper 10 times never duplicates articles. Only new URLs are added.

### `cluster.py` — The Topic Grouper

Reads all articles from MongoDB and groups related ones into clusters (topics).

**Step 1 — Tokenize titles (tokenize)**
Takes a title like `"US Election 2024: Latest Results and Updates"`:
1. Lowercases → `"us election 2024: latest results and updates"`
2. Extracts words ≥3 letters → `["us", "election", "latest", "results", "and", "updates"]`
3. Removes common stopwords (like "and", "the", "for") → `["election", "latest", "results", "updates"]`

**Step 2 — Find connections (combinations)**
Takes every pair of articles and checks how many keywords they share. If ≥2 keywords match, they're connected.

Example:
- Article A keywords: `{election, results, polls}`
- Article B keywords: `{election, polls, voters}`
- Shared: `{election, polls}` → 2 shared → connected

**Step 3 — Form groups via BFS**
"Friends-of-friends": If A connects to B, and B connects to C, then A, B, C all go in the same group — even if A and C don't directly share keywords.

**Step 4 — Label and store**
For each cluster:
1. Count all keywords across all articles in the group
2. Pick the **most common** keyword as the label (e.g., "election")
3. Save to MongoDB with: label, top 10 keywords, list of article IDs, time range
4. Update each article to mark which cluster it belongs to

Before saving, all old clusters are deleted — each run is a fresh recluster.

### Full Pipeline Flow

```
You run:   python scraper.py
────────────────────────────────────────────
1. Fetch RSS feeds from BBC, CNN, NPR, etc.
2. For each article → clean summary → generate ID
3. Download full page → extract body text
4. Store in MongoDB (skip if already exists)

Then:     python cluster.py
────────────────────────────────────────────
1. Read all articles from MongoDB
2. Tokenize every title
3. Find which articles share keywords
4. Group connected articles
5. Label each group
6. Save clusters to MongoDB
```

Both scripts are independent — run the scraper multiple times to collect articles, then run the clusterer once to organize them.

### Python Libraries

| Library | Purpose |
|---------|---------|
| `feedparser` | Parses RSS/Atom XML feeds into Python objects |
| `requests` | Downloads RSS feeds and article web pages via HTTP |
| `trafilatura` | Extracts clean article body text from HTML pages (removes ads, navigation, clutter) |
| `pymongo` | MongoDB driver — insert/query articles and clusters |
| `python-dotenv` | Loads `.env` file for config (MongoDB URI, etc.) |
| `hashlib` | Generates unique article IDs (SHA256 of URL) |
| `re` | Tokenization, HTML tag removal |
| `collections` | `Counter` for keyword frequency, `defaultdict` for graph adjacency |
| `itertools` | `combinations` to compare every pair of articles |

## Clustering Algorithm

- Two articles connect if their keyword sets share **≥2 words** (`min_shared` threshold)
- Connected components found via BFS
- Each component with ≥2 members becomes a cluster
- Labeled with the most frequent keyword
- Top 10 keywords stored for display
