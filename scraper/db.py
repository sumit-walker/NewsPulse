import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

_client = None


def get_db():
    global _client
    if _client is None:
        uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        db_name = os.getenv("MONGODB_DB", "newspulse")
        _client = MongoClient(uri)
        return _client[db_name]
    return _client.get_database(os.getenv("MONGODB_DB", "newspulse"))


def init_indexes():
    db = get_db()
    db.articles.create_index("article_id", unique=True)
    db.articles.create_index("source")
    db.articles.create_index("published")
    db.clusters.create_index("cluster_id")
    db.clusters.create_index("article_ids")
    db.jobs.create_index("status")
