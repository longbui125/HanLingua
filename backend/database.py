import os
from sqlalchemy import create_engine, text
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


def ensure_database_schema():
    models.Base.metadata.create_all(bind=engine)
    if engine.dialect.name != "sqlite":
        return
    with engine.begin() as conn:
        user_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
        if "avatar_url" not in user_columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR"))
        progress_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(user_progress)"))}
        if "feedback_json" not in progress_columns:
            conn.execute(text("ALTER TABLE user_progress ADD COLUMN feedback_json TEXT"))
        if "mistake_tags" not in progress_columns:
            conn.execute(text("ALTER TABLE user_progress ADD COLUMN mistake_tags TEXT"))
        if "content_type" not in progress_columns:
            conn.execute(text("ALTER TABLE user_progress ADD COLUMN content_type VARCHAR DEFAULT 'dictation'"))
        vocabulary_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(vocabulary)"))}
        if "image_url" not in vocabulary_columns:
            conn.execute(text("ALTER TABLE vocabulary ADD COLUMN image_url VARCHAR"))
