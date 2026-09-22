import re
import math
import logging
from typing import Tuple, List, Optional
from collections import Counter
from app.core.config import settings

logger = logging.getLogger("ai_processor")

# Khởi tạo Gemini Client nếu có API key
gemini_client = None
if settings.GEMINI_API_KEY:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        logger.info("Đã kết nối Gemini API Client thành công!")
    except Exception as e:
        logger.warning(f"Không thể khởi tạo Gemini Client: {e}")

# Danh sách từ khóa tin rác / PR quảng cáo / mua bán
SPAM_KEYWORDS = [
    "khuyến mãi", "săn sale", "giảm giá sốc", "voucher", "mua ngay", 
    "bán đất", "bất động sản", "căn hộ cao cấp", "vay vốn nhanh", 
    "lãi suất 0%", "soi cầu", "cá cược", "đánh bạc", "casino", 
    "nạp thẻ", "kiếm tiền online tại nhà", "tuyển đại lý", "shopee sale",
    "lazada sale", "tiktok shop sale", "xả kho", "thanh lý giá rẻ"
]

# Từ khóa công nghệ & sự kiện nổi bật để auto-tag
TECH_TAG_PATTERNS = {
    "Trí tuệ nhân tạo (AI)": [r"\bai\b", r"trí tuệ nhân tạo", r"chatgpt", r"openai", r"gemini", r"copilot", r"llm", r"deep learning", r"claude", r"machine learning", r"model", r"genai"],
    "Bán dẫn & Chip": [r"bán dẫn", r"vi mạch", r"chipset", r"nvidia", r"tsmc", r"intel", r"qualcomm", r"amd", r"snapdragon", r"bán dẫn"],
    "Apple & iOS": [r"apple", r"iphone", r"ipad", r"macbook", r"ios", r"tim cook", r"airpods"],
    "Google & Android": [r"google", r"android", r"pixel", r"alphabet", r"sundar pichai"],
    "Microsoft & Windows": [r"microsoft", r"windows", r"satya nadella", r"azure"],
    "VinFast & Xe điện": [r"vinfast", r"xe điện", r"ev", r"tesla", r"byd", r"pin xe điện"],
    "Công nghệ Việt Nam": [r"viettel", r"fpt", r"vnpt", r"vng", r"bphone", r"chuyển đổi số", r"make in vietnam"],
    "An ninh mạng & Bảo mật": [r"an ninh mạng", r"hacker", r"mã độc", r"tấn công mạng", r"lừa đảo", r"ransomware", r"lộ dữ liệu", r"bảo mật"],
    "Startup & Đầu tư": [r"startup", r"khởi nghiệp", r"gọi vốn", r"unicorn", r"kỳ lân", r"vốn đầu tư", r"ipo"],
    "Smartphone & Thiết bị": [r"smartphone", r"điện thoại", r"samsung galaxy", r"xiaomi", r"camera", r"tai nghe"],
    "Khoa học & Vũ trụ": [r"nasa", r"spacex", r"vũ trụ", r"kính thiên văn", r"thiên văn học"],
    "Blockchain & Web3": [r"blockchain", r"crypto", r"bitcoin", r"ethereum"],
}

def is_spam_content(title: str, text: str = "") -> bool:
    content = f"{title} {text}".lower()
    for kw in SPAM_KEYWORDS:
        if kw in content:
            return True
    phone_pattern = re.findall(r"(?:0|\+84)[1-9][0-9]{8,9}", content)
    if len(phone_pattern) >= 2:
        return True
    return False

def extract_tags(title: str, text: str = "") -> List[str]:
    content = f"{title} {text}".lower()
    matched_tags = []
    for tag_name, patterns in TECH_TAG_PATTERNS.items():
        for pat in patterns:
            if re.search(pat, content, re.IGNORECASE):
                matched_tags.append(tag_name)
                break
    return matched_tags[:5]

def clean_sentence_dots(s: str) -> str:
    s = s.strip()
    s = re.sub(r'[\s.…]+$', '', s)
    if s and not s.endswith(('.', '!', '?')):
        s += '.'
    return s

def split_sentences(text: str) -> List[str]:
    raw_sentences = re.split(r'(?<=[.!?])\s+', text)
    clean_sentences = []
    for s in raw_sentences:
        s_clean = s.strip()
        if len(s_clean) > 25 and not s_clean.startswith("http"):
            clean_sentences.append(clean_sentence_dots(s_clean))
    return clean_sentences

