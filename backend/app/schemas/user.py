import hashlib
import secrets
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

def hash_password(password: str, salt: Optional[str] = None) -> str:
    """Băm mật khẩu an toàn với Salt bằng SHA-256"""
    if not salt:
        salt = secrets.token_hex(16)
    combined = f"{salt}:{password}"
    pwd_hash = hashlib.sha256(combined.encode("utf-8")).hexdigest()
    return f"{salt}${pwd_hash}"

def verify_password(plain_password: str, hashed_value: str) -> bool:
    """Xác thực mật khẩu đã băm"""
    if not hashed_value or "$" not in hashed_value:
        return False
    try:
        salt, expected_hash = hashed_value.split("$", 1)
        combined = f"{salt}:{plain_password}"
        actual_hash = hashlib.sha256(combined.encode("utf-8")).hexdigest()
        return secrets.compare_digest(actual_hash, expected_hash)
    except Exception:
        return False

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    password: str = Field(..., min_length=4, max_length=64)
    display_name: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserForgotPassword(BaseModel):
    username: str = Field(..., min_length=3, max_length=32)
    new_password: str = Field(..., min_length=4, max_length=64)

class UserProfile(BaseModel):
    id: str
    username: str
    role: str = "user"
    display_name: Optional[str] = None
    created_at: str
    starred_ids: List[int] = []
    read_ids: List[int] = []
    settings: Dict[str, Any] = {}

class UserSyncData(BaseModel):
    starred_ids: Optional[List[int]] = None
    read_ids: Optional[List[int]] = None
    settings: Optional[Dict[str, Any]] = None
