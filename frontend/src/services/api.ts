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

const USER_ID_KEY = 'tech_pulse_user_id_v1';

export function getOrCreateUserId(): string {
  try {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      const rnd = Math.random().toString(36).substring(2, 9);
      const ts = Date.now().toString(36);
      id = `usr_${ts}_${rnd}`;
      localStorage.setItem(USER_ID_KEY, id);
    }
    return id;
  } catch {
    return 'usr_guest_cache';
  }
}

export async function fetchTop6hNews(
  region?: string,
  limit: number = 30,
  userId?: string,
  excludeRead: boolean = true
): Promise<Article[]> {
  const query = new URLSearchParams();
  if (region) query.set('region', region);
  query.set('limit', String(limit));
  if (userId) {
    query.set('user_id', userId);
    query.set('exclude_read', String(excludeRead));
  }

  const res = await fetch(`${API_BASE}/news/top-6h?${query.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function markUserReadApi(userId: string, articleId: number): Promise<void> {
  try {
    await fetch(`${API_BASE}/news/user/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, article_id: articleId }),
    });
  } catch (e) {
    console.warn('Failed to sync mark read to backend:', e);
  }
}

export async function markUserUnreadApi(userId: string, articleId: number): Promise<void> {
  try {
    await fetch(`${API_BASE}/news/user/unread`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, article_id: articleId }),
    });
  } catch (e) {
    console.warn('Failed to sync mark unread to backend:', e);
  }
}

export async function syncUserReadsApi(userId: string, readIds: number[]): Promise<number[]> {
  try {
    const res = await fetch(`${API_BASE}/news/user/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, read_ids: readIds }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.read_ids || [];
    }
  } catch (e) {
    console.warn('Failed to sync reads with backend:', e);
  }
  return readIds;
}

export async function clearUserReadsApi(userId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/news/user/reads?user_id=${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    });
  } catch (e) {
    console.warn('Failed to clear reads on backend:', e);
  }
}

export async function fetchUserReadArticles(userId: string, limit: number = 50): Promise<Article[]> {
  try {
    const res = await fetch(`${API_BASE}/news/user/read-articles?user_id=${encodeURIComponent(userId)}&limit=${limit}`);
    if (!res.ok) return [];
    return res.json();
  } catch (e) {
    console.warn('Failed to fetch user read articles:', e);
    return [];
  }
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

export async function cleanupReadData(days: number = 3): Promise<{ status: string; deleted_articles: number; message: string }> {
  const res = await fetch(`${API_BASE}/news/cleanup-read?days=${days}`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface PronunciationItem {
  original: string;
  replacement: string;
}

export async function fetchPronunciationDictionary(): Promise<{ dictionary: PronunciationItem[]; total: number }> {
  const res = await fetch(`${API_BASE}/tts/dictionary`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function addOrUpdatePronunciationWord(original: string, replacement: string): Promise<{ status: string; dictionary: PronunciationItem[]; total: number }> {
  const res = await fetch(`${API_BASE}/tts/dictionary/word`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ original, replacement }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deletePronunciationWord(original: string): Promise<{ status: string; dictionary: PronunciationItem[]; total: number }> {
  const res = await fetch(`${API_BASE}/tts/dictionary/word/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ original }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function resetPronunciationDictionary(): Promise<{ status: string; dictionary: PronunciationItem[]; total: number }> {
  const res = await fetch(`${API_BASE}/tts/dictionary/reset`, { method: 'POST' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function previewPronunciationAudio(text: string, voice?: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/tts/dictionary/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

