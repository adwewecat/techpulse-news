from typing import List, Dict, Any

NEWS_SOURCES: List[Dict[str, Any]] = [
    # =========================================================================
    # 1. CHUYÊN MỤC: TIN A.I, TRÍ TUỆ NHÂN TẠO & CÔNG NGHỆ (ai_tech)
    # =========================================================================
    {
        "id": "vnexpress_ai",
        "name": "VnExpress AI",
        "domain": "vnexpress.net",
        "url": "https://vnexpress.net/rss/ai.rss",
        "region": "vietnam",
        "category": "tech_vn",
        "crawl_type": "ai_tech",
        "tier": 1.6,
    },
    {
        "id": "vietnamnet_ai",
        "name": "VietnamNet AI & Tech",
        "domain": "vietnamnet.vn",
        "url": "https://vietnamnet.vn/rss/thong-tin-truyen-thong.rss",
        "region": "vietnam",
        "category": "tech_vn",
        "crawl_type": "ai_tech",
        "tier": 1.5,
    },
    {
        "id": "venturebeat_ai",
        "name": "VentureBeat AI",
        "domain": "venturebeat.com",
        "url": "https://venturebeat.com/category/ai/feed/",
        "region": "world",
        "category": "tech_world",
        "crawl_type": "ai_tech",
        "tier": 1.6,
    },
    {
        "id": "mit_tech_ai",
        "name": "MIT Technology Review AI",
        "domain": "technologyreview.com",
        "url": "https://www.technologyreview.com/feed/",
        "region": "world",
        "category": "tech_world",
        "crawl_type": "ai_tech",
        "tier": 1.6,
    },
    {
        "id": "techcrunch_ai",
        "name": "TechCrunch AI",
        "domain": "techcrunch.com",
        "url": "https://techcrunch.com/category/artificial-intelligence/feed/",
        "region": "world",
        "category": "tech_world",
        "crawl_type": "ai_tech",
        "tier": 1.6,
    },
    {
        "id": "openai_news",
        "name": "OpenAI News & Research",
        "domain": "openai.com",
        "url": "https://openai.com/news/rss.xml",
        "region": "world",
        "category": "tech_world",
        "crawl_type": "ai_tech",
        "tier": 1.7,
    },
    {
        "id": "arstechnica_techlab",
        "name": "Ars Technica Tech & AI",
        "domain": "arstechnica.com",
        "url": "https://feeds.arstechnica.com/arstechnica/technology-lab",
        "region": "world",
        "category": "tech_world",
        "crawl_type": "ai_tech",
        "tier": 1.5,
    },
    {
        "id": "vnexpress_sohoa",
        "name": "VnExpress Số Hóa & Tech",
        "domain": "vnexpress.net",
        "url": "https://vnexpress.net/rss/khoa-hoc-cong-nghe.rss",
        "region": "vietnam",
        "category": "tech_vn",
        "crawl_type": "ai_tech",
        "tier": 1.5,
    },
    {
        "id": "tuoitre_khoahoc",
        "name": "Tuổi Trẻ Khoa Học & Tech",
        "domain": "tuoitre.vn",
        "url": "https://tuoitre.vn/rss/khoa-hoc.rss",
        "region": "vietnam",
        "category": "tech_vn",
        "crawl_type": "ai_tech",
        "tier": 1.4,
    },
    {
        "id": "genk_tech",
        "name": "GenK Công Nghệ",
        "domain": "genk.vn",
        "url": "https://genk.vn/index.rss",
        "region": "vietnam",
        "category": "tech_vn",
        "crawl_type": "ai_tech",
        "tier": 1.4,
    },
    {
        "id": "theverge_tech",
        "name": "The Verge",
        "domain": "theverge.com",
        "url": "https://www.theverge.com/rss/index.xml",
        "region": "world",
        "category": "tech_world",
        "crawl_type": "ai_tech",
        "tier": 1.5,
    },
    {
        "id": "wired_tech",
        "name": "Wired Tech",
        "domain": "wired.com",
        "url": "https://www.wired.com/feed/rss",
        "region": "world",
        "category": "tech_world",
        "crawl_type": "ai_tech",
        "tier": 1.4,
    },

    # =========================================================================
    # 2. CHUYÊN MỤC: TIN TỔNG HỢP HOT VIỆT NAM (hot_vn)
    # =========================================================================
    {
        "id": "vnexpress_tinmoi",
        "name": "VnExpress Tin Mới",
        "domain": "vnexpress.net",
        "url": "https://vnexpress.net/rss/tin-moi-nhat.rss",
        "region": "vietnam",
        "category": "hot_vn",
        "crawl_type": "hot_vn",
        "tier": 1.6,
    },
    {
        "id": "vnexpress_thoisu",
        "name": "VnExpress Thời Sự",
        "domain": "vnexpress.net",
        "url": "https://vnexpress.net/rss/thoi-su.rss",
        "region": "vietnam",
        "category": "hot_vn",
        "crawl_type": "hot_vn",
        "tier": 1.6,
    },
    {
        "id": "tuoitre_tinmoi",
        "name": "Tuổi Trẻ Tin Mới",
        "domain": "tuoitre.vn",
        "url": "https://tuoitre.vn/home.rss",
        "region": "vietnam",
        "category": "hot_vn",
        "crawl_type": "hot_vn",
        "tier": 1.5,
    },
    {
        "id": "dantri_sukien",
        "name": "Dân Trí Sự Kiện",
        "domain": "dantri.com.vn",
        "url": "https://dantri.com.vn/rss/su-kien.rss",
        "region": "vietnam",
        "category": "hot_vn",
        "crawl_type": "hot_vn",
        "tier": 1.4,
    },
    {
        "id": "thanhnien_thoisu",
        "name": "Thanh Niên Thời Sự",
        "domain": "thanhnien.vn",
        "url": "https://thanhnien.vn/rss/thoi-su.rss",
        "region": "vietnam",
        "category": "hot_vn",
        "crawl_type": "hot_vn",
        "tier": 1.4,
    },

    # =========================================================================
    # 3. CHUYÊN MỤC: TIN TỔNG HỢP HOT QUỐC TẾ (hot_world)
    # =========================================================================
    {
        "id": "vnexpress_thegioi",
        "name": "VnExpress Thế Giới",
        "domain": "vnexpress.net",
        "url": "https://vnexpress.net/rss/the-gioi.rss",
        "region": "world",
        "category": "hot_world",
        "crawl_type": "hot_world",
        "tier": 1.6,
    },
    {
        "id": "tuoitre_thegioi",
        "name": "Tuổi Trẻ Thế Giới",
        "domain": "tuoitre.vn",
        "url": "https://tuoitre.vn/rss/the-gioi.rss",
        "region": "world",
        "category": "hot_world",
        "crawl_type": "hot_world",
        "tier": 1.5,
    },
    {
        "id": "thanhnien_thegioi",
        "name": "Thanh Niên Thế Giới",
        "domain": "thanhnien.vn",
        "url": "https://thanhnien.vn/rss/the-gioi.rss",
        "region": "world",
        "category": "hot_world",
        "crawl_type": "hot_world",
        "tier": 1.4,
    },
    {
        "id": "bbc_vietnamese",
        "name": "BBC News Tiếng Việt",
        "domain": "bbc.com",
        "url": "https://www.bbc.com/vietnamese/index.xml",
        "region": "world",
        "category": "hot_world",
        "crawl_type": "hot_world",
        "tier": 1.6,
    },
    {
        "id": "dantri_thegioi",
        "name": "Dân Trí Thế Giới",
        "domain": "dantri.com.vn",
        "url": "https://dantri.com.vn/rss/the-gioi.rss",
        "region": "world",
        "category": "hot_world",
        "crawl_type": "hot_world",
        "tier": 1.4,
    },
    {
        "id": "bbc_world_en",
        "name": "BBC World News",
        "domain": "bbc.co.uk",
        "url": "http://feeds.bbci.co.uk/news/world/rss.xml",
        "region": "world",
        "category": "hot_world",
        "crawl_type": "hot_world",
        "tier": 1.6,
    }
]

def get_sources_for_mode(mode: str = "all") -> List[Dict[str, Any]]:
    """Lấy danh sách nguồn tin tương ứng theo loại quét được chọn"""
    clean_mode = (mode or "all").lower().strip()
    if clean_mode == "ai_tech":
        return [s for s in NEWS_SOURCES if s.get("crawl_type") == "ai_tech"]
    elif clean_mode == "hot_vn":
        return [s for s in NEWS_SOURCES if s.get("crawl_type") == "hot_vn"]
    elif clean_mode == "hot_world":
        return [s for s in NEWS_SOURCES if s.get("crawl_type") == "hot_world"]
    elif clean_mode == "trending":
        # Trending: lấy nguồn nóng nhất cả VN và Quốc Tế + AI
        return [s for s in NEWS_SOURCES if s.get("tier", 1.0) >= 1.5]
    return NEWS_SOURCES
