import datetime
import json, os, re
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker
import models, auth
from database import DATA_DIR, engine, ensure_database_schema
from vocabulary_loader import iter_forecast_vocabulary

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
models.Base.metadata.create_all(bind=engine)
ensure_database_schema()

if engine.dialect.name == "sqlite":
  with engine.begin() as conn:
    user_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(users)"))}
    if "created_at" not in user_columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN created_at DATETIME"))
    if "approved_at" not in user_columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN approved_at DATETIME"))
    if "account_status" not in user_columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN account_status VARCHAR DEFAULT 'approved'"))
    if "avatar_url" not in user_columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN avatar_url VARCHAR"))
    if "trial_expires_at" not in user_columns:
        conn.execute(text("ALTER TABLE users ADD COLUMN trial_expires_at DATETIME"))
    lesson_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(lessons)"))}
    if "category" not in lesson_columns:
        conn.execute(text("ALTER TABLE lessons ADD COLUMN category VARCHAR DEFAULT 'beginner'"))
    progress_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(user_progress)"))}
    if "feedback_json" not in progress_columns:
        conn.execute(text("ALTER TABLE user_progress ADD COLUMN feedback_json TEXT"))
    if "mistake_tags" not in progress_columns:
        conn.execute(text("ALTER TABLE user_progress ADD COLUMN mistake_tags TEXT"))
    if "content_type" not in progress_columns:
        conn.execute(text("ALTER TABLE user_progress ADD COLUMN content_type VARCHAR DEFAULT 'dictation'"))
    models.Payment.__table__.create(bind=conn, checkfirst=True)
    models.Vocabulary.__table__.create(bind=conn, checkfirst=True)
    vocabulary_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(vocabulary)"))}
    if "image_url" not in vocabulary_columns:
        conn.execute(text("ALTER TABLE vocabulary ADD COLUMN image_url VARCHAR"))

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

print("--- ĐANG KHỞI TẠO HỆ THỐNG HANLINGUA ---")

if not db.query(models.User).filter_by(username="admin").first():
    db.add(models.User(username="admin", hashed_password=auth.get_password_hash("123456"), role="admin", account_status="approved", approved_at=datetime.datetime.utcnow()))
    print(" [+] Tạo thành công Admin (admin / 123456)")

if not db.query(models.User).filter_by(username="user").first():
    db.add(models.User(username="user", hashed_password=auth.get_password_hash("123456"), role="user", account_status="approved", approved_at=datetime.datetime.utcnow(), trial_expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=5)))
    print(" [+] Tạo thành công User thường (user / 123456)")

if not db.query(models.User).filter_by(username="manager").first():
    db.add(models.User(username="manager", hashed_password=auth.get_password_hash("123456"), role="manager", account_status="approved", approved_at=datetime.datetime.utcnow(), trial_expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=3650)))
    print(" [+] Tạo thành công Quản lý người dùng (manager / 123456)")

now = datetime.datetime.utcnow()
for existing_user in db.query(models.User).all():
    if existing_user.created_at is None:
        existing_user.created_at = now
    if existing_user.account_status is None:
        existing_user.account_status = "approved"
    if existing_user.account_status == "approved" and existing_user.approved_at is None:
        existing_user.approved_at = existing_user.created_at or now
    if existing_user.role != "admin" and existing_user.trial_expires_at is None:
        existing_user.trial_expires_at = now + datetime.timedelta(days=5)

if not db.query(models.Lesson).first():
    def load_json(filename):
        path = os.path.join(DATA_DIR, filename)
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f: return json.load(f)
        return []

    t1, tv1 = load_json("trans.json"), load_json("trans_vi.json")
    cloze_1 = []
    for sentence in t1:
        words = sentence.split()
        struct = [{"word": w, "is_blank": (len(re.sub(r'[.,!?~]+', '', w)) > 1 and (i+1)%3==0)} for i, w in enumerate(words)]
        cloze_1.append(struct)
    
    db.add(models.Lesson(title="Bài 1: Sở thích", level=1, category="beginner", audio_url="/data/audio.mp3", transcript=" ".join(t1), translation=" ".join(tv1), cloze_data_json=json.dumps(cloze_1, ensure_ascii=False)))

    t2, tv2 = load_json("trans_2.json"), load_json("trans_vi_2.json")
    db.add(models.Lesson(title="Bài 2: Thời tiết", level=2, category="intermediate", audio_url="/data/audio_2.mp3", transcript=" ".join(t2), translation=" ".join(tv2), cloze_data_json="[]"))
    print(" [+] Đổ thành công 2 bài học mẫu vào Database")

if not db.query(models.Vocabulary).first():
    count = 0
    for item in iter_forecast_vocabulary(DATA_DIR) or []:
        db.add(models.Vocabulary(**item, created_by="system"))
        count += 1
    if count:
        print(f" [+] Đổ thành công {count} từ vựng Forecast TOPIK vào Database")

db.commit()
db.close()
print("--- HOÀN TẤT! HỆ THỐNG ĐÃ SẴN SÀNG ---")
