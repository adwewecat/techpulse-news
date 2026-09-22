"""
Special Feeds: Thời tiết TP.HCM D+1 & Giá vàng SJC hôm nay
Mỗi loại chỉ cần 1 tin/ngày, cập nhật theo chu kỳ crawl.
"""
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

import httpx

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
    "Partly cloudy": "Nhiều mây",
    "Cloudy": "Nhiều mây",
    "Overcast": "Trời âm u",
    "Mist": "Sương mù",
    "Fog": "Sương mù",
    "Light rain": "Mưa nhỏ",
    "Moderate rain": "Mưa vừa",
    "Heavy rain": "Mưa lớn",
    "Patchy rain possible": "Có thể có mưa rải rác",
    "Light drizzle": "Mưa phùn",
    "Thundery outbreaks possible": "Có thể có dông",
    "Blowing snow": "Tuyết",
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
    for eng, vi in WEATHER_DESCS.items():
        if eng.lower() in desc.lower():
            return vi
    return desc

async def fetch_weather_hcmc() -> Optional[Dict[str, Any]]:
    """
    Lấy thời tiết TP.HCM cho ngày mai từ wttr.in (miễn phí, không cần API key).
    Trả về dict bài viết dạng article, hoặc None nếu lỗi.
    """
    url = "https://wttr.in/Ho+Chi+Minh+City?format=j1"
    now_vn = datetime.now(timezone(timedelta(hours=7)))
    tomorrow_vn = now_vn + timedelta(days=1)
    tomorrow_date_str = tomorrow_vn.strftime("%d/%m/%Y")
    tomorrow_weekday = VN_WEEKDAYS[tomorrow_vn.weekday()]

    try:
        async with httpx.AsyncClient(timeout=10.0, headers=HEADERS) as client:
            res = await client.get(url)
            if res.status_code != 200:
                logger.warning(f"wttr.in trả về HTTP {res.status_code}")
                return None
            data = res.json()

        weather = data.get("weather", [])
        # weather[0] = hôm nay, weather[1] = ngày mai
        tomorrow_weather = weather[1] if len(weather) > 1 else (weather[0] if weather else None)
        if not tomorrow_weather:
            return None

        hourly = tomorrow_weather.get("hourly", [])
        # Lấy buổi sáng (6h), trưa (12h), chiều tối (18h)
        temp_max = tomorrow_weather.get("maxtempC", "?")
        temp_min = tomorrow_weather.get("mintempC", "?")
        # Lấy % mưa trung bình các khung giờ
        rain_pcts = []
        desc_parts = []
        for h in hourly:
            pct = h.get("chanceofrain", "0")
            try:
                rain_pcts.append(int(pct))
            except Exception:
                pass
            desc_raw = ""
            if h.get("weatherDesc"):
                desc_raw = h["weatherDesc"][0].get("value", "") if h["weatherDesc"] else ""
            if desc_raw:
                desc_parts.append(desc_raw)

        avg_rain = int(sum(rain_pcts) / len(rain_pcts)) if rain_pcts else 0
        # Lấy mô tả phổ biến nhất
        from collections import Counter
        top_desc = Counter(desc_parts).most_common(1)[0][0] if desc_parts else "Nhiều mây"
        top_desc_vi = _translate_weather(top_desc)

        # Lấy UV index và độ ẩm trưa
        noon_hourly = next((h for h in hourly if h.get("time") == "1200"), hourly[len(hourly)//2] if hourly else {})
        humidity = noon_hourly.get("humidity", "?")
        uv_index = tomorrow_weather.get("uvIndex", "?")

        # Cấu trúc cảnh báo mưa
        if avg_rain >= 70:
            rain_note = f"Xác suất mưa cao ({avg_rain}%), nhớ mang theo áo mưa."
        elif avg_rain >= 40:
            rain_note = f"Có thể có mưa rào ({avg_rain}%), nên đề phòng."
        else:
            rain_note = f"Ít khả năng mưa ({avg_rain}%)."

        title = f"Thời tiết TP.HCM {tomorrow_weekday} {tomorrow_date_str}: {top_desc_vi}, {temp_min}–{temp_max}°C"
        summary = (
            f"{top_desc_vi}, nhiệt độ từ {temp_min}°C đến {temp_max}°C. "
            f"Độ ẩm {humidity}%, chỉ số UV {uv_index}. "
            f"{rain_note}"
        )

        today_str = now_vn.strftime("%Y-%m-%d")
        return {
            "url": f"special://weather-hcmc/{today_str}",
            "title": title,
            "source_name": "Dự báo thời tiết TP.HCM",
            "source_domain": "wttr.in",
            "source_tier": 1.0,
            "region": "vietnam",
            "category": "special",
            "summary_short": summary,
            "summary_bullets": [],
            "content_raw": summary,
            "image_url": "https://cdn-icons-png.flaticon.com/512/1163/1163661.png",
            "tags": ["thời tiết", "tp.hcm", "dự báo"],
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
    Lấy giá vàng Mi Hồng hôm nay từ API chính thức: api.mihong.com
    Trả về dict article, hoặc None nếu lỗi.
    """
    now_vn = datetime.now(timezone(timedelta(hours=7)))
    today_str = now_vn.strftime("%Y-%m-%d")
    today_display = now_vn.strftime("%d/%m/%Y")

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
                    # Lấy dữ liệu vàng SJC (ưu tiên) hoặc dòng đầu
                    sjc_item = next((x for x in data if x.get("code") == "SJC"), data[0])
                    vang_999 = next((x for x in data if x.get("code") == "999"), None)
                    
                    buy = sjc_item.get("buyingPrice", 0)
                    sell = sjc_item.get("sellingPrice", 0)
                    sell_change = sjc_item.get("sellChange", 0)
                    date_time = sjc_item.get("dateTime", today_display)
                    
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

                    # Thêm vàng 999 nếu có
                    extra = ""
                    if vang_999:
                        extra = f" Vàng 9999: Mua {fmt(vang_999.get('buyingPrice', 0))} – Bán {fmt(vang_999.get('sellingPrice', 0))}."

                    title = f"Giá vàng Mi Hồng hôm nay {today_display}: SJC Mua {fmt(buy)} – Bán {fmt(sell)}"
                    summary = (
                        f"Giá vàng Mi Hồng cập nhật lúc {date_time}: "
                        f"Vàng SJC mua vào {fmt(buy)}, bán ra {fmt(sell)}{change_note}.{extra}"
                    )
                    return _make_gold_article(title, summary, today_str, now_vn, "mihong.com")

    except Exception as e:
        logger.warning(f"Mi Hồng API lỗi: {e}")

    # Fallback: thông báo không lấy được
    title = f"Giá vàng Mi Hồng hôm nay {today_display}"
    summary = f"Giá vàng Mi Hồng ngày {today_display} đang cập nhật. Truy cập mihong.com để xem giá mới nhất."
    return _make_gold_article(title, summary, today_str, now_vn, "mihong.com")


def _make_gold_article(title: str, summary: str, date_str: str, now_vn: datetime, source_domain: str = "mihong.com") -> Dict[str, Any]:
    return {
        "url": f"special://gold-price/{date_str}",
        "title": title,
        "source_name": "Giá vàng Mi Hồng",
        "source_domain": source_domain,
        "source_tier": 1.0,
        "region": "vietnam",
        "category": "special",
        "summary_short": summary,
        "summary_bullets": [],
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
    Lấy và cập nhật (upsert) 2 tin đặc biệt: thời tiết D+1 và giá vàng hôm nay.
    - Nếu bài viết với URL đặc biệt đã tồn tại → cập nhật nội dung
    - Nếu chưa có → tạo mới (và xóa bài cũ cùng loại ngày trước)
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

    for feed in feeds:
        url = feed["url"]
        special_type = feed.get("special_type", "")
        today_date = feed.get("special_date", "")

        if storage.exists_url(url):
            # Cập nhật bài đã có (cùng ngày)
            existing_id = storage._url_index.get(url)
            if existing_id:
                storage.update_article(existing_id, {
                    "title": feed["title"],
                    "summary_short": feed["summary_short"],
                    "content_raw": feed.get("content_raw", ""),
                    "published_at": feed["published_at"],
                    "hot_score": feed["hot_score"],
                })
                logger.info(f"[SpecialFeed] Đã cập nhật: {url}")
        else:
            # Xóa bài cũ cùng loại (ngày khác) trước khi thêm bài mới
            if special_type:
                old_articles = [
                    a for a in storage.articles
                    if a.get("special_type") == special_type
                    and a.get("special_date", "") != today_date
                ]
                for old in old_articles:
                    old_url = old.get("url", "")
                    # Đánh dấu spam để loại khỏi danh sách hiển thị
                    storage.update_article(old["id"], {"is_spam": True, "hot_score": -1.0})
                    logger.info(f"[SpecialFeed] Ẩn bài cũ: {old_url}")

            storage.add_article(feed)
            logger.info(f"[SpecialFeed] Đã thêm mới: {url}")

