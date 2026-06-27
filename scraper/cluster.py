import hashlib
import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone
from itertools import combinations

from dotenv import load_dotenv

from db import get_db, init_indexes

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "shall", "can", "it", "its", "that",
    "this", "these", "those", "what", "which", "who", "whom", "when",
    "where", "why", "how", "not", "no", "nor", "so", "if", "than", "too",
    "very", "just", "about", "up", "down", "out", "off", "over", "under",
    "again", "further", "then", "once", "here", "there", "all", "each",
    "every", "both", "few", "more", "most", "other", "some", "such", "only",
    "own", "same", "into", "onto", "upon", "after", "before", "between",
    "through", "during", "above", "below", "new", "says", "say", "said",
    "one", "two", "three", "get", "gets", "got", "make", "makes", "made",
    "like", "also", "back", "first", "last", "over", "still", "even",
    "much", "well", "way", "year", "years", "time",
}


def tokenize(text: str):
    text = text.lower()
    tokens = re.findall(r"[a-z]{3,}", text)
    return [t for t in tokens if t not in STOPWORDS]


def cluster_articles(min_shared=2):
    init_indexes()
    db = get_db()
    now = datetime.now(timezone.utc)

    articles = list(db.articles.find(
        {"title": {"$ne": ""}},
        {"article_id": 1, "title": 1, "published": 1, "_id": 0}
    ).sort("published", -1))

    if not articles:
        print("No articles to cluster.")
        return

    article_keywords = {}
    for a in articles:
        kw = tokenize(a["title"])
        if kw:
            article_keywords[a["article_id"]] = {
                "keywords": set(kw),
                "published": a.get("published"),
            }

    article_ids = list(article_keywords.keys())
    adj = defaultdict(set)
    for a, b in combinations(article_ids, 2):
        shared = article_keywords[a]["keywords"] & article_keywords[b]["keywords"]
        if len(shared) >= min_shared:
            adj[a].add(b)
            adj[b].add(a)

    visited = set()
    cluster_groups = []
    for aid in article_ids:
        if aid in visited:
            continue
        stack = [aid]
        members = []
        while stack:
            node = stack.pop()
            if node in visited:
                continue
            visited.add(node)
            members.append(node)
            stack.extend(adj[node] - visited)
        cluster_groups.append(members)

    db.clusters.delete_many({})
    db.articles.update_many({}, {"$unset": {"cluster_id": ""}})

    cluster_count = 0
    for members in cluster_groups:
        if len(members) < 2:
            continue
        cid = hashlib.md5("".join(sorted(members)).encode()).hexdigest()
        all_kw = Counter()
        times = []
        for mid in members:
            all_kw.update(article_keywords[mid]["keywords"])
            pub = article_keywords[mid].get("published")
            if pub:
                times.append(pub)
        topic = all_kw.most_common(1)[0][0]
        top_keywords = [kw for kw, _ in all_kw.most_common(10)]

        cluster_doc = {
            "cluster_id": cid,
            "label": topic,
            "keywords": top_keywords,
            "article_ids": members,
            "article_count": len(members),
            "time_start": min(times) if times else None,
            "time_end": max(times) if times else None,
            "created_at": now,
        }
        db.clusters.insert_one(cluster_doc)
        db.articles.update_many(
            {"article_id": {"$in": members}},
            {"$set": {"cluster_id": cid}}
        )
        cluster_count += 1
        print(f"  Cluster [{topic}]: {len(members)} articles (keywords: {', '.join(top_keywords[:5])})")

    print(f"\nClustering done. {cluster_count} clusters formed.")


if __name__ == "__main__":
    min_shared = int(os.getenv("CLUSTER_MIN_SHARED_WORDS", "2"))
    cluster_articles(min_shared)