def summarize_with_gemini(title: str, text: str) -> Tuple[Optional[str], Optional[List[str]]]:
    """
    Sinh bản tóm tắt sâu sắc, mạch lạc và giàu ngữ cảnh bằng Gemini 3.6 Flash.
    """
    if not gemini_client:
        return None, None

    prompt = f"""Bạn là biên tập viên tin tức công nghệ và thời sự chuyên nghiệp. Hãy đọc thông tin sau và thực hiện 2 việc:
1. Tóm tắt chi tiết, mạch lạc, giàu ngữ cảnh bằng tiếng Việt (khoảng 3 đến 4 câu văn hoàn chỉnh). Nêu rõ sự việc diễn ra thế nào, các tổ chức hoặc nhân vật liên quan, số liệu cụ thể và tại sao tin tức này quan trọng để người nghe hiểu rõ bản chất vấn đề.
2. Liệt kê 3 điểm cốt lõi quan trọng nhất.

Tiêu đề: {title}
Nội dung: {text[:2500]}

Định dạng trả về chính xác theo mẫu:
[TÓM TẮT]
<3-4 câu văn tóm tắt mạch lạc>
[ĐIỂM CỐT LÕI]
- <Ý 1>
- <Ý 2>
- <Ý 3>
"""

    try:
        response = gemini_client.models.generate_content(
            model="gemini-3.6-flash",
            contents=prompt,
        )
        output = response.text or ""
        
        tldr = ""
        bullets = []

        if "[TÓM TẮT]" in output:
            parts = output.split("[TÓM TẮT]")[1]
            if "[ĐIỂM CỐT LÕI]" in parts:
                tldr_part, bullets_part = parts.split("[ĐIỂM CỐT LÕI]")
                tldr = tldr_part.strip()
                for line in bullets_part.strip().split("\n"):
                    line_clean = line.strip().lstrip("-*•0123456789. ")
                    if len(line_clean) > 10:
                        bullets.append(line_clean)
            else:
                tldr = parts.strip()

        if tldr and len(tldr) > 50:
            if not bullets:
                bullets = [b for b in split_sentences(tldr)[:3]]
            return tldr, bullets[:3]

    except Exception as e:
        logger.warning(f"Lỗi gọi Gemini Summarizer: {e}")

    return None, None

def extractive_summarize(title: str, text: str) -> Tuple[str, List[str]]:
    """
    Thuật toán tóm tắt thông minh Extractive NLP nội bộ (dự phòng khi không có mạng/API LLM)
    Cung cấp tóm tắt 3 câu đầy đủ ngữ cảnh.
    """
    if not text:
        return title, [title]

    sentences = split_sentences(text)
    if not sentences:
        return title, [title]
    return None, None

def extractive_summarize(title: str, text: str) -> Tuple[str, List[str]]:
    """
    Thuật toán tóm tắt thông minh Extractive NLP nội bộ (dự phòng khi không có mạng/API LLM)
    Cung cấp tóm tắt 3 câu đầy đủ ngữ cảnh.
    """
    if not text:
        return title, [title]

    sentences = split_sentences(text)
    if not sentences:
        return title, [title]

    if len(sentences) <= 3:
        tldr = " ".join(sentences)
        return tldr, sentences

    words = re.findall(r'\w+', f"{title} {text}".lower())
    stopwords = {
        "và", "của", "cho", "là", "trong", "với", "các", "những", "đã", "đang", 
        "sẽ", "được", "có", "này", "đó", "theo", "tại", "từ", "về", "như", 
        "khi", "người", "đến", "the", "and", "is", "in", "to", "of", "for", "with", "on"
    }
    filtered_words = [w for w in words if len(w) > 2 and w not in stopwords]
    freq = Counter(filtered_words)
    max_freq = max(freq.values()) if freq else 1

    title_words = set(re.findall(r'\w+', title.lower())) - stopwords

    sentence_scores = []
    for idx, sentence in enumerate(sentences):
        score = 0.0
        s_words = re.findall(r'\w+', sentence.lower())
        if not s_words:
            sentence_scores.append((idx, 0.0, sentence))
            continue

        tf_sum = sum(freq.get(w, 0) / max_freq for w in s_words)
        score += tf_sum / len(s_words)

        overlap_title = len(set(s_words) & title_words)
        score += overlap_title * 0.8

        if re.search(r'\d+', sentence):
            score += 0.6

        position_weight = 1.0 / math.sqrt(idx + 1)
        score *= (0.7 + 0.3 * position_weight)

        sentence_scores.append((idx, score, sentence))

    ranked_by_score = sorted(sentence_scores, key=lambda x: x[1], reverse=True)
    
    # Lấy top 3 câu có điểm số cao nhất xếp theo thứ tự xuất hiện làm bản tóm tắt 3 câu hoàn chỉnh
    top_3_indices = sorted([x[0] for x in ranked_by_score[:3]])
    tldr = " ".join([sentences[i] for i in top_3_indices])
    bullets = [sentences[i] for i in top_3_indices]

    return tldr, bullets

def process_article_ai(title: str, text: str, use_llm: bool = False) -> Tuple[bool, str, List[str], List[str]]:
    """
    Pipeline xử lý tin tức qua AI:
    1. Kiểm tra tin rác (Spam filter)
    2. Sinh tóm tắt chi tiết giàu ngữ cảnh
    """
    if is_spam_content(title, text):
        return True, "", [], []

    tldr = ""
    bullets = []
    if use_llm:
        tldr, bullets = summarize_with_gemini(title, text)

    if not tldr:
        tldr, bullets = extractive_summarize(title, text)

    tags = extract_tags(title, text)

    return False, tldr, bullets or [], tags
