import datetime
from fastapi import HTTPException

import models


def get_trial_status(user: models.User):
    if user.role == "admin":
        return {"trial_active": True, "trial_days_left": None, "trial_expires_at": None}
    expires_at = user.trial_expires_at
    now = datetime.datetime.utcnow()
    days_left = 0
    if expires_at:
        seconds_left = (expires_at - now).total_seconds()
        days_left = max(0, int((seconds_left + 86399) // 86400))
    return {
        "trial_active": bool(expires_at and expires_at > now),
        "trial_days_left": days_left,
        "trial_expires_at": expires_at.isoformat() if expires_at else None,
    }


def require_active_trial(user: models.User):
    if not get_trial_status(user)["trial_active"]:
        raise HTTPException(status_code=403, detail="Tài khoản đã hết hạn dùng thử/gói học. Vui lòng gia hạn để tiếp tục.")


def require_approved_user(user: models.User):
    if user.account_status != "approved":
        raise HTTPException(status_code=403, detail="Tài khoản chưa được phép sử dụng")


def require_admin(user: models.User):
    require_approved_user(user)
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Chỉ admin được thao tác")


def require_operator(user: models.User):
    require_approved_user(user)
    if user.role not in {"admin", "manager"}:
        raise HTTPException(status_code=403, detail="Bạn không có quyền vận hành")


def plan_to_days(plan_name=None, fallback_days=None):
    plans = {
        "Dùng thử 5 ngày": 5,
        "Gói 1 tháng": 30,
        "Gói 3 tháng": 90,
        "Gói 6 tháng": 180,
        "Gói 12 tháng": 365,
        "Gói 1 năm": 365,
        "Premium Monthly": 30,
        "Premium Quarterly": 90,
        "Premium Yearly": 365,
        "HanLingua Pro AI": 30,
    }
    if plan_name in plans:
        return plans[plan_name]
    if fallback_days is not None:
        return fallback_days
    raise HTTPException(status_code=400, detail="Gói học không hợp lệ")


def grant_learning_access(user: models.User, days: int):
    if days <= 0:
        raise HTTPException(status_code=400, detail="Thời hạn cấp quyền không hợp lệ")
    now = datetime.datetime.utcnow()
    start_at = user.trial_expires_at if user.trial_expires_at and user.trial_expires_at > now else now
    user.trial_expires_at = start_at + datetime.timedelta(days=days)
