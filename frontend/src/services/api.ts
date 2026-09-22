import type { Article, NewsListResponse, CrawlStatus, StatsOverview } from '../types/news';

const rawBase = (import.meta.env.VITE_API_BASE_URL || '/api').trim().replace(/\/+$/, '');
export const API_BASE = rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`;

export async function fetchNews(params: {
  region?: string;
  category?: string;
  badge?: string;
  tag?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<NewsListResponse> {
  const query = new URLSearchParams();
  if (params.region) query.set('region', params.region);
  if (params.category) query.set('category', params.category);
  if (params.badge) query.set('badge', params.badge);
  if (params.tag) query.set('tag', params.tag);
  if (params.search) query.set('search', params.search);
  query.set('page', String(params.page || 1));
  query.set('limit', String(params.limit || 20));

  const res = await fetch(`${API_BASE}/news?${query.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchTop6hNews(region?: string, limit: number = 10): Promise<Article[]> {
  const query = new URLSearchParams();
  if (region) query.set('region', region);
  query.set('limit', String(limit));

  const res = await fetch(`${API_BASE}/news/top-6h?${query.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchTrendingNews(region?: string, limit: number = 10): Promise<Article[]> {
  const query = new URLSearchParams();
  if (region) query.set('region', region);
  query.set('limit', String(limit));

  const res = await fetch(`${API_BASE}/news/trending?${query.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchArticleDetail(id: number): Promise<Article> {
  const res = await fetch(`${API_BASE}/news/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function recordArticleClick(id: number): Promise<{ click_count: number; hot_score: number }> {
  try {
    const res = await fetch(`${API_BASE}/news/${id}/click`, { method: 'POST' });
    if (!res.ok) return { click_count: 0, hot_score: 0 };
    return res.json();
  } catch {
    return { click_count: 0, hot_score: 0 };
  }
}

export async function triggerCrawlNow(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/collector/trigger`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchCrawlStatus(): Promise<CrawlStatus> {
  const res = await fetch(`${API_BASE}/collector/status`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchStats(): Promise<StatsOverview> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function toggleStarArticle(id: number, starred?: boolean): Promise<{ 
  status: string; 
  article_id: number; 
  is_starred: boolean;
  article?: Article;
}> {
  const query = starred !== undefined ? `?starred=${starred}` : '';
  const res = await fetch(`${API_BASE}/news/${id}/star${query}`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchStarredNews(): Promise<Article[]> {
  const res = await fetch(`${API_BASE}/news/starred`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchDeepAnalysis(id: number, forceRefresh: boolean = false): Promise<import('../types/news').DeepAnalysisResponse> {
  const query = forceRefresh ? '?force_refresh=true' : '';
  const res = await fetch(`${API_BASE}/news/${id}/deep-analysis${query}`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function cleanupReadData(days: number = 30): Promise<{ status: string; deleted_articles: number; message: string }> {
  const res = await fetch(`${API_BASE}/news/cleanup-read?days=${days}`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

