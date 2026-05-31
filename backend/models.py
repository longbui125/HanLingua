from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship, declarative_base
import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="user")
    account_status = Column(String, default="pending")
    avatar_url = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    approved_at = Column(DateTime)
    trial_expires_at = Column(DateTime)
    progress = relationship("UserProgress", back_populates="owner")
    payments = relationship("Payment", back_populates="user")
    vocabulary_items = relationship("Vocabulary", back_populates="owner")

class Lesson(Base):
    __tablename__ = "lessons"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    level = Column(Integer)
    category = Column(String, default="beginner")
    audio_url = Column(String)
    transcript = Column(Text)
    translation = Column(Text)
    cloze_data_json = Column(Text)
    results = relationship("UserProgress", back_populates="lesson")

class UserProgress(Base):
    __tablename__ = "user_progress"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    lesson_id = Column(Integer, ForeignKey("lessons.id"))
    score = Column(Float)
    feedback_json = Column(Text)
    mistake_tags = Column(Text)
    content_type = Column(String, default="dictation")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    owner = relationship("User", back_populates="progress")
    lesson = relationship("Lesson", back_populates="results")

class Payment(Base):
    __tablename__ = "payments"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    plan_name = Column(String)
    amount = Column(Integer)
    status = Column(String, default="pending")
    note = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    confirmed_at = Column(DateTime)
    user = relationship("User", back_populates="payments")

class Vocabulary(Base):
    __tablename__ = "vocabulary"
    id = Column(Integer, primary_key=True, index=True)
    korean = Column(String, index=True)
    han_viet = Column(String)
    meaning = Column(Text)
    example = Column(Text)
    image_url = Column(String)
    topic = Column(String, index=True)
    source = Column(String, default="manual")
    created_by = Column(String, default="system")
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    owner = relationship("User", back_populates="vocabulary_items")
