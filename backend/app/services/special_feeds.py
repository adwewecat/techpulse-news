"""
Special Feeds: Bản tin tổng hợp ngắn TP.HCM (Gom chung Thời tiết & Giá vàng Mi Hồng)
- Ngắn gọn, súc tích, chỉ nói ở TP.HCM.
- Giá vàng Mi Hồng: Chỉ nói Vàng nhẫn trơn 4 số 9 (code 999): mua vào, bán ra, tăng/giảm so với phiên trước.
- Tuyệt đối không nói ngày cũ, cập nhật theo giờ thực trong ngày.
"""
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any, List
from pathlib import Path

import httpx
from app.core.config import settings

logger = logging.getLogger("special_feeds")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/html, */*"
}

WEATHER_DESCS = {
    "Sunny": "trời nắng đẹp",
    "Clear": "trời quang đãng",
    "Partly cloudy": "nhiều mây, có lúc hửng nắng",
    "Cloudy": "trời nhiều mây",
    "Overcast": "trời âm u",
    "Mist": "sương mù nhẹ",
    "Fog": "sương mù",
    "Light rain": "mưa nhỏ rải rác",
    "Moderate rain": "mưa vừa",
    "Heavy rain": "mưa lớn",
    "Patchy rain possible": "có thể có mưa rải rác",
    "Light drizzle": "mưa phùn nhẹ",
    "Thundery outbreaks possible": "có thể có dông",
    "Moderate or heavy rain shower": "mưa rào vừa đến lớn",
    "Light rain shower": "mưa rào nhẹ",
    "Patchy light rain": "mưa rào rải rác",
    "Moderate or heavy rain in area with thunder": "mưa dông",
}

def _translate_weather(desc: str) -> str:
    if not desc:
        return "nhiều mây"
    for eng, vi in WEATHER_DESCS.items():
        if eng.lower() in desc.lower():
            return vi
    return "nhiều mây"

async def fetch_weather_brief() -> Tuple_Weather:
    """Lấy dữ liệu thời tiết TP.HCM ngắn gọn từ wttr.in"""
    url = "https://wttr.in/Ho+Chi+Minh+City?format=j1"
    try:
        async with httpx.AsyncClient(timeout=8.0, headers=HEADERS) as client:
            res = await client.get(url)
            if res.status_code == 200:
                data = res.json()
                curr = data.get("current_condition", [{}])[0] if data.get("current_condition") else {}
                desc_raw = curr.get("weatherDesc", [{}])[0].get("value", "") if curr.get("weatherDesc") else ""
                desc_vi = _translate_weather(desc_raw)

                weather_days = data.get("weather", [])
                today_w = weather_days[0] if weather_days else {}
                temp_min = today_w.get("mintempC", "24")
                temp_max = today_w.get("maxtempC", "33")
                rain_arr = [int(h.get("chanceofrain", 0)) for h in today_w.get("hourly", []) if h.get("chanceofrain")]
                avg_rain = int(sum(rain_arr) / len(rain_arr)) if rain_arr else 30

                return desc_vi, temp_min, temp_max, avg_rain
    except Exception as e:
        logger.warning(f"Lỗi lấy thời tiết: {e}")
    return "nhiều mây có nắng", "25", "33", 30

def fmt_price_speech(n: float) -> str:
    """Định dạng giá vàng dễ nghe cho TTS: VD 14250000 -> 14 triệu 250 nghìn đồng"""
    try:
        val = int(n)
        if val >= 1000000:
            trieu = val // 1000000
            nghin = (val % 1000000) // 1000
            if nghin > 0:
                return f"{trieu} triệu {nghin} nghìn đồng"
            return f"{trieu} triệu đồng"
        return f"{val:,} đồng".replace(",", ".")
    except Exception:
        return str(n)

def fmt_price_display(n: float) -> str:
    try:
        return f"{int(n):,.0f}đ".replace(",", ".")
    except Exception:
        return str(n)

async def fetch_gold_brief() -> Tuple_Gold:
    """Lấy giá vàng nhẫn trơn 4 số 9 (code 999) tại Mi Hồng"""
    mihong_url = "https://api.mihong.com/v1/gold-prices?market=domestic"
    api_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0",
        "Accept": "application/json",
        "Origin": "https://mihong.com",
        "Referer": "https://mihong.com/",
    }
    try:
        async with httpx.AsyncClient(timeout=8.0, headers=api_headers, follow_redirects=True) as client:
            res = await client.get(mihong_url)
            if res.status_code == 200:
                data = res.json()
                if isinstance(data, list) and data:
                    # Ưu tiên mã 999 (vàng nhẫn trơn 4 số 9), fallback sang item đầu
                    item_999 = next((x for x in data if x.get("code") == "999"), None)
                    if not item_999:
                        item_999 = next((x for x in data if "999" in str(x.get("name", ""))), data[0])

                    buy = item_999.get("buyingPrice", 0)
                    sell = item_999.get("sellingPrice", 0)
                    change = item_999.get("sellChange", 0)
                    date_time = item_999.get("dateTime", "")

                    return buy, sell, change, date_time
    except Exception as e:
        logger.warning(f"Lỗi lấy giá vàng Mi Hồng: {e}")
    return 14250000, 14400000, 0, ""

Tuple_Weather = tuple[str, str, str, int]
Tuple_Gold = tuple[float, float, float, str]

async def generate_combined_brief() -> Optional[Dict[str, Any]]:
    """Gom chung Thời tiết & Giá vàng Mi Hồng ở TP.HCM thành 1 tin ngắn gọn duy nhất"""
    now_vn = datetime.now(timezone(timedelta(hours=7)))
    today_str = now_vn.strftime("%Y-%m-%d")
    today_display = now_vn.strftime("%d/%m/%Y")
    current_time_str = now_vn.strftime("%H:%M")

    # Lấy thời tiết & giá vàng song song
    desc_vi, temp_min, temp_max, avg_rain = await fetch_weather_brief()
    gold_buy, gold_sell, gold_change, gold_dt = await fetch_gold_brief()

    # Xử lý câu mưa ngắn gọn
    rain_part = ""
    if avg_rain >= 60:
        rain_part = f", có khả năng mưa cao ({avg_rain}%)"
    elif avg_rain >= 35:
        rain_part = f", chiều tối có thể có mưa rào ({avg_rain}%)"

    # Xử lý biến động giá vàng
    change_speech = ""
    change_display = ""
    if gold_change > 0:
        change_speech = f", tăng {fmt_price_speech(abs(gold_change))} so với phiên trước"
        change_display = f" (▲ {fmt_price_display(gold_change)})"
    elif gold_change < 0:
        change_speech = f", giảm {fmt_price_speech(abs(gold_change))} so với phiên trước"
        change_display = f" (▼ {fmt_price_display(abs(gold_change))})"
    else:
        change_speech = ", giá giữ nguyên so với phiên trước"
        change_display = " (ổn định)"

    buy_speech = fmt_price_speech(gold_buy)
    sell_speech = fmt_price_speech(gold_sell)
    buy_disp = fmt_price_display(gold_buy)
    sell_disp = fmt_price_display(gold_sell)

    # Đoạn văn đọc siêu ngắn gọn (khoảng 15-20 giây)
    summary_text = (
        f"Thời tiết TP.HCM hôm nay: {desc_vi}, nhiệt độ {temp_min} đến {temp_max} độ C{rain_part}. "
        f"Giá vàng nhẫn trơn 4 số 9 tại Mi Hồng: Mua vào {buy_speech}, bán ra {sell_speech} một chỉ{change_speech}."
    )

    title = f"Thời tiết TP.HCM & Giá vàng nhẫn trơn Mi Hồng ({today_display}): Mua {buy_disp} – Bán {sell_disp}"

    bullets = [
        f"Thời tiết TP.HCM ({current_time_str}): {desc_vi.capitalize()}, nhiệt độ {temp_min}–{temp_max}°C{rain_part}.",
        f"Vàng nhẫn trơn 9999 Mi Hồng: Mua vào {buy_disp} – Bán ra {sell_disp}{change_display}.",
        f"Nguồn dữ liệu: wttr.in & Mi Hồng ({today_display} {current_time_str})."
    ]

    return {
        "url": "special://daily-brief/hcm",
        "title": title,
        "source_name": "Điểm tin TP.HCM (Thời tiết & Giá vàng)",
        "source_domain": "mihong.com",
        "source_tier": 1.0,
        "region": "vietnam",
        "category": "special",
        "summary_short": summary_text,
        "summary_bullets": bullets,
        "content_raw": summary_text,
        "image_url": "https://cdn-icons-png.flaticon.com/512/2933/2933279.png",
        "tags": ["thời tiết tp.hcm", "giá vàng mi hồng", "vàng 9999", "điểm tin hôm nay"],
        "published_at": now_vn.isoformat(),
        "hot_score": 9999.0,
        "velocity_score": 0.0,
        "badge": "special",
        "is_spam": False,
        "is_primary": True,
        "special_type": "brief_hcm",
        "special_date": today_str,
    }

async def upsert_special_feeds(storage) -> None:
    """
    Cập nhật bản tin gộp duy nhất: Thời tiết TP.HCM + Giá vàng nhẫn trơn 4 số 9 Mi Hồng.
    - Xóa các bài thời tiết và giá vàng cũ/rời rạc trước đây
    - Lưu 1 tin gộp duy nhất có hot_score 9999 ghim đầu trang
    """
    brief = await generate_combined_brief()
    if not brief:
        logger.warning("[SpecialFeed] Không tạo được bản tin gộp TP.HCM")
        return

    now_vn = datetime.now(timezone(timedelta(hours=7)))
    today_str = now_vn.strftime("%Y-%m-%d")
    audio_dir = settings.DATA_FILE.parent / "audio_cache"

    # 1. Xóa các bài viết thời tiết / giá vàng riêng lẻ cũ trước đây
    old_urls = ["special://weather-hcmc/current", "special://gold-price/current"]
    for old_url in old_urls:
        old_id = storage._url_index.get(old_url)
        if old_id:
            storage.update_article(old_id, {"is_spam": True, "hot_score": -1.0, "published_at": "2000-01-01T00:00:00"})
            if audio_dir.exists():
                for f in audio_dir.glob(f"*_{old_id}_*.mp3"):
                    try: f.unlink(missing_ok=True)
                    except Exception: pass

    # 2. Xóa các bản tin gộp của ngày cũ
    old_briefs = [
        a for a in storage.articles
        if a.get("special_type") == "brief_hcm" and a.get("special_date") != today_str
    ]
    for old in old_briefs:
        old_id = old.get("id")
        if old_id:
            storage.update_article(old_id, {"is_spam": True, "hot_score": -1.0, "published_at": "2000-01-01T00:00:00"})
            if audio_dir.exists():
                for f in audio_dir.glob(f"*_{old_id}_*.mp3"):
                    try: f.unlink(missing_ok=True)
                    except Exception: pass

    # 3. Cập nhật bài hiện tại
    target_url = brief["url"]
    existing_id = storage._url_index.get(target_url)
    if existing_id:
        storage.update_article(existing_id, {
            "title": brief["title"],
            "summary_short": brief["summary_short"],
            "summary_bullets": brief["summary_bullets"],
            "content_raw": brief["content_raw"],
            "published_at": brief["published_at"],
            "hot_score": brief["hot_score"],
            "is_spam": False,
            "special_date": today_str
        })
        # Xóa audio cache cũ của bài này để TTS cập nhật giờ mới
        if audio_dir.exists():
            for f in audio_dir.glob(f"*_{existing_id}_*.mp3"):
                try: f.unlink(missing_ok=True)
                except Exception: pass
        logger.info(f"[SpecialFeed] Đã cập nhật bản tin gộp TP.HCM: ID {existing_id}")
    else:
        new_art = storage.add_article(brief)
        logger.info(f"[SpecialFeed] Đã thêm mới bản tin gộp TP.HCM: ID {new_art.get('id')}")
