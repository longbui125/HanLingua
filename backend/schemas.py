from typing import Optional
from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    password: str


class EvalRequest(BaseModel):
    target_text: str
    user_text: str
    lesson_id: Optional[int] = None


class ClozeEvalRequest(BaseModel):
    cloze_answers: list
    level: int
    lesson_id: int


class LessonCreate(BaseModel):
    title: str
    level: int
    audio_url: str
    transcript: str
    translation: str
    category: str = "beginner"


class ExternalLessonCreate(BaseModel):
    title: str
    level: int
    source_url: str
    translation: Optional[str] = ""
    category: str = "beginner"


class TrialUpdate(BaseModel):
    days: Optional[int] = None
    plan_name: Optional[str] = None


class PaymentCreate(BaseModel):
    plan_name: str
    amount: int
    note: str


class AccountStatusUpdate(BaseModel):
    status: str


class RoleUpdate(BaseModel):
    role: str


class AccountProfileUpdate(BaseModel):
    username: str
    current_password: str


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str


class ForgotPasswordRequest(BaseModel):
    username: str


class VocabularyCreate(BaseModel):
    korean: str
    han_viet: Optional[str] = ""
    meaning: str
    example: Optional[str] = ""
    topic: str


class LessonSchema(BaseModel):
    id: int
    title: str
    level: int
    category: str = "beginner"

    class Config:
        from_attributes = True


class VocabularySchema(BaseModel):
    id: int
    korean: str
    han_viet: str = ""
    meaning: str = ""
    example: str = ""
    image_url: Optional[str] = None
    topic: str
    source: str = "manual"
    created_by: str = "system"

    class Config:
        from_attributes = True
