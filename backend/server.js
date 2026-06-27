require("dotenv").config();
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const { spawn } = require("child_process");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(express.json());
app.use(require("cors")());

const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.MONGODB_DB || "newspulse";
const SCRAPER_DIR = path.resolve(__dirname, process.env.SCRAPER_DIR || "../scraper");

let db;

MongoClient.connect(MONGO_URI, {
  tls: true,
  tlsInsecure: true,
  serverSelectionTimeoutMS: 10000,
})
  .then((client) => {
    db = client.db(DB_NAME);
    console.log(`Connected to MongoDB: ${DB_NAME}`);
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  });

function requireDb(req, res, next) {
  if (!db) return res.status(503).json({ error: "Database not connected" });
  req.db = db;
  next();
}

app.use(requireDb);

app.get("/clusters", async (req, res) => {
  try {
    const clusters = await req.db.collection("clusters")
      .find({}, {
        projection: {
          _id: 0,
          cluster_id: 1,
          label: 1,
          article_count: 1,
          time_start: 1,
          time_end: 1,
          keywords: 1,
        }
      })
      .sort({ article_count: -1 })
      .toArray();
    res.json(clusters);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch clusters" });
  }
});

app.get("/clusters/:id", async (req, res) => {
  try {
    const cluster = await req.db.collection("clusters").findOne(
      { cluster_id: req.params.id },
      { projection: { _id: 0 } }
    );
    if (!cluster) return res.status(404).json({ error: "Cluster not found" });

    const articles = await req.db.collection("articles")
      .find(
        { article_id: { $in: cluster.article_ids } },
        { projection: { _id: 0, article_id: 1, source: 1, title: 1, url: 1, summary: 1, published: 1 } }
      )
      .sort({ published: 1 })
      .toArray();

    res.json({ ...cluster, articles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch cluster" });
  }
});

app.get("/timeline", async (req, res) => {
  try {
    const clusters = await req.db.collection("clusters")
      .find({}, {
        projection: {
          _id: 0,
          label: 1,
          article_count: 1,
          time_start: 1,
          time_end: 1,
          keywords: 1,
        }
      })
      .sort({ time_start: 1 })
      .toArray();

    const timeline = clusters.map((c) => ({
      label: c.label,
      start: c.time_start,
      end: c.time_end,
      count: c.article_count,
      keywords: c.keywords,
    }));

    res.json(timeline);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch timeline" });
  }
});

app.get("/articles", async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const source = req.query.source || "";
    const q = req.query.q || "";
    const perPage = Math.min(100, Math.max(1, parseInt(req.query.per_page) || 20));
    const skip = (page - 1) * perPage;

    const filter = {};
    if (source) filter.source = source;
    if (q) filter.title = { $regex: q, $options: "i" };

    const [articles, total, sources] = await Promise.all([
      req.db.collection("articles")
        .find(filter, { projection: { _id: 0, article_id: 1, source: 1, title: 1, url: 1, summary: 1, published: 1, fetched_at: 1 } })
        .sort({ published: -1 })
        .skip(skip)
        .limit(perPage)
        .toArray(),
      req.db.collection("articles").countDocuments(filter),
      req.db.collection("articles").distinct("source"),
    ]);

    res.json({
      articles,
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
      sources: sources.sort(),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

app.get("/articles/:id", async (req, res) => {
  try {
    const article = await req.db.collection("articles").findOne(
      { article_id: req.params.id },
      { projection: { _id: 0 } }
    );
    if (!article) return res.status(404).json({ error: "Article not found" });
    res.json(article);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

app.post("/ingest/trigger", async (req, res) => {
  try {
    const jobId = uuidv4();
    await req.db.collection("jobs").insertOne({
      job_id: jobId,
      status: "running",
      created_at: new Date(),
      completed_at: null,
      message: "",
    });

    const python = process.platform === "win32" ? "python" : "python3";
    const scraper = spawn(python, ["scraper.py"], { cwd: SCRAPER_DIR });
    const cluster = spawn(python, ["cluster.py"], { cwd: SCRAPER_DIR });

    let scraperDone = false;
    let clusterDone = false;

    scraper.on("close", (code) => {
      scraperDone = true;
      if (clusterDone) finalize(true);
    });
    scraper.on("error", () => { scraperDone = true; if (clusterDone) finalize(false); });

    cluster.on("close", (code) => {
      clusterDone = true;
      if (scraperDone) finalize(code === 0);
    });
    cluster.on("error", () => { clusterDone = true; if (scraperDone) finalize(false); });

    let finalized = false;
    function finalize(success) {
      if (finalized) return;
      finalized = true;
      req.db.collection("jobs").updateOne(
        { job_id: jobId },
        {
          $set: {
            status: success ? "completed" : "failed",
            completed_at: new Date(),
            message: success ? "Ingest and clustering finished" : "One or both scripts failed",
          },
        }
      );
    }

    res.status(202).json({ job_id: jobId, status: "running" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to trigger ingest" });
  }
});

app.get("/ingest/status/:jobId", async (req, res) => {
  try {
    const job = await req.db.collection("jobs").findOne(
      { job_id: req.params.jobId },
      { projection: { _id: 0, job_id: 1, status: 1, created_at: 1, completed_at: 1, message: 1 } }
    );
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch job status" });
  }
});



app.listen(PORT, () => {
  console.log(`NewsPulse API running on http://localhost:${PORT}`);
});
