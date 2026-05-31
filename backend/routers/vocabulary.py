import os
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

import auth
import models
from database import VOCABULARY_IMAGE_DIR, get_db
from schemas import VocabularyCreate, VocabularySchema
from services import get_trial_status, require_approved_user, require_operator
from storage import delete_public_file, is_supabase_storage_enabled, upload_public_file

router = APIRouter()


@router.get("/api/vocabulary", response_model=List[VocabularySchema])
def list_vocabulary(topic: Optional[str] = None, q: Optional[str] = None, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_approved_user(current_user)
    query = db.query(models.Vocabulary)
    if topic:
        query = query.filter(models.Vocabulary.topic == topic)
    if q:
        keyword = f"%{q.strip()}%"
        query = query.filter(
            (models.Vocabulary.korean.like(keyword)) |
            (models.Vocabulary.han_viet.like(keyword)) |
            (models.Vocabulary.meaning.like(keyword)) |
            (models.Vocabulary.example.like(keyword))
        )
    return query.order_by(models.Vocabulary.topic, models.Vocabulary.id).all()


@router.get("/api/vocabulary/topics")
def list_vocabulary_topics(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_approved_user(current_user)
    rows = db.query(models.Vocabulary.topic).distinct().order_by(models.Vocabulary.topic).all()
    return [row[0] for row in rows if row[0]]


@router.post("/api/vocabulary", response_model=VocabularySchema)
def create_vocabulary(req: VocabularyCreate, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_approved_user(current_user)
    if current_user.role == "user" and not get_trial_status(current_user)["trial_active"]:
        raise HTTPException(status_code=403, detail="Tài khoản đã hết quyền học. Vui lòng gia hạn để thêm từ vựng.")
    korean = req.korean.strip()
    topic = req.topic.strip()
    meaning = req.meaning.strip()
    if not korean or not topic or not meaning:
        raise HTTPException(status_code=400, detail="Vui lòng nhập từ tiếng Hàn, nghĩa và chủ đề")
    item = models.Vocabulary(
        korean=korean,
        han_viet=(req.han_viet or "").strip(),
        meaning=meaning,
        example=(req.example or "").strip(),
        topic=topic,
        source="manual",
        created_by=current_user.role,
        user_id=current_user.id,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/api/admin/vocabulary/{vocabulary_id}")
def delete_vocabulary(vocabulary_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_operator(current_user)
    item = db.query(models.Vocabulary).filter_by(id=vocabulary_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ vựng")
    if item.image_url:
        if is_supabase_storage_enabled() and item.image_url.startswith("http"):
            delete_public_file(item.image_url)
        else:
            image_path = os.path.join(VOCABULARY_IMAGE_DIR, os.path.basename(item.image_url))
            if os.path.exists(image_path):
                os.remove(image_path)
    db.delete(item)
    db.commit()
    return {"msg": "Đã xóa từ vựng"}


@router.put("/api/admin/vocabulary/{vocabulary_id}/image")
async def update_vocabulary_image(vocabulary_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_operator(current_user)
    item = db.query(models.Vocabulary).filter_by(id=vocabulary_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ vựng")
    allowed_types = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Chỉ hỗ trợ JPG, PNG hoặc WEBP")
    content = await file.read()
    if len(content) > 3 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ảnh tối đa 3MB")
    if item.image_url:
        if is_supabase_storage_enabled() and item.image_url.startswith("http"):
            delete_public_file(item.image_url)
        else:
            old_path = os.path.join(VOCABULARY_IMAGE_DIR, os.path.basename(item.image_url))
            if os.path.exists(old_path):
                os.remove(old_path)
    filename = f"vocab_{vocabulary_id}{allowed_types[file.content_type]}"
    if is_supabase_storage_enabled():
        item.image_url = upload_public_file(f"vocabulary_images/{filename}", content, file.content_type)
    else:
        file_path = os.path.join(VOCABULARY_IMAGE_DIR, filename)
        with open(file_path, "wb") as f:
            f.write(content)
        item.image_url = f"/data/vocabulary_images/{filename}"
    db.commit()
    return {"msg": "Đã cập nhật ảnh minh họa", "image_url": item.image_url}


@router.delete("/api/admin/vocabulary/{vocabulary_id}/image")
def delete_vocabulary_image(vocabulary_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    require_operator(current_user)
    item = db.query(models.Vocabulary).filter_by(id=vocabulary_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ vựng")
    if item.image_url:
        if is_supabase_storage_enabled() and item.image_url.startswith("http"):
            delete_public_file(item.image_url)
        else:
            image_path = os.path.join(VOCABULARY_IMAGE_DIR, os.path.basename(item.image_url))
            if os.path.exists(image_path):
                os.remove(image_path)
    item.image_url = None
    db.commit()
    return {"msg": "Đã gỡ ảnh minh họa", "image_url": None}
