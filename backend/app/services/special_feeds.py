"""
Special Feeds: Thời tiết TP.HCM (Hôm nay D & Ngày mai D+1) và Giá vàng Mi Hồng
- Cập nhật liên tục theo giờ trong ngày
- Tuyệt đối không lưu/nói ngày cũ, chỉ giữ ngày hiện tại (D) và ngày kế (D+1)
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

VN_WEEKDAYS = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"]
WEATHER_DESCS = {
    "Sunny": "Nắng đẹp",
    "Clear": "Trời quang",
    "Partly cloudy": "Nhiều mây, có lúc hửng nắng",
    "Cloudy": "Nhiều mây",
    "Overcast": "Trời âm u",
    "Mist": "Sương mù nhẹ",
    "Fog": "Sương mù",
    "Light rain": "Mưa nhỏ",
    "Moderate rain": "Mưa vừa",
    "Heavy rain": "Mưa lớn",
    "Patchy rain possible": "Có thể có mưa rải rác",
    "Light drizzle": "Mưa phùn",
    "Thundery outbreaks possible": "Có thể có dông",
    "Blowing snow": "Tuyết rơi",
    "Light snow": "Tuyết nhẹ",
    "Moderate or heavy rain shower": "Mưa rào vừa đến lớn",
    "Light rain shower": "Mưa rào nhỏ",
    "Moderate or heavy showers of ice pellets": "Mưa đá",
    "Blizzard": "Bão tuyết",
    "Patchy light rain": "Mưa rải rác",
    "Moderate or heavy rain in area with thunder": "Mưa dông vừa đến lớn",
}

def _translate_weather(desc: str) -> str:
    """Dịch mô tả thời tiết tiếng Anh sang tiếng Việt."""
    if not desc:
        return "Nhiều mây"
    for eng, vi in WEATHER_DESCS.items():
        if eng.lower() in desc.lower():
            return vi
    return desc

async def fetch_weather_hcmc() -> Optional[Dict[str, Any]]:
    """
    Lấy thời tiết TP.HCM cho cả ngày hiện tại (D) VÀ ngày mai (D+1), kèm số liệu theo giờ từ wttr.in.
    Không lấy thời tiết ngày cũ.
    """
    url = "https://wttr.in/Ho+Chi+Minh+City?format=j1"
    now_vn = datetime.now(timezone(timedelta(hours=7)))
    today_str = now_vn.strftime("%Y-%m-%d")
    today_display = now_vn.strftime("%d/%m/%Y")
    current_time_str = now_vn.strftime("%H:%M")
    weekday_today = VN_WEEKDAYS[now_vn.weekday()]

    tomorrow_vn = now_vn + timedelta(days=1)
    tomorrow_display = tomorrow_vn.strftime("%d/%m/%Y")
    weekday_tomorrow = VN_WEEKDAYS[tomorrow_vn.weekday()]

    try:
        async with httpx.AsyncClient(timeout=10.0, headers=HEADERS) as client:
            res = await client.get(url)
            if res.status_code != 200:
                logger.warning(f"wttr.in trả về HTTP {res.status_code}")
                return None
            data = res.json()

        # 1. Điều kiện hiện tại (theo giờ thực)
        curr = data.get("current_condition", [{}])[0] if data.get("current_condition") else {}
        temp_now = curr.get("temp_C", "28")
        feels_like = curr.get("FeelsLikeC", temp_now)
        humidity_now = curr.get("humidity", "75")
        desc_now_raw = curr.get("weatherDesc", [{}])[0].get("value", "") if curr.get("weatherDesc") else ""
        desc_now_vi = _translate_weather(desc_now_raw)

        weather_days = data.get("weather", [])
        # weather_days[0] = hôm nay (D), weather_days[1] = ngày mai (D+1)
        today_w = weather_days[0] if len(weather_days) > 0 else {}
        tomorrow_w = weather_days[1] if len(weather_days) > 1 else {}

        # Dữ liệu hôm nay (D)
        temp_min_today = today_w.get("mintempC", "24")
        temp_max_today = today_w.get("maxtempC", "32")
        rain_today = [int(h.get("chanceofrain", 0)) for h in today_w.get("hourly", []) if h.get("chanceofrain")]
        avg_rain_today = int(sum(rain_today) / len(rain_today)) if rain_today else 40

        # Dữ liệu ngày mai (D+1)
        temp_min_tom = tomorrow_w.get("mintempC", "24")
        temp_max_tom = tomorrow_w.get("maxtempC", "32")
        rain_tom = [int(h.get("chanceofrain", 0)) for h in tomorrow_w.get("hourly", []) if h.get("chanceofrain")]
        avg_rain_tom = int(sum(rain_tom) / len(rain_tom)) if rain_tom else 45
        desc_tom_parts = [h["weatherDesc"][0].get("value", "") for h in tomorrow_w.get("hourly", []) if h.get("weatherDesc")]
        from collections import Counter
        top_desc_tom = Counter(desc_tom_parts).most_common(1)[0][0] if desc_tom_parts else "Partly cloudy"
        desc_tom_vi = _translate_weather(top_desc_tom)

        # Cảnh báo mưa hôm nay
        if avg_rain_today >= 70:
            rain_tip_today = f"Hôm nay xác suất mưa rất cao ({avg_rain_today}%), bắt buộc mang áo mưa khi ra ngoài."
        elif avg_rain_today >= 40:
            rain_tip_today = f"Hôm nay có khả năng mưa rào rải rác ({avg_rain_today}%), nên chuẩn bị sẵn áo mưa."
        else:
            rain_tip_today = f"Hôm nay trời ráo, ít khả năng mưa ({avg_rain_today}%)."

        title = f"Thời tiết TP.HCM hôm nay {today_display} & ngày mai (D+1) [{current_time_str}]: {desc_now_vi}, {temp_now}°C"
        summary = (
            f"Thời tiết TP.HCM cập nhật lúc {current_time_str}: Hiện tại {temp_now}°C ({desc_now_vi}, cảm giác như {feels_like}°C, độ ẩm {humidity_now}%). "
            f"Hôm nay {weekday_today} {today_display} (D): Nhiệt độ {temp_min_today}–{temp_max_today}°C. {rain_tip_today} "
            f"Dự báo ngày mai {weekday_tomorrow} {tomorrow_display} (D+1): {desc_tom_vi}, nhiệt độ {temp_min_tom}–{temp_max_tom}°C, xác suất mưa khoảng {avg_rain_tom}%."
        )

        bullets = [
            f"Hiện tại ({current_time_str}): {desc_now_vi}, {temp_now}°C (cảm giác {feels_like}°C), độ ẩm {humidity_now}%.",
            f"Hôm nay {weekday_today} (D): {temp_min_today}–{temp_max_today}°C, xác suất mưa {avg_rain_today}%.",
            f"Ngày mai {weekday_tomorrow} (D+1): {desc_tom_vi}, {temp_min_tom}–{temp_max_tom}°C, xác suất mưa {avg_rain_tom}%."
        ]

        return {
            "url": "special://weather-hcmc/current",
            "title": title,
            "source_name": "Dự báo thời tiết TP.HCM",
            "source_domain": "wttr.in",
            "source_tier": 1.0,
            "region": "vietnam",
            "category": "special",
            "summary_short": summary,
            "summary_bullets": bullets,
            "content_raw": summary,
            "image_url": "https://cdn-icons-png.flaticon.com/512/1163/1163661.png",
            "tags": ["thời tiết", "tp.hcm", "dự báo hôm nay", "dự báo ngày mai"],
            "published_at": now_vn.isoformat(),
            "hot_score": 9999.0,
            "velocity_score": 0.0,
            "badge": "special",
            "is_spam": False,
            "is_primary": True,
            "special_type": "weather",
            "special_date": today_str,
        }

    except Exception as e:
        logger.warning(f"Lỗi khi lấy thời tiết TP.HCM: {e}")
        return None

async def fetch_gold_price() -> Optional[Dict[str, Any]]:
    """
    Lấy giá vàng Mi Hồng trực tiếp theo giờ trong ngày từ API chính thức: api.mihong.com.
    Chỉ hiển thị giá hôm nay, cập nhật theo giờ.
    """
    now_vn = datetime.now(timezone(timedelta(hours=7)))
    today_str = now_vn.strftime("%Y-%m-%d")
    today_display = now_vn.strftime("%d/%m/%Y")
    current_time_str = now_vn.strftime("%H:%M")

    mihong_url = "https://api.mihong.com/v1/gold-prices?market=domestic"
    api_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0",
        "Accept": "application/json",
        "Origin": "https://mihong.com",
        "Referer": "https://mihong.com/",
    }

    try:
        async with httpx.AsyncClient(timeout=12.0, headers=api_headers, follow_redirects=True) as client:
            res = await client.get(mihong_url)
            if res.status_code == 200:
                data = res.json()
                if isinstance(data, list) and data:
                    sjc_item = next((x for x in data if x.get("code") == "SJC"), data[0])
                    vang_999 = next((x for x in data if x.get("code") == "999"), None)
                    
                    buy = sjc_item.get("buyingPrice", 0)
                    sell = sjc_item.get("sellingPrice", 0)
                    sell_change = sjc_item.get("sellChange", 0)
                    date_time = sjc_item.get("dateTime", f"{today_display} {current_time_str}")
                    
                    def fmt(n: float) -> str:
                        try:
                            return f"{int(n):,.0f}đ".replace(",", ".")
                        except Exception:
                            return str(n)
                    
                    def fmt_change(n: float) -> str:
                        try:
                            val = int(n)
                            arrow = "▲" if val > 0 else ("▼" if val < 0 else "—")
                            return f"{arrow} {abs(val):,}đ".replace(",", ".")
                        except Exception:
                            return ""
                    
                    change_str = fmt_change(sell_change)
                    change_note = f" ({change_str} so với phiên trước)" if change_str else ""

                    extra = ""
                    bullets = [
                        f"Vàng SJC: Mua vào {fmt(buy)} – Bán ra {fmt(sell)}{change_note}."
                    ]
                    if vang_999:
                        v999_buy = vang_999.get('buyingPrice', 0)
                        v999_sell = vang_999.get('sellingPrice', 0)
                        extra = f" Nhẫn Vàng 9999: Mua {fmt(v999_buy)} – Bán {fmt(v999_sell)}."
                        bullets.append(f"Vàng 9999: Mua {fmt(v999_buy)} – Bán {fmt(v999_sell)}.")
                    bullets.append(f"Thời gian niêm yết: {date_time} (Mi Hồng).")

                    title = f"Giá vàng Mi Hồng hôm nay {today_display} [{date_time}]: SJC Mua {fmt(buy)} – Bán {fmt(sell)}"
                    summary = (
                        f"Giá vàng Mi Hồng cập nhật lúc {date_time} ngày {today_display}: "
                        f"Vàng SJC mua vào {fmt(buy)}, bán ra {fmt(sell)}{change_note}.{extra}"
                    )
                    return _make_gold_article(title, summary, bullets, today_str, now_vn)

    except Exception as e:
        logger.warning(f"Mi Hồng API lỗi: {e}")

    # Fallback
    title = f"Giá vàng Mi Hồng hôm nay {today_display} [{current_time_str}]"
    summary = f"Giá vàng Mi Hồng ngày {today_display} đang cập nhật phiên giao dịch mới nhất lúc {current_time_str}."
    bullets = [f"Cập nhật lúc: {current_time_str}"]
    return _make_gold_article(title, summary, bullets, today_str, now_vn)

def _make_gold_article(title: str, summary: str, bullets: List[str], date_str: str, now_vn: datetime) -> Dict[str, Any]:
    return {
        "url": "special://gold-price/current",
        "title": title,
        "source_name": "Giá vàng Mi Hồng",
        "source_domain": "mihong.com",
        "source_tier": 1.0,
        "region": "vietnam",
        "category": "special",
        "summary_short": summary,
        "summary_bullets": bullets,
        "content_raw": summary,
        "image_url": "https://cdn-icons-png.flaticon.com/512/2933/2933279.png",
        "tags": ["giá vàng", "mi hồng", "sjc", "tài chính"],
        "published_at": now_vn.isoformat(),
        "hot_score": 9998.0,
        "velocity_score": 0.0,
        "badge": "special",
        "is_spam": False,
        "is_primary": True,
        "special_type": "gold",
        "special_date": date_str,
    }

async def upsert_special_feeds(storage) -> None:
    """
    Lấy và cập nhật (upsert) 2 tin đặc biệt:
    1. Thời tiết TP.HCM (Hôm nay D & Ngày mai D+1 theo giờ)
    2. Giá vàng Mi Hồng (cập nhật theo giờ)
    - Tự động xóa sạch các bài viết thời tiết/giá vàng ngày cũ
    - Xóa audio cache cũ của bài đặc biệt để TTS đọc giờ và số liệu mới nhất
    """
    feeds = []

    weather = await fetch_weather_hcmc()
    if weather:
        feeds.append(weather)
        logger.info(f"[SpecialFeed] Thời tiết: {weather['title']}")
    else:
        logger.warning("[SpecialFeed] Không lấy được thời tiết TP.HCM")

    gold = await fetch_gold_price()
    if gold:
        feeds.append(gold)
        logger.info(f"[SpecialFeed] Giá vàng: {gold['title']}")
    else:
        logger.warning("[SpecialFeed] Không lấy được giá vàng SJC")

    now_vn = datetime.now(timezone(timedelta(hours=7)))
    today_str = now_vn.strftime("%Y-%m-%d")
    audio_dir = settings.DATA_FILE.parent / "audio_cache"

    for feed in feeds:
        url = feed["url"]
        special_type = feed.get("special_type", "")

        # 1. Xóa toàn bộ các bài viết thời tiết / giá vàng của NGÀY CŨ
        old_articles = [
            a for a in storage.articles
            if (a.get("special_type") == special_type or a.get("category") == "special" and special_type in a.get("url", ""))
            and a.get("special_date", "") != today_str
        ]
        for old in old_articles:
            old_id = old.get("id")
            # Xóa audio cache của bài cũ
            if audio_dir.exists() and old_id:
                for f in audio_dir.glob(f"*_{old_id}_*.mp3"):
                    try:
                        f.unlink(missing_ok=True)
                    except Exception:
                        pass
            storage.update_article(old_id, {"is_spam": True, "hot_score": -1.0, "published_at": "2000-01-01T00:00:00"})

        # 2. Cập nhật bài hiện tại
        existing_id = storage._url_index.get(url)
        if existing_id:
            storage.update_article(existing_id, {
                "title": feed["title"],
                "summary_short": feed["summary_short"],
                "summary_bullets": feed.get("summary_bullets", []),
                "content_raw": feed.get("content_raw", ""),
                "published_at": feed["published_at"],
                "hot_score": feed["hot_score"],
                "is_spam": False,
                "special_date": today_str
            })
            # Xóa audio cache để khi bấm nghe sẽ sinh audio mới theo giờ mới
            if audio_dir.exists():
                for f in audio_dir.glob(f"*_{existing_id}_*.mp3"):
                    try:
                        f.unlink(missing_ok=True)
                    except Exception:
                        pass
            logger.info(f"[SpecialFeed] Đã cập nhật theo giờ: {url}")
        else:
            new_art = storage.add_article(feed)
            logger.info(f"[SpecialFeed] Đã thêm mới: {url} (ID: {new_art.get('id')})")
