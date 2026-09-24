import json
import logging
import re
from pathlib import Path
from typing import Dict, Any, List

from app.core.config import settings

logger = logging.getLogger("pronunciation")

DICTIONARY_FILE = settings.DATA_FILE.parent / "pronunciation_dict.json"

DEFAULT_PRONUNCIATION_DICT: Dict[str, str] = {
    "OpenAI": "ô pần ây ai",
    "ChatGPT": "chát gpt",
    "AI": "ây ai",
    "LLM": "eo eo em",
    "Apple": "áp pồ",
    "Google": "gú gồ",
    "Microsoft": "mai cờ rô sốp",
    "Nvidia": "en vi đi a",
    "Meta": "mê ta",
    "CEO": "xê e o",
    "Tesla": "tét la",
    "SpaceX": "sếp x",
    "Samsung": "sam sung",
    "Intel": "in teo",
    "Qualcomm": "coan com",
    "VinFast": "vin phát",
    "iPhone": "ai phôn",
    "iPad": "ai pát",
    "MacBook": "mác búc",
    "Gemini": "gê mi ni",
    "Claude": "cờ lốt",
    "DeepSeek": "đíp xích",
    "Copilot": "cô pai lọt",
    "TSMC": "tê ét em xê",
    "ASML": "a ét em eo",
    "AMD": "a em đê"
}

_cached_dict: Dict[str, str] = {}
_cached_pattern: Any = None

def load_pronunciation_dict() -> Dict[str, str]:
    """Tải từ điển phiên âm từ tệp JSON hoặc khởi tạo giá trị mặc định"""
    global _cached_dict, _cached_pattern
    if DICTIONARY_FILE.exists():
        try:
            with open(DICTIONARY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    _cached_dict = data
                    _recompile_pattern()
                    return _cached_dict
        except Exception as e:
            logger.warning(f"Lỗi khi đọc file {DICTIONARY_FILE}: {e}")

    _cached_dict = DEFAULT_PRONUNCIATION_DICT.copy()
    save_pronunciation_dict(_cached_dict)
    return _cached_dict

def save_pronunciation_dict(dictionary: Dict[str, str]) -> None:
    """Lưu từ điển phiên âm ra tệp JSON"""
    global _cached_dict
    _cached_dict = dictionary
    _recompile_pattern()
    try:
        DICTIONARY_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(DICTIONARY_FILE, "w", encoding="utf-8") as f:
            json.dump(_cached_dict, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"Lỗi khi ghi từ điển phiên âm: {e}")

def _recompile_pattern() -> None:
    """Biên dịch regex một lượt (single-pass) để thay thế từ dài trước, tránh trùng lặp đè từ"""
    global _cached_pattern
    if not _cached_dict:
        _cached_pattern = None
        return

    # Sắp xếp các từ dài trước, từ ngắn sau để ưu tiên khớp cụm từ đầy đủ (VD: OpenAI trước AI)
    sorted_words = sorted(_cached_dict.keys(), key=len, reverse=True)
    escaped = [re.escape(w.strip()) for w in sorted_words if w.strip()]
    if not escaped:
        _cached_pattern = None
        return

    # Khớp chính xác ranh giới từ (\b), không phân biệt hoa thường
    pattern_str = r'\b(' + '|'.join(escaped) + r')\b'
    _cached_pattern = re.compile(pattern_str, re.IGNORECASE)

def get_pronunciation_dict() -> Dict[str, str]:
    global _cached_dict
    if not _cached_dict:
        load_pronunciation_dict()
    return _cached_dict

def update_pronunciation_dict(new_dict: Dict[str, str]) -> Dict[str, str]:
    save_pronunciation_dict(new_dict)
    return get_pronunciation_dict()

def add_or_update_word(original: str, replacement: str) -> Dict[str, str]:
    d = get_pronunciation_dict()
    orig = original.strip()
    repl = replacement.strip()
    if orig and repl:
        d[orig] = repl
        save_pronunciation_dict(d)
    return d

def remove_word(original: str) -> Dict[str, str]:
    d = get_pronunciation_dict()
    orig = original.strip()
    # Tìm kiếm không phân biệt hoa thường để xóa
    matched_key = None
    for k in d.keys():
        if k.lower() == orig.lower():
            matched_key = k
            break
    if matched_key:
        del d[matched_key]
        save_pronunciation_dict(d)
    return d

def reset_to_default() -> Dict[str, str]:
    save_pronunciation_dict(DEFAULT_PRONUNCIATION_DICT.copy())
    return get_pronunciation_dict()

def apply_pronunciation(text: str) -> str:
    """
    Áp dụng thay thế phiên âm theo từ điển một lượt (single-pass).
    Không bao giờ xảy ra lỗi thế lặp lại (VD: 'OpenAI' -> 'ô pần ây ai', không bị biến thành 'ô pần ây ây ai').
    """
    if not text or not text.strip():
        return text

    global _cached_pattern
    if _cached_pattern is None:
        load_pronunciation_dict()

    if _cached_pattern is None or not _cached_dict:
        return text

    # Bản đồ tra cứu chữ thường
    lookup = {k.lower(): v for k, v in _cached_dict.items()}

    def _replace_match(match: re.Match) -> str:
        word = match.group(0).lower()
        return lookup.get(word, match.group(0))

    return _cached_pattern.sub(_replace_match, text)

# Khởi tạo nạp từ điển khi module được import
load_pronunciation_dict()
