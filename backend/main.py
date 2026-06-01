import datetime
import os, json, base64, shutil, re, subprocess, tempfile
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from fastapi.security import OAuth2PasswordRequestForm

import models, auth
from database import DATA_DIR, FRONTEND_DIR, AVATAR_DIR, VOCABULARY_IMAGE_DIR, SessionLocal, get_db, ensure_database_schema
from dictation import evaluate_dictation
from engine import generate_transcript_json
from vocabulary_loader import iter_forecast_vocabulary
from schemas import *
from services import get_trial_status, grant_learning_access, plan_to_days, require_active_trial, require_admin, require_approved_user, require_operator
from storage import delete_public_file, is_supabase_storage_enabled, upload_public_file
from routers.vocabulary import router as vocabulary_router

try:
    import yt_dlp
    HAS_YTDLP = True
except ImportError:
    HAS_YTDLP = False

AI_MEDIA_EXTENSIONS = {
    ".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac",
    ".mp4", ".webm", ".mov", ".mkv", ".avi", ".m4v",
}


def convert_media_to_mp3(input_path: str) -> str:
    output_file = tempfile.NamedTemporaryFile(prefix="hanlingua_ai_", suffix=".mp3", delete=False)
    output_path = output_file.name
    output_file.close()
    command = [
        "ffmpeg",
        "-y",
        "-i", input_path,
        "-vn",
        "-ac", "1",
        "-ar", "16000",
        "-codec:a", "libmp3lame",
        "-b:a", "128k",
        output_path,
    ]
    try:
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=240)
    except FileNotFoundError as exc:
        if os.path.exists(output_path):
            os.remove(output_path)
        raise RuntimeError("FFmpeg chưa được cài trên server nên chưa thể tách audio từ video.") from exc
    except subprocess.TimeoutExpired as exc:
        if os.path.exists(output_path):
            os.remove(output_path)
        raise RuntimeError("File quá dài hoặc xử lý quá lâu. Hãy thử video/audio ngắn hơn.") from exc

    if result.returncode != 0 or not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
        if os.path.exists(output_path):
            os.remove(output_path)
        stderr_tail = "\n".join((result.stderr or result.stdout or "").strip().splitlines()[-3:])
        detail = f" Chi tiết: {stderr_tail}" if stderr_tail else ""
        raise RuntimeError(f"Không thể tách audio từ file này. Hãy kiểm tra video có âm thanh và không bị lỗi.{detail}")

    return output_path


# CORS: allow frontend origin from env, defaults to allow all.
def parse_cors_origins():
    origins = [
        origin.strip().rstrip("/")
        for origin in os.environ.get("CORS_ORIGINS", "*").split(",")
        if origin.strip()
    ]
    return origins or ["*"]


CORS_ORIGINS = parse_cors_origins()

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
app.include_router(vocabulary_router)

ensure_database_schema()

DAILY_MESSAGES = [
    "Mỗi ngày nghe 10 phút tiếng Hàn sẽ tạo phản xạ tốt hơn một buổi học dồn 2 tiếng.",
    "Đừng cố nghe từng chữ ngay từ đầu. Hãy bắt nhịp, đoán ý, rồi nghe lại để lấp khoảng trống.",
    "Một câu nghe sai hôm nay là một tín hiệu để tai bạn tiến bộ ngày mai.",
    "Học tiếng Hàn là tích lũy. Một bài dictation nhỏ mỗi ngày sẽ tạo khác biệt rất lớn sau 30 ngày.",
    "Hãy đọc to transcript sau khi nghe chép. Não sẽ ghi nhớ âm, chữ và nhịp nói cùng lúc.",
    "Bạn không cần hoàn hảo. Bạn chỉ cần đều đặn hơn chính mình của hôm qua.",
]

DAILY_MEDIA = [
    {
        "type": "music",
        "title": "Korean Study Playlist - Nhạc nhẹ khi học",
        "source": "YouTube",
        "url": "https://www.youtube.com/results?search_query=korean+study+playlist",
        "description": "Gợi ý nhạc nền nhẹ giúp vào trạng thái học tập trước khi luyện nghe.",
    },
    {
        "type": "podcast",
        "title": "Talk To Me In Korean - Podcast luyện nghe",
        "source": "YouTube",
        "url": "https://www.youtube.com/@talktomeinkorean",
        "description": "Nguồn podcast/luyện nghe tiếng Hàn phổ biến, phù hợp tạo thói quen nghe mỗi ngày.",
    },
    {
        "type": "music",
        "title": "Korean Ballad Playlist",
        "source": "YouTube",
        "url": "https://www.youtube.com/results?search_query=korean+ballad+playlist",
        "description": "Nhạc Hàn chậm, rõ nhịp, phù hợp nghe thư giãn và bắt âm.",
    },
    {
        "type": "podcast",
        "title": "Easy Korean Listening",
        "source": "YouTube",
        "url": "https://www.youtube.com/results?search_query=easy+korean+listening+podcast",
        "description": "Gợi ý các bài nghe ngắn cho người mới và trung cấp.",
    },
]

