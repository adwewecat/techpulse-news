export interface RelatedArticle {
  id: number;
  title: string;
  url: string;
  source_name: string;
  source_domain: string;
  published_at: string;
}

export interface Article {
  id: number;
  cluster_id?: number | null;
  title: string;
  slug?: string | null;
  url: string;
  source_name: string;
  source_domain: string;
  source_tier: number;
  region: 'vietnam' | 'world';
  category: 'hot_vn' | 'tech_vn' | 'tech_world' | 'special';
  summary_short?: string | null;
  summary_bullets: string[];
  image_url?: string | null;
  tags: string[];
  published_at: string;
  created_at: string;
  view_count: number;
  click_count: number;
  hot_score: number;
  velocity_score: number;
  badge: 'hot' | 'trending' | 'new' | 'normal' | 'special';
  is_spam: boolean;
  is_primary: boolean;
  is_starred?: boolean;
  deep_analysis?: string | null;
  related_sources_count: number;
  related_articles: RelatedArticle[];
}

export interface DeepAnalysisPerspective {
  source: string;
  perspective: string;
}

export interface DeepAnalysisImpacts {
  short_term: string;
  long_term: string;
}

export interface DeepAnalysisResponse {
  article_id: number;
  title: string;
  source_name: string;
  url: string;
  overview: string;
  key_facts: string[];
  multi_source_perspectives: DeepAnalysisPerspective[];
  deep_analysis: string;
  impacts: DeepAnalysisImpacts;
  unanswered_questions: string[];
  actionable_takeaway: string;
  related_articles: RelatedArticle[];
  generated_at: string;
}

export interface ReadHistoryItem {
  id: number;
  readAt: number; // epoch ms
}

export interface NewsListResponse {
  items: Article[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface CrawlLog {
  id: number;
  started_at: string;
  finished_at?: string | null;
  sources_crawled: number;
  articles_found: number;
  articles_new: number;
  status: string;
  error_message?: string | null;
}

export interface CrawlStatus {
  is_running: boolean;
  last_run?: string | null;
  next_run?: string | null;
  sources_count: number;
  total_articles: number;
  last_log?: CrawlLog | null;
}

export interface StatsOverview {
  total_articles: number;
  vietnam_hot: number;
  vietnam_tech: number;
  world_tech: number;
  hot_now_count: number;
  trending_count: number;
  top_sources: { source: string; count: number }[];
}

export type MainTab = 'all' | 'vietnam' | 'world' | 'top6h' | 'trending';
