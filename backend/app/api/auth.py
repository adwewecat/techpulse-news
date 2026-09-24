import time
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Query

from app.core.storage import get_storage, JSONStorage
from app.schemas.user import (
    UserCreate, UserLogin, UserForgotPassword, 
    UserProfile, UserSyncData, hash_password, verify_password
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# Bộ nhớ lưu mốc thời gian request gần nhất để chống spam (Cooldown 60s)
# Key: IP của client hoặc username
LAST_REGISTER_ATTEMPTS: Dict[str, float] = {}
LAST_RESET_ATTEMPTS: Dict[str, float] = {}

COOLDOWN_SECONDS = 60.0

def get_client_ip(request: Request) -> str:
    """Lấy địa chỉ IP của client từ Request hoặc header proxy"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"

def check_cooldown(tracker: Dict[str, float], key: str, action_name: str) -> None:
    now = time.time()
    last_time = tracker.get(key, 0.0)
    elapsed = now - last_time
    if elapsed < COOLDOWN_SECONDS:
        remaining = int(COOLDOWN_SECONDS - elapsed)
        raise HTTPException(
            status_code=429,
            detail=f"Thao tác quá nhanh! Vui lòng đợi thêm {remaining} giây trước khi {action_name} tiếp theo."
        )

def record_attempt(tracker: Dict[str, float], key: str) -> None:
    tracker[key] = time.time()

@router.get("/users-count")
def get_users_count(storage: JSONStorage = Depends(get_storage)):
    """Lấy số lượng người dùng hiện tại và giới hạn tối đa (5 users)"""
    return storage.get_users_count()

@router.post("/register")
def register_user(req: UserCreate, request: Request, storage: JSONStorage = Depends(get_storage)):
    """
    Đăng ký người dùng mới:
    - Tối đa 5 user trong hệ thống (1 admin + 4 người dùng)
    - Cooldown 60s giữa các lần đăng ký để chống spam
    """
    ip = get_client_ip(request)
    check_cooldown(LAST_REGISTER_ATTEMPTS, ip, "đăng ký tài khoản")

    pwd_hash = hash_password(req.password)
    user, err = storage.add_user(req.username, pwd_hash, req.display_name)
    if err:
        raise HTTPException(status_code=400, detail=err)

    record_attempt(LAST_REGISTER_ATTEMPTS, ip)

    return {
        "status": "success",
        "message": f"Đăng ký tài khoản '{req.username}' thành công!",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user["role"],
            "display_name": user["display_name"],
            "created_at": user["created_at"],
            "starred_ids": user.get("starred_ids", []),
            "read_ids": user.get("read_ids", []),
            "settings": user.get("settings", {})
        }
    }

@router.post("/login")
def login_user(req: UserLogin, storage: JSONStorage = Depends(get_storage)):
    """
    Đăng nhập:
    - Admin mặc định: admin / admin1230
    - Các user tự tạo khác
    """
    user = storage.get_user_by_username(req.username)
    if not user:
        raise HTTPException(status_code=400, detail="Tài khoản không tồn tại.")

    if not verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=400, detail="Mật khẩu không chính xác.")

    return {
        "status": "success",
        "message": f"Đăng nhập thành công! Chào mừng {user.get('display_name', user['username'])}",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "role": user.get("role", "user"),
            "display_name": user.get("display_name", user["username"]),
            "created_at": user.get("created_at"),
            "starred_ids": user.get("starred_ids", []),
            "read_ids": user.get("read_ids", []),
            "settings": user.get("settings", {})
        }
    }

@router.post("/forgot-password")
def forgot_password(req: UserForgotPassword, request: Request, storage: JSONStorage = Depends(get_storage)):
    """
    Quên mật khẩu:
    - Chỉ cần nhập username tồn tại là đổi được mật khẩu mới, không cần pass cũ
    - Cooldown 60s giữa các lần đổi mật khẩu để chống spam
    """
    ip = get_client_ip(request)
    rate_key = f"{ip}_{req.username.strip().lower()}"
    check_cooldown(LAST_RESET_ATTEMPTS, rate_key, "đổi mật khẩu")

    user = storage.get_user_by_username(req.username)
    if not user:
        raise HTTPException(status_code=404, detail=f"Tài khoản '{req.username}' không tồn tại trong hệ thống.")

    new_hash = hash_password(req.new_password)
    success = storage.update_user_password(req.username, new_hash)
    if not success:
        raise HTTPException(status_code=500, detail="Không thể cập nhật mật khẩu.")

    record_attempt(LAST_RESET_ATTEMPTS, rate_key)

    return {
        "status": "success",
        "message": f"Đổi mật khẩu cho tài khoản '{req.username}' thành công! Bạn có thể đăng nhập ngay."
    }

@router.get("/profile")
def get_user_profile(username: str = Query(...), storage: JSONStorage = Depends(get_storage)):
    """Lấy thông tin hồ sơ và dữ liệu lưu của người dùng"""
    user = storage.get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")

    return {
        "id": user["id"],
        "username": user["username"],
        "role": user.get("role", "user"),
        "display_name": user.get("display_name", user["username"]),
        "created_at": user.get("created_at"),
        "starred_ids": user.get("starred_ids", []),
        "read_ids": user.get("read_ids", []),
        "settings": user.get("settings", {})
    }

@router.post("/sync")
def sync_user_data(
    username: str = Query(...),
    data: UserSyncData = None,
    storage: JSONStorage = Depends(get_storage)
):
    """Đồng bộ dữ liệu của người dùng: tin đã đọc, tin đánh dấu sao, cài đặt giọng đọc/tốc độ"""
    user = storage.get_user_by_username(username)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")

    starred_ids = data.starred_ids if data else None
    read_ids = data.read_ids if data else None
    settings_dict = data.settings if data else None

    updated = storage.update_user_data(username, starred_ids, read_ids, settings_dict)
    return {
        "status": "success",
        "user": {
            "id": updated["id"],
            "username": updated["username"],
            "starred_ids": updated.get("starred_ids", []),
            "read_ids": updated.get("read_ids", []),
            "settings": updated.get("settings", {})
        }
    }
