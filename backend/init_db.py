import datetime
import json, os, re
import models, auth
from database import DATA_DIR, SessionLocal, ensure_database_schema
from storage import is_supabase_storage_enabled, upload_public_file
from vocabulary_loader import iter_forecast_vocabulary

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ensure_database_schema()
db = SessionLocal()


def seed_audio_url(filename, content_type="audio/mpeg"):
    path = os.path.join(DATA_DIR, filename)
    if is_supabase_storage_enabled() and os.path.exists(path):
        with open(path, "rb") as f:
            return upload_public_file(f"lesson_audio/{filename}", f.read(), content_type)
    return f"/data/{filename}"

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
    
    db.add(models.Lesson(title="Bài 1: Sở thích", level=1, category="beginner", audio_url=seed_audio_url("audio.mp3"), transcript=" ".join(t1), translation=" ".join(tv1), cloze_data_json=json.dumps(cloze_1, ensure_ascii=False)))

    t2, tv2 = load_json("trans_2.json"), load_json("trans_vi_2.json")
    db.add(models.Lesson(title="Bài 2: Thời tiết", level=2, category="intermediate", audio_url=seed_audio_url("audio_2.mp3"), transcript=" ".join(t2), translation=" ".join(tv2), cloze_data_json="[]"))
    print(" [+] Đổ thành công 2 bài học mẫu vào Database")

for old_url, filename in [("/data/audio.mp3", "audio.mp3"), ("/data/audio_2.mp3", "audio_2.mp3")]:
    lesson = db.query(models.Lesson).filter_by(audio_url=old_url).first()
    if lesson:
        lesson.audio_url = seed_audio_url(filename)

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