KOREAN_PLAYLIST = [
    {"title": "Korean Study Music", "mood": "Tập trung", "url": "https://www.youtube.com/results?search_query=korean+study+music"},
    {"title": "Korean Acoustic Playlist", "mood": "Nhẹ nhàng", "url": "https://www.youtube.com/results?search_query=korean+acoustic+playlist"},
    {"title": "Korean Ballad Playlist", "mood": "Chậm và rõ", "url": "https://www.youtube.com/results?search_query=korean+ballad+playlist"},
    {"title": "Korean Indie Playlist", "mood": "Thư giãn", "url": "https://www.youtube.com/results?search_query=korean+indie+playlist"},
    {"title": "Korean Cafe Music", "mood": "Cafe học tập", "url": "https://www.youtube.com/results?search_query=korean+cafe+music"},
    {"title": "Korean Podcast for Beginners", "mood": "Luyện nghe", "url": "https://www.youtube.com/results?search_query=korean+podcast+for+beginners"},
]

def normalize_lesson_category(category: Optional[str], level: Optional[int] = None):
    allowed = {"beginner", "intermediate"}
    if category in allowed:
        return category
    if level == 2:
        return "intermediate"
    return "beginner"

def get_learning_stage(day_number: int):
    if day_number <= 30:
        return "Người mới học tiếng Hàn"
    if day_number <= 90:
        return "Sơ cấp"
    if day_number <= 180:
        return "Trung cấp"
    return "Nâng cao"

def month_key(dt: datetime.datetime):
    return dt.strftime("%Y-%m")

def build_progress_summary(user: models.User):
    now = datetime.datetime.utcnow()
    start_at = user.approved_at or user.created_at or now
    learning_day = max(1, (now.date() - start_at.date()).days + 1)
    progress_items = sorted(user.progress or [], key=lambda p: p.created_at or datetime.datetime.min)
    scores = [p.score for p in progress_items if p.score is not None]
    active_dates = {p.created_at.date().isoformat() for p in progress_items if p.created_at}
    date_objects = {p.created_at.date() for p in progress_items if p.created_at}
    streak = 0
    cursor = now.date()
    while cursor in date_objects:
        streak += 1
        cursor -= datetime.timedelta(days=1)
    if streak == 0 and date_objects and (now.date() - max(date_objects)).days == 1:
        cursor = max(date_objects)
        while cursor in date_objects:
            streak += 1
            cursor -= datetime.timedelta(days=1)

    dictation_items = [p for p in progress_items if p.lesson_id is not None]
    recent_items = list(reversed(progress_items))[:8]
    recent_activities = []
    for item in recent_items:
        activity_type = "Dictation"
        title = item.lesson.title if item.lesson else "Bài học đã xóa"
        recent_activities.append({
            "title": title,
            "type": activity_type,
            "score": round(item.score, 1) if item.score is not None else 0,
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "lesson_id": item.lesson_id,
        })
    monthly = {}
    for item in progress_items:
        if not item.created_at:
            continue
        key = month_key(item.created_at)
        monthly.setdefault(key, {"month": key, "attempts": 0, "active_days": set(), "scores": []})
        monthly[key]["attempts"] += 1
        monthly[key]["active_days"].add(item.created_at.date().isoformat())
        if item.score is not None:
            monthly[key]["scores"].append(item.score)

    monthly_rows = []
    for item in sorted(monthly.values(), key=lambda x: x["month"]):
        item_scores = item["scores"]
        monthly_rows.append({
            "month": item["month"],
            "attempts": item["attempts"],
            "active_days": len(item["active_days"]),
            "avg_score": round(sum(item_scores) / len(item_scores), 1) if item_scores else 0,
        })

    return {
        "learning_day": learning_day,
        "stage": get_learning_stage(learning_day),
        "total_attempts": len(progress_items),
        "dictation_completed": len(dictation_items),
        "speaking_completed": 0,
        "streak_days": streak,
        "total_study_minutes": len(progress_items) * 10,
        "active_days": len(active_dates),
        "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
        "dictation_avg": round(sum(p.score for p in dictation_items if p.score is not None) / len([p for p in dictation_items if p.score is not None]), 1) if [p for p in dictation_items if p.score is not None] else 0,
        "speaking_avg": 0,
        "last_activity": recent_activities[0] if recent_activities else None,
        "recent_activities": recent_activities,
        "monthly": monthly_rows,
    }

