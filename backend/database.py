import os
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

import models

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
DATA_DIR = os.path.join(ROOT_DIR, "data")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
AVATAR_DIR = os.path.join(DATA_DIR, "profile_avatars")
VOCABULARY_IMAGE_DIR = os.path.join(DATA_DIR, "vocabulary_images")


def load_env_file():
    env_path = os.path.join(ROOT_DIR, ".env")
    if not os.path.exists(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env_file()
try:
    os.makedirs(AVATAR_DIR, exist_ok=True)
    os.makedirs(VOCABULARY_IMAGE_DIR, exist_ok=True)
except OSError:
    pass  # Read-only filesystem on serverless platforms

db_url = os.environ.get("DATABASE_URL")
if db_url:
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    engine = create_engine(db_url)
else:
    db_path = os.path.join(BASE_DIR, "hanlingua.db")
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _existing_columns(conn, table_name):
    if conn.dialect.name == "sqlite":
        return {row[1] for row in conn.execute(text(f"PRAGMA table_info({table_name})"))}
    return {column["name"] for column in inspect(conn).get_columns(table_name)}


def _add_missing_column(conn, table_name, existing_columns, column_name, sqlite_definition, postgres_definition=None):
    if column_name in existing_columns:
        return
    definition = sqlite_definition if conn.dialect.name == "sqlite" else (postgres_definition or sqlite_definition)
    conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {definition}"))
    existing_columns.add(column_name)


def ensure_database_schema():
    models.Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        user_columns = _existing_columns(conn, "users")
        _add_missing_column(conn, "users", user_columns, "created_at", "created_at DATETIME", "created_at TIMESTAMP")
        _add_missing_column(conn, "users", user_columns, "approved_at", "approved_at DATETIME", "approved_at TIMESTAMP")
        _add_missing_column(conn, "users", user_columns, "account_status", "account_status VARCHAR DEFAULT 'approved'")
        _add_missing_column(conn, "users", user_columns, "avatar_url", "avatar_url VARCHAR")
        _add_missing_column(conn, "users", user_columns, "trial_expires_at", "trial_expires_at DATETIME", "trial_expires_at TIMESTAMP")

        lesson_columns = _existing_columns(conn, "lessons")
        _add_missing_column(conn, "lessons", lesson_columns, "category", "category VARCHAR DEFAULT 'beginner'")

        progress_columns = _existing_columns(conn, "user_progress")
        _add_missing_column(conn, "user_progress", progress_columns, "feedback_json", "feedback_json TEXT")
        _add_missing_column(conn, "user_progress", progress_columns, "mistake_tags", "mistake_tags TEXT")
        _add_missing_column(conn, "user_progress", progress_columns, "content_type", "content_type VARCHAR DEFAULT 'dictation'")

        vocabulary_columns = _existing_columns(conn, "vocabulary")
        _add_missing_column(conn, "vocabulary", vocabulary_columns, "image_url", "image_url VARCHAR")
