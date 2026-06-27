import hashlib
import os
import re
import time
from datetime import datetime, timezone
from html import unescape

import feedparser
import requests
import trafilatura
from dotenv import load_dotenv

from db import get_db, init_indexes

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

RSS_FEEDS = {
    "BBC News": os.getenv("RSS_BBC", "https://feeds.bbci.co.uk/news/rss.xml"),
    "NPR": os.getenv("RSS_NPR", "https://feeds.npr.org/1001/rss.xml"),
    "The Guardian": os.getenv("RSS_GUARDIAN", "https://www.theguardian.com/world/rss"),
    "Al Jazeera": os.getenv("RSS_ALJAZEERA", "https://www.aljazeera.com/xml/rss/all.xml"),
    "CNN": os.getenv("RSS_CNN", "http://rss.cnn.com/rss/cnn_topstories.rss"),
}

HEADERS = {"User-Agent": "NewsPulse/1.0"}


def article_id(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()


def parse_date(entry):
    for attr in ("published_parsed", "updated_parsed"):
        val = getattr(entry, attr, None)
        if val:
            try:
                return datetime(*val[:6], tzinfo=timezone.utc)
            except (TypeError, ValueError):
                pass
    return None


def normalize_entry(entry, source: str):
    title = (entry.get("title") or "").strip()
    url = (entry.get("link") or "").strip()
    content_value = ""
    if entry.get("content"):
        content_value = entry["content"][0].get("value", "")
    summary = (entry.get("summary") or
               entry.get("description") or
               content_value or "").strip()
    summary = unescape(re.sub(r"<[^>]*>", "", summary)).strip()
    published = parse_date(entry)
    return {
        "article_id": article_id(url),
        "source": source,
        "title": title,
        "url": url,
        "summary": summary,
        "published": published,
    }


def extract_body(url: str) -> str:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        result = trafilatura.extract(resp.text, output_format="txt", include_links=False)
        return (result or "").strip()
    except Exception as e:
        print(f"  [WARN] Body extraction failed: {e}", flush=True)
        return ""


def sync_feeds():
    init_indexes()
    db = get_db()
    total_new = 0
    now = datetime.now(timezone.utc)

    for source, feed_url in RSS_FEEDS.items():
        print(f"\n[{source}] Fetching {feed_url}", flush=True)
        try:
            resp = requests.get(feed_url, headers=HEADERS, timeout=30)
            resp.raise_for_status()
            parsed = feedparser.parse(resp.content)
        except requests.RequestException as e:
            print(f"  [ERR] RSS fetch failed: {e}", flush=True)
            continue

        if not parsed.entries:
            print(f"  [SKIP] No entries for {source}", flush=True)
            continue

        print(f"  {len(parsed.entries)} entries found", flush=True)
        for entry in parsed.entries:
            article = normalize_entry(entry, source)
            if not article["url"] or not article["title"]:
                continue

            body = extract_body(article["url"])
            doc = {
                **article,
                "body": body,
                "fetched_at": now,
            }

            result = db.articles.update_one(
                {"article_id": article["article_id"]},
                {"$setOnInsert": doc},
                upsert=True,
            )
            if result.upserted_id:
                total_new += 1
                print(f"    + {article['title'][:60]}", flush=True)
    print(f"\nDone. {total_new} new articles added.", flush=True)


if __name__ == "__main__":
    sync_feeds()