def get_ytdlp_audio_options(output_template: str):
    return {
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "outtmpl": output_template,
        "noplaylist": True,
        "retries": 5,
        "fragment_retries": 5,
        "http_headers": {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        },
        "extractor_args": {
            "youtube": {"player_client": ["android", "web"]},
        },
        "postprocessors": [{"key": "FFmpegExtractAudio", "preferredcodec": "m4a"}],
    }

def username_suggestions(db: Session, username: str, limit: int = 3):
    base = re.sub(r"[^a-zA-Z0-9_]", "", username.strip()) or "hanlingua"
    suggestions = []
    for suffix in ["01", "123", "2026", "_kr", "_han", "_study"]:
        candidate = f"{base}{suffix}"
        if not db.query(models.User).filter_by(username=candidate).first():
            suggestions.append(candidate)
        if len(suggestions) >= limit:
            break
    return suggestions

HANGUL_BASE = 0xAC00
HANGUL_END = 0xD7A3
CHOSEONG = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]
JONGSEONG = ["", "ㄱ", "ㄲ", "ㄳ", "ㄴ", "ㄵ", "ㄶ", "ㄷ", "ㄹ", "ㄺ", "ㄻ", "ㄼ", "ㄽ", "ㄾ", "ㄿ", "ㅀ", "ㅁ", "ㅂ", "ㅄ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ"]

def decompose_hangul(char: str):
    code = ord(char)
    if code < HANGUL_BASE or code > HANGUL_END:
        return None
    offset = code - HANGUL_BASE
    return {
        "initial": CHOSEONG[offset // 588],
        "final": JONGSEONG[offset % 28],
    }

def clean_korean_word(word: str):
    return re.sub(r"[^가-힣]", "", word or "")

def detect_dictation_mistake_tags(correct: str, user_word: str):
    correct_clean = clean_korean_word(correct)
    user_clean = clean_korean_word(user_word)
    tags = []
    if not correct_clean or not user_clean or correct_clean == user_clean:
        return tags

    for i in range(len(correct_clean) - 1):
        current = decompose_hangul(correct_clean[i])
        nxt = decompose_hangul(correct_clean[i + 1])
        if not current or not nxt:
            continue
        if current["final"] in {"ㄱ", "ㄷ", "ㅂ"} and nxt["initial"] in {"ㄴ", "ㅁ"}:
            tags.append("비음화")
        if current["final"] and nxt["initial"] == "ㅇ":
            tags.append("연음")
    if len(correct_clean) != len(user_clean):
        tags.append("누락/추가")
    return list(dict.fromkeys(tags)) or ["맞춤법/받아쓰기"]

def extract_dictation_mistakes(feedback: list):
    mistakes = []
    for index, item in enumerate(feedback or []):
        if item.get("status") != "wrong_user":
            continue
        next_item = feedback[index + 1] if index + 1 < len(feedback) else None
        correct = next_item.get("word") if next_item and next_item.get("status") == "hint" else ""
        tags = detect_dictation_mistake_tags(correct, item.get("word", ""))
        mistakes.append({"user": item.get("word", ""), "correct": correct, "tags": tags})
    return mistakes

def infer_content_type(lesson: Optional[models.Lesson], target_text: str = ""):
    text_value = f"{lesson.title if lesson else ''} {target_text}".lower()
    if any(key in text_value for key in ["k-pop", "kpop", "bài hát", "music", "iu", "playlist", "ballad"]):
        return "kpop"
    if any(key in text_value for key in ["news", "bản tin", "kbs", "thời sự"]):
        return "news"
    return "dictation"

def build_learning_forecast(user: models.User, db: Session):
    progress_items = sorted(user.progress or [], key=lambda p: p.created_at or datetime.datetime.min, reverse=True)
    recent = progress_items[:20]
    tag_counts = {}
    weak_words = []
    for item in recent:
        for mistake in json.loads(item.feedback_json or "[]"):
            if mistake.get("correct"):
                weak_words.append(mistake["correct"])
            for tag in mistake.get("tags", []):
                tag_counts[tag] = tag_counts.get(tag, 0) + 1
    top_tag = max(tag_counts, key=tag_counts.get) if tag_counts else None
    kpop_done = len([p for p in recent if p.content_type == "kpop" and (p.score or 0) >= 75])
    avg_score = round(sum(p.score for p in recent if p.score is not None) / len([p for p in recent if p.score is not None]), 1) if [p for p in recent if p.score is not None] else 0
    review_count = min(50, max(5, len(set(weak_words)) or db.query(models.Vocabulary).count() // 12 or 5))

    if top_tag == "비음화":
        mistake_message = "Tuần sau bạn cần 1 bài luyện chuyên sâu về biến âm mũi (비음화), vì các lỗi kiểu 국물 -> 궁물/쿵물 đang lặp lại."
    elif top_tag == "연음":
        mistake_message = "Tuần sau bạn cần 1 bài luyện chuyên sâu về nối âm (연음), vì bạn hay bỏ qua âm cuối khi nghe chép."
    elif top_tag:
        mistake_message = f"Tuần sau nên có 1 phiên sửa lỗi {top_tag}, vì nhóm lỗi này xuất hiện nhiều nhất trong các bài gần đây."
    else:
        mistake_message = "Chưa đủ lỗi lặp lại để dự báo chuyên sâu. Hãy hoàn thành thêm 2-3 bài Dictation để hệ thống nhận diện mẫu lỗi."

    content_message = "Dựa trên tiến độ hiện tại, hãy thử 1 bài Dictation trung cấp có tốc độ nhanh hơn trong 3 ngày tới."
    if kpop_done >= 2:
        content_message = "Bạn đang làm tốt với nội dung K-Pop. 3 ngày nữa có thể thử thách với một bài hát tốc độ nhanh hơn của IU."

    learning_day = build_progress_summary(user)["learning_day"]
    days_to_topik = max(14, 60 - min(45, learning_day // 2 + int(avg_score // 5)))
    return {
        "review_count": review_count,
        "review_topic": "Giao tiếp công sở" if review_count >= 20 else "Từ vựng lỗi sai gần đây",
        "suggested_lesson": content_message,
        "mistake_forecast": {"tag": top_tag, "message": mistake_message, "counts": tag_counts},
        "content_forecast": {"message": content_message, "kpop_completed": kpop_done},
        "weekly_insight": {
            "avg_score": avg_score,
            "daily_minutes": 15,
            "days_to_topik": days_to_topik,
            "message": f"Nếu tiếp tục giữ phong độ chép chính tả 15 phút/ngày, bạn sẽ tiến gần mục tiêu nghe hiểu TOPIK II sau khoảng {days_to_topik} ngày nữa."
        },
        "notification": f"Dự báo hôm nay {review_count} từ vựng về chủ đề '{'Giao tiếp công sở' if review_count >= 20 else 'lỗi sai gần đây'}' đã đến hạn kiểm tra. Khám phá ngay để không bị quên mất 80% công sức nhé!"
    }

def seed_forecast_vocabulary(db: Session):
    if db.query(models.Vocabulary).first():
        return
    for item in iter_forecast_vocabulary(DATA_DIR) or []:
        db.add(models.Vocabulary(**item, created_by="system"))
    db.commit()

with SessionLocal() as seed_db:
    seed_forecast_vocabulary(seed_db)

@app.post("/api/auth/register")
def register(user: UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter_by(username=user.username).first():
        raise HTTPException(status_code=400, detail={"message": "Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.", "suggestions": username_suggestions(db, user.username)})
    approved_at = datetime.datetime.utcnow()
    new_user = models.User(
        username=user.username,
        hashed_password=auth.get_password_hash(user.password),
        role="user",
        account_status="approved",
        approved_at=approved_at,
        trial_expires_at=approved_at + datetime.timedelta(days=5),
    )
    db.add(new_user); db.commit()
    return {"msg": "Tài khoản đã sẵn sàng. Bạn có 5 ngày dùng thử."}

@app.post("/api/auth/login")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(username=form_data.username).first()
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Sai tài khoản/mật khẩu")
    if user.account_status == "pending":
        raise HTTPException(status_code=403, detail="Tài khoản của bạn đang chờ admin phê duyệt.")
    if user.account_status in {"rejected", "locked"}:
        raise HTTPException(status_code=403, detail="Tài khoản của bạn đã bị từ chối hoặc bị khóa.")
    return {"access_token": auth.create_access_token({"sub": user.username}), "token_type": "bearer", "role": user.role}

@app.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(username=req.username.strip()).first()
    if not user:
        return {"msg": "Nếu tài khoản tồn tại, vui lòng liên hệ admin/manager để xác minh và đặt lại mật khẩu."}
    return {"msg": "Yêu cầu quên mật khẩu đã được ghi nhận. Vui lòng liên hệ admin/manager để xác minh trước khi đặt lại mật khẩu."}

@app.get("/api/auth/me")
def read_me(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    has_paid_access = db.query(models.Payment).filter(
        models.Payment.user_id == current_user.id,
        models.Payment.status.in_(["success", "unlocked"]),
    ).first() is not None
    is_pro = current_user.role in {"admin", "manager"} or has_paid_access
    return {
        "username": current_user.username,
        "role": current_user.role,
        "is_pro": is_pro,
        "avatar_url": current_user.avatar_url,
        "account_status": current_user.account_status,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        "approved_at": current_user.approved_at.isoformat() if current_user.approved_at else None,
        **get_trial_status(current_user),
    }

@app.put("/api/auth/me/profile")
def update_my_profile(req: AccountProfileUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    username = req.username.strip()
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Tên tài khoản cần ít nhất 3 ký tự")
    if not auth.verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")
    existing = db.query(models.User).filter(models.User.username == username, models.User.id != current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail={"message": "Tên tài khoản đã tồn tại. Vui lòng chọn tên khác.", "suggestions": username_suggestions(db, username)})
    user = db.query(models.User).filter_by(id=current_user.id).first()
    user.username = username
    db.commit()
    return {"msg": "Đã cập nhật tên tài khoản", "access_token": auth.create_access_token({"sub": user.username})}

@app.put("/api/auth/me/avatar")
async def update_my_avatar(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    allowed_types = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ JPG, PNG hoặc WEBP")
    content = await file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ảnh tối đa 2MB")
    ext = allowed_types[file.content_type]
    filename = f"user_{current_user.id}{ext}"
    if is_supabase_storage_enabled():
        avatar_url = upload_public_file(f"profile_avatars/{filename}", content, file.content_type)
    else:
        file_path = os.path.join(AVATAR_DIR, filename)
        with open(file_path, "wb") as f:
            f.write(content)
        avatar_url = f"/data/profile_avatars/{filename}"
    user = db.query(models.User).filter_by(id=current_user.id).first()
    user.avatar_url = avatar_url
    db.commit()
    return {"msg": "Đã cập nhật ảnh đại diện", "avatar_url": user.avatar_url}

@app.delete("/api/auth/me/avatar")
def delete_my_avatar(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    user = db.query(models.User).filter_by(id=current_user.id).first()
    if user and user.avatar_url:
        if is_supabase_storage_enabled() and user.avatar_url.startswith("http"):
            delete_public_file(user.avatar_url)
        else:
            filename = os.path.basename(user.avatar_url)
            file_path = os.path.join(AVATAR_DIR, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
        user.avatar_url = None
        db.commit()
    return {"msg": "Đã gỡ ảnh đại diện", "avatar_url": None}

@app.put("/api/auth/me/password")
def update_my_password(req: PasswordUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Mật khẩu mới cần ít nhất 6 ký tự")
    if not auth.verify_password(req.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng")
    user = db.query(models.User).filter_by(id=current_user.id).first()
    user.hashed_password = auth.get_password_hash(req.new_password)
    db.commit()
    return {"msg": "Đã đổi mật khẩu"}

@app.get("/api/daily-content")
def daily_content():
    today = datetime.datetime.utcnow().date()
    day_index = today.toordinal()
    return {
        "date": today.isoformat(),
        "message": DAILY_MESSAGES[day_index % len(DAILY_MESSAGES)],
        "media": DAILY_MEDIA[day_index % len(DAILY_MEDIA)],
        "playlist": KOREAN_PLAYLIST,
    }

@app.get("/api/me/progress")
def my_progress(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_approved_user(current_user)
    user = db.query(models.User).filter_by(id=current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    return build_progress_summary(user)

@app.get("/api/me/forecast")
def my_learning_forecast(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_approved_user(current_user)
    user = db.query(models.User).filter_by(id=current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    return build_learning_forecast(user, db)

@app.get("/api/lessons/list", response_model=List[LessonSchema])
def get_all_lessons(db: Session = Depends(get_db)):
    return db.query(models.Lesson).all()

@app.get("/api/lessons/{lesson_id}")
def get_lesson(lesson_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_active_trial(current_user)
    lesson = db.query(models.Lesson).filter_by(id=lesson_id).first()
    if not lesson: raise HTTPException(status_code=404, detail="Không tìm thấy bài")
    return {
        "id": lesson.id, "title": lesson.title, "level": lesson.level,
        "category": normalize_lesson_category(lesson.category, lesson.level),
        "transcript": lesson.transcript, "translation": lesson.translation,
        "cloze_data": json.loads(lesson.cloze_data_json) if lesson.cloze_data_json else [],
        "audio_src": lesson.audio_url
    }

# Vocabulary routes live in routers/vocabulary.py

@app.post("/api/evaluate")
def evaluate(req: EvalRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_active_trial(current_user)
    res = evaluate_dictation(req.target_text, req.user_text)
    mistakes = extract_dictation_mistakes(res.get("feedback", []))
    res["mistakes"] = mistakes
    lesson = db.query(models.Lesson).filter_by(id=req.lesson_id).first() if req.lesson_id else None
    if req.lesson_id:
        db.add(models.UserProgress(
            user_id=current_user.id,
            lesson_id=req.lesson_id,
            score=res["score_percent"],
            feedback_json=json.dumps(mistakes, ensure_ascii=False),
            mistake_tags=json.dumps([tag for item in mistakes for tag in item.get("tags", [])], ensure_ascii=False),
            content_type=infer_content_type(lesson, req.target_text),
        ))
        db.commit()
    return res

@app.post("/api/evaluate-cloze")
def evaluate_cloze(req: ClozeEvalRequest, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_active_trial(current_user)
    lesson = db.query(models.Lesson).filter_by(id=req.lesson_id).first()
    if not lesson: raise HTTPException(status_code=404, detail="Không tìm thấy bài")
    correct_answers = []
    for row in json.loads(lesson.cloze_data_json):
        for item in row:
            if item["is_blank"]: correct_answers.append(re.sub(r'[.,!?~]+', '', item["word"]))
    score, feedback = 0, []
    for i, correct in enumerate(correct_answers):
        u_ans = req.cloze_answers[i].strip() if i < len(req.cloze_answers) else ""
        is_match = u_ans.lower() == correct.lower()
        if is_match: score += 1
        feedback.append({"word": u_ans or "___", "correct": correct, "status": "correct" if is_match else "wrong"})
    perc = int((score / len(correct_answers))*100) if correct_answers else 0
    db.add(models.UserProgress(user_id=current_user.id, lesson_id=req.lesson_id, score=perc, content_type="cloze"))
    db.commit()
    return {"score_percent": perc, "feedback": feedback, "is_cloze": True}

@app.post("/api/process-ai")
async def process_ai(file: UploadFile = File(...), current_user: models.User = Depends(auth.get_current_user)):
    require_active_trial(current_user)
    ext = os.path.splitext(file.filename or "")[1].lower() or ".mp3"
    if ext not in AI_MEDIA_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Định dạng file chưa hỗ trợ. Hãy dùng audio/video như mp3, wav, m4a, mp4, webm hoặc mov.")

    temp_file = tempfile.NamedTemporaryFile(prefix="hanlingua_upload_", suffix=ext, delete=False)
    temp_path = temp_file.name
    temp_file.close()
    prepared_audio_path = None
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        prepared_audio_path = temp_path if ext == ".mp3" else convert_media_to_mp3(temp_path)
        transcript = generate_transcript_json(prepared_audio_path)
        if not transcript:
            raise HTTPException(status_code=502, detail="Whisper không trả về transcript. Hãy thử file audio rõ hơn hoặc ngắn hơn.")
        with open(prepared_audio_path, "rb") as f:
            audio_b64 = base64.b64encode(f.read()).decode()
        return {"transcript": " ".join(transcript), "audio_b64": audio_b64, "audio_mime": "audio/mpeg"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Lỗi phân tích audio bằng Whisper: {exc}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        if prepared_audio_path and prepared_audio_path != temp_path and os.path.exists(prepared_audio_path):
            os.remove(prepared_audio_path)

@app.post("/api/process-youtube")
async def process_youtube(data: dict, current_user: models.User = Depends(auth.get_current_user)):
    require_active_trial(current_user)
    if not HAS_YTDLP:
        raise HTTPException(status_code=501, detail="YouTube processing is not available in this deployment. Please install yt-dlp.")
    url = data.get("url")
    ydl_opts = get_ytdlp_audio_options("temp_yt")
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl: 
        ydl.download([url])

    transcript = generate_transcript_json("temp_yt.m4a")
    with open("temp_yt.m4a", "rb") as f: audio_b64 = base64.b64encode(f.read()).decode()
    os.remove("temp_yt.m4a")
    return {"transcript": " ".join(transcript), "audio_b64": audio_b64, "audio_mime": "audio/mp4"}

@app.post("/api/admin/upload-audio")
async def upload_audio(file: UploadFile = File(...), current_user: models.User = Depends(auth.get_current_user)):
    require_operator(current_user)
    filename = os.path.basename(file.filename or f"audio_{int(datetime.datetime.utcnow().timestamp())}")
    content = await file.read()
    if is_supabase_storage_enabled():
        audio_url = upload_public_file(f"lesson_audio/{filename}", content, file.content_type or "application/octet-stream")
        return {"url": audio_url}
    file_path = os.path.join(DATA_DIR, filename)
    with open(file_path, "wb") as buffer:
        buffer.write(content)
    return {"url": f"/data/{filename}"}

@app.post("/api/admin/lessons")
def create_lesson(req: LessonCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_operator(current_user)
    new_lesson = models.Lesson(
        title=req.title, 
        level=req.level, 
        category=normalize_lesson_category(req.category, req.level),
        audio_url=req.audio_url,
        transcript=req.transcript, 
        translation=req.translation,
        cloze_data_json="[]" 
    )
    db.add(new_lesson)
    db.commit()
    return {"msg": "Thành công"}

@app.post("/api/admin/lessons/from-url")
def create_lesson_from_url(req: ExternalLessonCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_operator(current_user)
    if not HAS_YTDLP:
        raise HTTPException(status_code=501, detail="YouTube processing is not available in this deployment. Please install yt-dlp.")
    if not req.title.strip() or not req.source_url.strip():
        raise HTTPException(status_code=400, detail="Vui lòng nhập tiêu đề và link nguồn")

    filename_base = f"lesson_{int(datetime.datetime.utcnow().timestamp())}"
    output_template = os.path.join(DATA_DIR, filename_base)
    ydl_opts = get_ytdlp_audio_options(output_template)

    audio_path = f"{output_template}.m4a"
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([req.source_url])
        transcript = generate_transcript_json(audio_path)
    except Exception as exc:
        if os.path.exists(audio_path):
            os.remove(audio_path)
        raise HTTPException(status_code=400, detail=f"Không thể tạo bài học từ link này. Hãy cập nhật yt-dlp hoặc thử link công khai khác. Chi tiết: {exc}")

    if is_supabase_storage_enabled():
        with open(audio_path, "rb") as f:
            audio_url = upload_public_file(f"lesson_audio/{filename_base}.m4a", f.read(), "audio/mp4")
        os.remove(audio_path)
    else:
        audio_url = f"/data/{filename_base}.m4a"
    lesson = models.Lesson(
        title=req.title.strip(),
        level=req.level,
        category=normalize_lesson_category(req.category, req.level),
        audio_url=audio_url,
        transcript=" ".join(transcript),
        translation=req.translation or "",
        cloze_data_json="[]",
    )
    db.add(lesson)
    db.commit()
    return {"msg": "Đã tạo bài học từ link ngoài", "lesson_id": lesson.id, "audio_url": audio_url}

@app.delete("/api/admin/lessons/{lesson_id}")
def delete_lesson(lesson_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_operator(current_user)
    db.query(models.UserProgress).filter_by(lesson_id=lesson_id).delete()
    db.query(models.Lesson).filter_by(id=lesson_id).delete()
    db.commit(); return {"msg": "Đã xóa"}

@app.get("/api/admin/users")
def list_users(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_operator(current_user)
    users = db.query(models.User).order_by(models.User.id).all()
    return [
        {
            "id": user.id,
            "username": user.username,
            "role": user.role,
            "account_status": user.account_status,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "approved_at": user.approved_at.isoformat() if user.approved_at else None,
            "trial_expires_at": user.trial_expires_at.isoformat() if user.trial_expires_at else None,
            **get_trial_status(user),
        }
        for user in users
    ]

@app.put("/api/admin/users/{user_id}/trial")
def update_user_trial(user_id: int, req: TrialUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_operator(current_user)
    user = db.query(models.User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    days = plan_to_days(req.plan_name, req.days)
    if user.account_status != "approved":
        user.account_status = "approved"
        user.approved_at = user.approved_at or datetime.datetime.utcnow()
    grant_learning_access(user, days)
    db.commit()
    return {"msg": "Đã duyệt và cấp quyền học cho người dùng", "account_status": user.account_status, **get_trial_status(user)}

@app.put("/api/admin/users/{user_id}/status")
def update_user_status(user_id: int, req: AccountStatusUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_operator(current_user)
    allowed_statuses = {"pending", "approved", "rejected", "locked"}
    if req.status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Trạng thái tài khoản không hợp lệ")
    user = db.query(models.User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    if user.role == "admin" and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Không được thay đổi trạng thái tài khoản admin")
    user.account_status = req.status
    if req.status == "approved" and user.approved_at is None:
        user.approved_at = datetime.datetime.utcnow()
        if user.role != "admin" and user.trial_expires_at is None:
            user.trial_expires_at = user.approved_at + datetime.timedelta(days=5)
    db.commit()
    return {"msg": "Đã cập nhật trạng thái tài khoản", "account_status": user.account_status, **get_trial_status(user)}

@app.put("/api/admin/users/{user_id}/role")
def update_user_role(user_id: int, req: RoleUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_admin(current_user)
    allowed_roles = {"admin", "manager", "user"}
    if req.role not in allowed_roles:
        raise HTTPException(status_code=400, detail="Role không hợp lệ")
    user = db.query(models.User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    user.role = req.role
    db.commit()
    return {"msg": "Đã cập nhật role", "role": user.role}

@app.post("/api/payments")
def create_payment(req: PaymentCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_approved_user(current_user)
    if req.amount <= 0:
        raise HTTPException(status_code=400, detail="Số tiền không hợp lệ")
    payment = models.Payment(
        user_id=current_user.id,
        plan_name=req.plan_name,
        amount=req.amount,
        note=req.note,
        status="waiting_verification",
    )
    db.add(payment)
    db.commit()
    return {"msg": "Đã gửi thông báo thanh toán. Admin sẽ kiểm tra và xác nhận.", "payment_id": payment.id}

@app.get("/api/admin/payments")
def list_payments(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_operator(current_user)
    payments = db.query(models.Payment).order_by(models.Payment.created_at.desc()).all()
    total_success = sum(payment.amount for payment in payments if payment.status in {"success", "unlocked"})
    return {
        "total_success": total_success,
        "items": [
            {
                "id": payment.id,
                "username": payment.user.username if payment.user else "unknown",
                "plan_name": payment.plan_name,
                "amount": payment.amount,
                "status": payment.status,
                "note": payment.note,
                "created_at": payment.created_at.isoformat() if payment.created_at else None,
                "confirmed_at": payment.confirmed_at.isoformat() if payment.confirmed_at else None,
            }
            for payment in payments
        ],
    }

@app.get("/api/admin/progress/monthly")
def admin_monthly_progress(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_operator(current_user)
    users = db.query(models.User).filter(models.User.role == "user").order_by(models.User.id).all()
    now = datetime.datetime.utcnow()
    current_month = now.strftime("%Y-%m")
    today = now.date()
    rows = []
    today_attempts = 0
    today_active_users = set()
    month_attempts_total = 0
    month_active_users = set()
    for user in users:
        summary = build_progress_summary(user)
        current = next((m for m in summary["monthly"] if m["month"] == current_month), None)
        for item in user.progress:
            if not item.created_at:
                continue
            if item.created_at.date() == today:
                today_attempts += 1
                today_active_users.add(user.id)
            if item.created_at.strftime("%Y-%m") == current_month:
                month_attempts_total += 1
                month_active_users.add(user.id)
        rows.append({
            "username": user.username,
            "account_status": user.account_status,
            "trial_active": get_trial_status(user)["trial_active"],
            "learning_day": summary["learning_day"],
            "stage": summary["stage"],
            "total_attempts": summary["total_attempts"],
            "active_days_total": summary["active_days"],
            "avg_score_total": summary["avg_score"],
            "month": current_month,
            "month_attempts": current["attempts"] if current else 0,
            "month_active_days": current["active_days"] if current else 0,
            "month_avg_score": current["avg_score"] if current else 0,
        })
    return {
        "month": current_month,
        "today": today.isoformat(),
        "stats": {
            "today_attempts": today_attempts,
            "today_active_users": len(today_active_users),
            "month_attempts": month_attempts_total,
            "month_active_users": len(month_active_users),
        },
        "items": rows,
    }

@app.put("/api/admin/payments/{payment_id}/confirm")
def confirm_payment(payment_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_operator(current_user)
    payment = db.query(models.Payment).filter_by(id=payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Không tìm thấy thanh toán")
    if payment.status in {"success", "unlocked"}:
        return {"msg": "Thanh toán này đã được xác nhận trước đó"}
    if payment.user:
        grant_learning_access(payment.user, plan_to_days(payment.plan_name))
    payment.status = "unlocked"
    payment.confirmed_at = datetime.datetime.utcnow()
    db.commit()
    return {"msg": "Đã xác nhận thanh toán thành công"}

# Mount static files only when directories exist (not on serverless/Vercel)
if os.path.isdir(DATA_DIR):
    app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
