import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  fetchTop6hNews, fetchTop20News, fetchCrawlStatus, fetchStats, 
  recordArticleClick, triggerCrawlNow, toggleStarArticle, cleanupReadData,
  getOrCreateUserId, markUserReadApi, markUserUnreadApi, syncUserReadsApi,
  clearUserReadsApi, fetchUserReadArticles, syncUserDataApi
} from './services/api';
import { VietnameseTTS } from './services/tts';
import type { Article, CrawlStatus, StatsOverview, CrawlMode, UserProfile } from './types/news';
import { Header } from './components/Header';
import { AudioPlayerBar, VOICE_OPTIONS } from './components/AudioPlayerBar';
import { VerticalNewsCard } from './components/VerticalNewsCard';
import { QuickReaderModal } from './components/QuickReaderModal';
import { DeepAnalysisModal } from './components/DeepAnalysisModal';
import { PronunciationModal } from './components/PronunciationModal';
import { AuthModal } from './components/AuthModal';
import { 
  Flame, CheckCheck, Sparkles, Star,
  RotateCcw, AlertCircle, CheckCircle2, Cpu
} from 'lucide-react';

const STORAGE_READ_ITEMS_KEY = 'tech_pulse_read_items_v2';
const STORAGE_STARRED_KEY = 'tech_pulse_starred_ids_v1';
const STORAGE_CURRENT_USER_KEY = 'tech_pulse_current_user_v1';
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000; // 48 giờ (2 ngày)

export type NewsCategoryMode = 'all' | 'ai_tech' | 'hot_vn' | 'hot_world' | 'trending';

export const App: React.FC = () => {
  // Anonymous guest user ID (no login required, auto-cached)
  const [guestUserId] = useState<string>(() => getOrCreateUserId());

  // Logged-in user state (null if guest)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CURRENT_USER_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Active user ID for data association and backend reads
  const activeUserId = currentUser ? currentUser.username : guestUserId;

  // Auth modal open state
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);

  // Pronunciation modal open state
  const [isPronunciationOpen, setIsPronunciationOpen] = useState<boolean>(false);

  // Category mode: 'all' (Top 30 6h) | 'ai_tech' (20 tin) | 'hot_vn' (20 tin) | 'hot_world' (20 tin) | 'trending' (20 tin)
  const [categoryMode, setCategoryMode] = useState<NewsCategoryMode>('all');

  // State for raw articles from backend
  const [topArticles, setTopArticles] = useState<Article[]>([]);
  // State for read articles fetched from backend
  const [readArticlesList, setReadArticlesList] = useState<Article[]>([]);

  // Starred article IDs
  const [starredIds, setStarredIds] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_STARRED_KEY);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Map of read article IDs to timestamp (readAt) - Tự động xóa tin đã đọc quá 48 giờ
  const [readMap, setReadMap] = useState<Map<number, number>>(() => {
    const map = new Map<number, number>();
    const now = Date.now();
    try {
      const saved = localStorage.getItem(STORAGE_READ_ITEMS_KEY);
      if (saved) {
        const items: { id: number; readAt: number }[] = JSON.parse(saved);
        items.forEach((it) => {
          if (now - it.readAt <= FORTY_EIGHT_HOURS_MS) {
            map.set(it.id, it.readAt);
          }
        });
      } else {
        const oldSaved = localStorage.getItem('tech_pulse_read_ids_v1');
        if (oldSaved) {
          const oldIds: number[] = JSON.parse(oldSaved);
          oldIds.forEach((id) => map.set(id, now));
        }
      }
    } catch {
      // ignore
    }
    return map;
  });

  // Set of read article IDs derived from readMap
  const readIds = new Set(readMap.keys());

  // Current active view tab: 'unread' (Tin Mới) | 'starred' (Tin quan tâm) | 'read' (Đã đọc 48h)
  const [viewTab, setViewTab] = useState<'unread' | 'starred' | 'read'>('unread');
  // Region filter: 'all' | 'vietnam' | 'world'
  const [regionFilter, setRegionFilter] = useState<'all' | 'vietnam' | 'world'>('all');
  // Topic filter: 'all' | 'ai' | 'chip' | 'tech_vn' | 'device'
  const [topicFilter, setTopicFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Audio / TTS state
  const [playingArticleId, setPlayingArticleId] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [autoplayNext, setAutoplayNext] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => VietnameseTTS.getPlaybackRate());
  const [selectedVoice, setSelectedVoice] = useState<string>(() => VietnameseTTS.getVoice());

  // General system state
  const [crawlStatus, setCrawlStatus] = useState<CrawlStatus | null>(null);
  const [stats, setStats] = useState<StatsOverview | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedDeepArticle, setSelectedDeepArticle] = useState<Article | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Ref to hold current state values in TTS callbacks
  const stateRef = useRef({
    topArticles,
    readIds,
    autoplayNext,
    playingArticleId,
    selectedVoice,
  });

  useEffect(() => {
    stateRef.current = {
      topArticles,
      readIds,
      autoplayNext,
      playingArticleId,
      selectedVoice,
    };
  }, [topArticles, readIds, autoplayNext, playingArticleId, selectedVoice]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Đánh dấu sao tin quan tâm & phân tích chuyên sâu
  const handleToggleStar = async (id: number) => {
    const isCurrent = starredIds.has(id);
    const nextStarred = !isCurrent;

    // 1. Cập nhật ngay danh sách starredIds
    const nextSet = new Set(starredIds);
    if (nextStarred) {
      nextSet.add(id);
      // Lập tức chuyển tin này về tin chưa đọc/chưa xem
      setReadMap((prev) => {
        const updated = new Map(prev);
        updated.delete(id);
        try {
          const arr: { id: number; readAt: number }[] = [];
          updated.forEach((readAt, artId) => arr.push({ id: artId, readAt }));
          localStorage.setItem(STORAGE_READ_ITEMS_KEY, JSON.stringify(arr));
        } catch (e) {
          console.error(e);
        }
        return updated;
      });
      showToast('⭐ Đang tìm kiếm thêm từ các nguồn & nâng cấp tóm tắt chuyên sâu...');
    } else {
      nextSet.delete(id);
      showToast('Đã bỏ đánh dấu sao');
    }
    setStarredIds(nextSet);
    try {
      localStorage.setItem(STORAGE_STARRED_KEY, JSON.stringify(Array.from(nextSet)));
    } catch (e) {
      console.error(e);
    }

    // Sync to user profile if logged in
    if (currentUser) {
      syncUserDataApi(currentUser.username, { starred_ids: Array.from(nextSet) });
    }

    // 2. Gửi request lên server để chạy Deep Synthesis và nâng cấp tóm tắt
    try {
      const res = await toggleStarArticle(id, nextStarred);
      if (res && res.article) {
        setTopArticles((prev) =>
          prev.map((a) => (a.id === id ? { ...a, ...res.article, is_starred: nextStarred } : a))
        );
        if (nextStarred) {
          showToast('⭐ Đã cập nhật tóm tắt chuyên sâu đa nguồn & chuyển về Tin Mới!');
        }
      }
    } catch (e) {
      console.error('Lỗi sync star lên server:', e);
    }
  };

  // Mark article as read (Tự động xóa tin đã đọc quá 48 giờ)
  const markAsRead = useCallback((id: number) => {
    // Lưu tức thì lên backend
    markUserReadApi(activeUserId, id);

    setReadMap((prev) => {
      const next = new Map(prev);
      next.set(id, Date.now());
      // Lọc bỏ bất kỳ tin nào đọc quá 48 giờ
      const now = Date.now();
      const prunedArray: { id: number; readAt: number }[] = [];
      next.forEach((readAt, artId) => {
        if (now - readAt <= FORTY_EIGHT_HOURS_MS) {
          prunedArray.push({ id: artId, readAt });
        }
      });
      try {
        localStorage.setItem(STORAGE_READ_ITEMS_KEY, JSON.stringify(prunedArray));
      } catch (e) {
        console.error(e);
      }
      return next;
    });

    if (currentUser) {
      syncUserDataApi(currentUser.username, { read_ids: Array.from(readMap.keys()).concat(id) });
    }
  }, [activeUserId, currentUser, readMap]);

  // Mark article as unread (undo)
  const markAsUnread = (id: number) => {
    markUserUnreadApi(activeUserId, id);

    setReadMap((prev) => {
      const next = new Map(prev);
      next.delete(id);
      const prunedArray: { id: number; readAt: number }[] = [];
      next.forEach((readAt, artId) => {
        prunedArray.push({ id: artId, readAt });
      });
      try {
        localStorage.setItem(STORAGE_READ_ITEMS_KEY, JSON.stringify(prunedArray));
      } catch (e) {
        console.error(e);
      }
      return next;
    });
    showToast('Đã hoàn tác về danh sách chưa đọc');
  };

  // Clear all read history
  const clearReadHistory = () => {
    if (window.confirm('Bạn có muốn đặt lại toàn bộ danh sách đã đọc (48h) không?')) {
      clearUserReadsApi(activeUserId);
      setReadMap(new Map());
      setReadArticlesList([]);
      try {
        localStorage.removeItem(STORAGE_READ_ITEMS_KEY);
      } catch {}
      cleanupReadData(2).catch(() => {});
      showToast('Đã làm mới danh sách tin đã đọc');
      loadNews(categoryMode, activeUserId);
    }
  };

  // Load articles from backend (theo categoryMode và loại trừ tin đã đọc)
  const loadNews = useCallback(async (mode: NewsCategoryMode = categoryMode, uid: string = activeUserId) => {
    try {
      setIsLoading(true);
      let data: Article[] = [];
      if (mode === 'all') {
        data = await fetchTop6hNews(undefined, 30, uid, true);
      } else {
        data = await fetchTop20News(mode, uid, true);
      }
      setTopArticles(data);
      if (data.length > 0) {
        VietnameseTTS.preloadArticleAudio(data[0].id, 1);
      }
    } catch (err) {
      console.error('Error fetching news:', err);
    } finally {
      setIsLoading(false);
    }
  }, [categoryMode, activeUserId]);

  // User Login Success Handler
  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    try {
      localStorage.setItem(STORAGE_CURRENT_USER_KEY, JSON.stringify(user));
    } catch {}

    showToast(`👋 Xin chào, ${user.display_name || user.username}!`);

    // Merge user's saved starred articles
    if (user.starred_ids && user.starred_ids.length > 0) {
      setStarredIds((prev) => {
        const merged = new Set([...Array.from(prev), ...user.starred_ids]);
        try {
          localStorage.setItem(STORAGE_STARRED_KEY, JSON.stringify(Array.from(merged)));
        } catch {}
        return merged;
      });
    }

    // Merge user's saved read articles
    if (user.read_ids && user.read_ids.length > 0) {
      setReadMap((prev) => {
        const next = new Map(prev);
        const now = Date.now();
        user.read_ids.forEach((id) => {
          if (!next.has(id)) next.set(id, now);
        });
        return next;
      });
    }

    // Restore voice settings
    if (user.settings?.voice) {
      setSelectedVoice(user.settings.voice);
      VietnameseTTS.setVoice(user.settings.voice);
    }
    if (user.settings?.playback_rate) {
      setPlaybackSpeed(user.settings.playback_rate);
      VietnameseTTS.setPlaybackRate(user.settings.playback_rate);
    }

    // Reload news for the logged-in user
    loadNews(categoryMode, user.username);
  };

  // User Logout Handler
  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_CURRENT_USER_KEY);
    } catch {}
    showToast('Đã đăng xuất tài khoản.');
    loadNews(categoryMode, guestUserId);
  };

  // Change category mode
  const handleSelectCategory = (mode: NewsCategoryMode) => {
    setCategoryMode(mode);
    loadNews(mode, activeUserId);
  };

  // Đồng bộ lịch sử đọc 2 chiều giữa client và backend server khi mở trang
  useEffect(() => {
    const localIds = Array.from(readMap.keys());
    syncUserReadsApi(activeUserId, localIds).then((mergedIds) => {
      if (mergedIds && mergedIds.length > 0) {
        setReadMap((prev) => {
          const next = new Map(prev);
          const now = Date.now();
          let changed = false;
          mergedIds.forEach((id) => {
            if (!next.has(id)) {
              next.set(id, now);
              changed = true;
            }
          });
          if (changed) {
            const prunedArray: { id: number; readAt: number }[] = [];
            next.forEach((readAt, artId) => prunedArray.push({ id: artId, readAt }));
            try {
              localStorage.setItem(STORAGE_READ_ITEMS_KEY, JSON.stringify(prunedArray));
            } catch {}
            return next;
          }
          return prev;
        });
      }
    });
  }, [activeUserId]);

  // Khi người dùng chuyển sang tab "Đã đọc", tự động nạp danh sách tin đã đọc từ backend
  useEffect(() => {
    if (viewTab === 'read') {
      fetchUserReadArticles(activeUserId, 50).then((arts) => {
        if (arts && arts.length > 0) {
          setReadArticlesList(arts);
        }
      }).catch(() => {});
    }
  }, [viewTab, activeUserId]);

  // Initial load
  useEffect(() => {
    loadNews(categoryMode, activeUserId);
    fetchCrawlStatus().then(setCrawlStatus).catch(() => {});
    fetchStats().then(setStats).catch(() => {});
    // Tự động dọn dẹp tin cũ hơn 2 ngày (48h)
    cleanupReadData(2).catch(() => {});
  }, [loadNews, activeUserId]);

  // Periodic poll for status
  useEffect(() => {
    const interval = setInterval(() => {
      fetchCrawlStatus().then(setCrawlStatus).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Stop TTS on unmount
  useEffect(() => {
    return () => {
      VietnameseTTS.stop();
    };
  }, []);

  // Speed change handler
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    VietnameseTTS.setPlaybackRate(speed);
    showToast(`⚡ Đã chỉnh tốc độ đọc: ${speed}x`);
  };

  // Voice change handler
  const handleVoiceChange = (voice: string) => {
    setSelectedVoice(voice);
    VietnameseTTS.setVoice(voice);
    const voiceObj = VOICE_OPTIONS.find((v) => v.id === voice);
    showToast(`🎙️ Đã chọn: ${voiceObj ? voiceObj.shortLabel : voice}`);

    // Nếu đang phát tin dở dang, phát lại tin đó với giọng đọc mới ngay
    if (playingArticleId) {
      const current = topArticles.find((a) => a.id === playingArticleId);
      if (current) {
        setTimeout(() => {
          handlePlayArticle(current);
        }, 120);
      }
    }
  };

  // Callbacks cho engine VietnameseTTS tự hành:
  // Chạy độc lập, không bị ảnh hưởng bởi việc tắt màn hình điện thoại hay React microtask throttling
  const ttsCallbacks = useMemo(() => ({
    onArticleStart: (article: Article, _rank: number) => {
      setPlayingArticleId(article.id);
      setIsPaused(false);
    },
    onArticleEnd: (article: Article, rank: number) => {
      markAsRead(article.id);
      showToast(`✅ Đã đọc xong tin #${rank} và chuyển sang tab Đã đọc`);
    },
    onPlaylistFinished: () => {
      setPlayingArticleId(null);
      setIsPaused(false);
      showToast('🎉 Đã nghe xong toàn bộ các tin hot!');
    },
    onError: (err: any, article: Article) => {
      console.warn('Lỗi âm thanh bài:', article.title, err);
      // Không đánh dấu là đã đọc nếu bài bị lỗi âm thanh
      showToast(`⚠️ Không thể phát âm thanh: ${article.title.substring(0, 30)}...`);
    }
  }), [markAsRead]);

  // Phát 1 bài cụ thể (nếu bật tự chuyển tin, tiếp tục phát các tin chưa đọc kế tiếp)
  const handlePlayArticle = useCallback((article: Article) => {
    recordArticleClick(article.id);
    setPlayingArticleId(article.id);
    setIsPaused(false);

    VietnameseTTS.setAutoplay(autoplayNext);

    // Xây dựng danh sách phát: bắt đầu bằng bài được chọn, sau đó là các bài chưa đọc còn lại
    const remainingUnread = topArticles.filter((a) => !readIds.has(a.id) && a.id !== article.id);
    const playlist = [article, ...remainingUnread];

    VietnameseTTS.startPlaylist(playlist, 0, ttsCallbacks, selectedVoice);
  }, [topArticles, readIds, autoplayNext, selectedVoice, ttsCallbacks]);

  // Phát toàn bộ tin hot từ đầu
  const handlePlayAll = () => {
    const unread = topArticles.filter((a) => !readIds.has(a.id));
    const listToPlay = unread.length > 0 ? unread : topArticles;

    if (listToPlay.length > 0) {
      setPlayingArticleId(listToPlay[0].id);
      setIsPaused(false);
      VietnameseTTS.setAutoplay(autoplayNext);
      VietnameseTTS.startPlaylist(listToPlay, 0, ttsCallbacks, selectedVoice);
      if (unread.length === 0) {
        showToast('🔁 Đang phát lại toàn bộ danh sách tin...');
      }
    } else {
      showToast('Không có bài viết nào để phát!');
    }
  };

  const handlePause = () => {
    VietnameseTTS.pause();
    setIsPaused(true);
  };

  const handleResume = () => {
    VietnameseTTS.resume();
    setIsPaused(false);
  };

  const handleStop = () => {
    VietnameseTTS.stop();
    setPlayingArticleId(null);
    setIsPaused(false);
  };

  const handleNext = () => {
    if (playingArticleId) {
      markAsRead(playingArticleId);
    }
    VietnameseTTS.playNext();
  };

  const handleToggleAutoplay = () => {
    const nextVal = !autoplayNext;
    setAutoplayNext(nextVal);
    VietnameseTTS.setAutoplay(nextVal);
    try {
      localStorage.setItem('tech_pulse_autoplay', String(nextVal));
    } catch {}
    showToast(nextVal ? '▶️ Đã bật tự động chuyển tin liên tục' : '⏸️ Đã tắt tự chuyển tin');
  };

  // Khởi tạo điều khiển MediaSession (màn hình khóa iOS/Android & tai nghe Bluetooth)
  useEffect(() => {
    VietnameseTTS.initMediaSession({
      onPlay: () => setIsPaused(false),
      onPause: () => setIsPaused(true),
      onStop: () => {
        setPlayingArticleId(null);
        setIsPaused(false);
      },
    });
  }, []);

  // Toggle read/unread status
  const handleToggleRead = (id: number) => {
    if (readIds.has(id)) {
      markAsUnread(id);
    } else {
      markAsRead(id);
      showToast('Đã chuyển bài viết sang tab Đã đọc');
    }
  };

  // Handle manual trigger crawl with mode
  const handleTriggerCrawl = async (mode: CrawlMode = 'all') => {
    try {
      setIsTriggering(true);
      const modeNames: Record<string, string> = {
        all: 'tất cả nguồn tin',
        ai_tech: '20 tin A.I & Công nghệ hot nhất',
        hot_vn: '20 tin hot Việt Nam nổi cộm',
        hot_world: '20 tin hot Quốc tế',
        trending: '20 tin trending VN + QT',
      };
      showToast(`🚀 Đang quét ${modeNames[mode] || mode}...`);
      await triggerCrawlNow(mode);
      const checkInterval = setInterval(async () => {
        const st = await fetchCrawlStatus();
        setCrawlStatus(st);
        if (!st.is_running) {
          clearInterval(checkInterval);
          setIsTriggering(false);
          showToast(`✅ Quét hoàn tất! Đã tự động tạo sẵn âm thanh cho các bài viết.`);
          if (mode !== 'all') {
            setCategoryMode(mode as NewsCategoryMode);
            loadNews(mode as NewsCategoryMode, activeUserId);
          } else {
            loadNews(categoryMode, activeUserId);
          }
          fetchStats().then(setStats).catch(() => {});
        }
      }, 3000);
    } catch {
      setIsTriggering(false);
      showToast('Có lỗi xảy ra khi kích hoạt quét tin.');
    }
  };

  // Filter articles for current view
  const unreadArticles = topArticles.filter((a) => !readIds.has(a.id));
  const starredArticles = topArticles.filter((a) => starredIds.has(a.id) || a.is_starred);

  // Hợp nhất danh sách tin đã đọc từ backend và các tin vừa đọc trong phiên hiện tại
  const allReadArticles = useMemo(() => {
    const map = new Map<number, Article>();
    readArticlesList.forEach((a) => map.set(a.id, a));
    topArticles.forEach((a) => {
      if (readIds.has(a.id)) {
        map.set(a.id, a);
      }
    });
    return Array.from(map.values());
  }, [readArticlesList, topArticles, readIds]);

  // Filter by active tab (unread vs starred vs read)
  const baseList = viewTab === 'unread' 
    ? unreadArticles 
    : viewTab === 'starred'
    ? starredArticles
    : allReadArticles;

  // Apply region, topic filter and search
  const displayedArticles = baseList.filter((a) => {
    if (regionFilter === 'vietnam' && a.region !== 'vietnam') return false;
    if (regionFilter === 'world' && a.region !== 'world') return false;

    // Topic filtering
    if (topicFilter === 'ai') {
      const matchAI = 
        (a.tags && a.tags.some((t) => t.toLowerCase().includes('ai') || t.toLowerCase().includes('trí tuệ nhân tạo'))) ||
        a.title.toLowerCase().includes('ai') ||
        a.title.toLowerCase().includes('chatgpt') ||
        a.title.toLowerCase().includes('openai') ||
        a.title.toLowerCase().includes('gemini') ||
        a.title.toLowerCase().includes('claude') ||
        a.title.toLowerCase().includes('llm') ||
        a.source_name.toLowerCase().includes('ai');
      if (!matchAI) return false;
    } else if (topicFilter === 'chip') {
      const matchChip =
        a.title.toLowerCase().includes('chip') ||
        a.title.toLowerCase().includes('bán dẫn') ||
        a.title.toLowerCase().includes('nvidia') ||
        a.title.toLowerCase().includes('intel') ||
        a.title.toLowerCase().includes('qualcomm');
      if (!matchChip) return false;
    } else if (topicFilter === 'tech_vn') {
      if (a.category !== 'tech_vn') return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        a.title.toLowerCase().includes(q) ||
        (a.summary_short && a.summary_short.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const currentPlayingArticle = topArticles.find((a) => a.id === playingArticleId) || null;
  const currentPlayingIndex = currentPlayingArticle
    ? topArticles.findIndex((a) => a.id === playingArticleId)
    : 0;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 999,
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #ff5722',
          color: '#fff',
          padding: '0.75rem 1.25rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px -5px rgba(255, 87, 34, 0.5)',
          fontSize: '0.85rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <Sparkles size={16} color="#ff7849" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        crawlStatus={crawlStatus}
        stats={stats}
        onTriggerCrawl={handleTriggerCrawl}
        isTriggering={isTriggering}
        userId={activeUserId}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
      />

      {/* Main Single Vertical Column Container */}
      <main style={{
        width: '100%',
        maxWidth: '780px',
        margin: '0 auto',
        padding: '0 1rem 3rem 1rem',
        flex: 1,
      }}>
        {/* Category Mode Selector: 4 Loại tin chọn khi quét & xem (Tìm 20 tin hot nhất nổi cộm nhất) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.45rem',
          overflowX: 'auto',
          padding: '0.75rem 0 0.5rem 0',
          marginBottom: '0.65rem',
        }} className="hide-scrollbar">
          {[
            { id: 'all' as NewsCategoryMode, label: '🌟 Tất Cả (Hot 6h)', badge: 'Gồm TP.HCM' },
            { id: 'ai_tech' as NewsCategoryMode, label: '🤖 A.I & Công Nghệ', badge: 'Top 20' },
            { id: 'hot_vn' as NewsCategoryMode, label: '🇻🇳 Hot Việt Nam', badge: 'Top 20' },
            { id: 'hot_world' as NewsCategoryMode, label: '🌎 Hot Quốc Tế', badge: 'Top 20' },
            { id: 'trending' as NewsCategoryMode, label: '⚡ Trending VN + QT', badge: 'Top 20' },
          ].map((cat) => {
            const isActive = categoryMode === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleSelectCategory(cat.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem 0.85rem',
                  borderRadius: '12px',
                  border: isActive ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.08)',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(79, 70, 229, 0.35), rgba(99, 102, 241, 0.25))'
                    : 'rgba(15, 23, 42, 0.6)',
                  color: isActive ? '#fff' : 'var(--text-secondary)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isActive ? '0 0 12px rgba(99, 102, 241, 0.3)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                <span>{cat.label}</span>
                <span style={{
                  fontSize: '0.65rem',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '6px',
                  background: isActive ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  fontWeight: 600,
                }}>
                  {cat.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sticky Audio Player Bar with Speed Selector & Voice Selector */}
        <AudioPlayerBar
          currentArticle={currentPlayingArticle}
          isPlaying={!!playingArticleId}
          isPaused={isPaused}
          autoplayNext={autoplayNext}
          playbackSpeed={playbackSpeed}
          onSpeedChange={handleSpeedChange}
          selectedVoice={selectedVoice}
          onVoiceChange={handleVoiceChange}
          currentIndex={currentPlayingIndex}
          totalArticles={topArticles.length}
          onPlay={handlePlayArticle}
          onPause={handlePause}
          onResume={handleResume}
          onStop={handleStop}
          onNext={handleNext}
          onToggleAutoplay={handleToggleAutoplay}
          onPlayAll={handlePlayAll}
          onOpenPronunciationModal={() => setIsPronunciationOpen(true)}
        />

        {/* View Switcher Tabs: Tin Mới (Chưa đọc) vs Quan Tâm (Sao) vs Đã đọc (48h) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.7)',
          padding: '0.35rem',
          borderRadius: '14px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          marginBottom: '0.85rem',
          gap: '0.35rem',
          overflowX: 'auto',
        }}>
          {/* Tab 1: Chưa Đọc */}
          <button
            onClick={() => setViewTab('unread')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '10px',
              border: 'none',
              background: viewTab === 'unread'
                ? 'linear-gradient(135deg, rgba(255, 87, 34, 0.3), rgba(255, 140, 0, 0.3))'
                : 'transparent',
              color: viewTab === 'unread' ? '#ff9e80' : 'var(--text-secondary)',
              fontWeight: viewTab === 'unread' ? 800 : 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}
          >
            <Flame size={16} color={viewTab === 'unread' ? '#ff5722' : 'var(--text-muted)'} />
            <span>🔥 {categoryMode === 'all' ? 'Tin Hot' : 'Top 20'} ({unreadArticles.length})</span>
          </button>

          {/* Tab 2: Tin Quan Tâm (Đánh Dấu Sao) */}
          <button
            onClick={() => setViewTab('starred')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '10px',
              border: 'none',
              background: viewTab === 'starred'
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.25))'
                : 'transparent',
              color: viewTab === 'starred' ? '#fbbf24' : 'var(--text-secondary)',
              fontWeight: viewTab === 'starred' ? 800 : 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}
          >
            <Star size={16} fill={viewTab === 'starred' ? '#fbbf24' : 'none'} color={viewTab === 'starred' ? '#fbbf24' : 'var(--text-muted)'} />
            <span>⭐ Quan Tâm ({starredArticles.length})</span>
          </button>

          {/* Tab 3: Đã Đọc (Lưu 48 giờ) */}
          <button
            onClick={() => setViewTab('read')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '10px',
              border: 'none',
              background: viewTab === 'read'
                ? 'rgba(16, 185, 129, 0.2)'
                : 'transparent',
              color: viewTab === 'read' ? '#34d399' : 'var(--text-secondary)',
              fontWeight: viewTab === 'read' ? 800 : 600,
              fontSize: '0.85rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}
          >
            <CheckCheck size={16} color={viewTab === 'read' ? '#10b981' : 'var(--text-muted)'} />
            <span>✅ Đã Đọc ({readIds.size})</span>
            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>(48h)</span>
          </button>
        </div>

        {/* Region & Topic Filters Bar */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          marginBottom: '1.25rem',
        }}>
          {/* Row 1: Region Switcher + Reset History */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <button
                onClick={() => setRegionFilter('all')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: regionFilter === 'all' ? 700 : 500,
                  background: regionFilter === 'all' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  color: regionFilter === 'all' ? '#fff' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Tất cả khu vực
              </button>
              <button
                onClick={() => setRegionFilter('vietnam')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: regionFilter === 'vietnam' ? 700 : 500,
                  background: regionFilter === 'vietnam' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: regionFilter === 'vietnam' ? '#fca5a5' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                🇻🇳 Việt Nam
              </button>
              <button
                onClick={() => setRegionFilter('world')}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: regionFilter === 'world' ? 700 : 500,
                  background: regionFilter === 'world' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  color: regionFilter === 'world' ? '#7dd3fc' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                🌎 Thế Giới
              </button>
            </div>

            {/* Reset History if in Read tab */}
            {viewTab === 'read' && readIds.size > 0 && (
              <button
                onClick={clearReadHistory}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '8px',
                  fontSize: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#94a3b8',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={12} />
                <span>Đặt lại danh sách</span>
              </button>
            )}
          </div>

          {/* Row 2: AI & Tech Topic Quick Pills */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            overflowX: 'auto',
            paddingBottom: '0.2rem',
          }} className="hide-scrollbar">
            <button
              onClick={() => setTopicFilter('all')}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: topicFilter === 'all' ? 700 : 400,
                background: topicFilter === 'all' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                color: topicFilter === 'all' ? '#a5b4fc' : 'var(--text-muted)',
                border: topicFilter === 'all' ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.06)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Tất cả chủ đề
            </button>

            <button
              onClick={() => setTopicFilter('ai')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: topicFilter === 'ai' ? 800 : 500,
                background: topicFilter === 'ai' ? 'linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(99, 102, 241, 0.3))' : 'rgba(255, 255, 255, 0.03)',
                color: topicFilter === 'ai' ? '#d8b4fe' : 'var(--text-muted)',
                border: topicFilter === 'ai' ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.06)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span>🤖 Trí Tuệ Nhân Tạo (AI)</span>
            </button>

            <button
              onClick={() => setTopicFilter('chip')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: topicFilter === 'chip' ? 700 : 400,
                background: topicFilter === 'chip' ? 'rgba(0, 210, 255, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: topicFilter === 'chip' ? '#38bdf8' : 'var(--text-muted)',
                border: topicFilter === 'chip' ? '1px solid #00d2ff' : '1px solid rgba(255, 255, 255, 0.06)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Cpu size={13} />
              <span>Bán Dẫn & Chip</span>
            </button>

            <button
              onClick={() => setTopicFilter('tech_vn')}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: topicFilter === 'tech_vn' ? 700 : 400,
                background: topicFilter === 'tech_vn' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: topicFilter === 'tech_vn' ? '#fca5a5' : 'var(--text-muted)',
                border: topicFilter === 'tech_vn' ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.06)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              🇻🇳 Công Nghệ Việt Nam
            </button>
          </div>
        </div>

        {/* Vertical Feed List */}
        {isLoading ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4rem 0',
            gap: '1rem',
            color: 'var(--text-muted)',
          }}>
            <div className="hot-dot" style={{ width: '16px', height: '16px' }} />
            <p style={{ fontSize: '0.9rem' }}>Đang nạp 30 tin hot mới nhất...</p>
          </div>
        ) : displayedArticles.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 1.5rem',
            background: 'rgba(15, 23, 42, 0.4)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            margin: '1rem 0',
          }}>
            {viewTab === 'unread' ? (
              <>
                <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 0.75rem auto' }} />
                <h3 style={{ fontSize: '1.15rem', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Bạn đã nghe/đọc hết các tin trong danh mục này!
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                  Có thể chuyển sang tab "Đã Đọc" để nghe lại, hoặc bấm nút dưới đây để quét thêm tin mới nhất.
                </p>
                <button
                  onClick={() => handleTriggerCrawl(categoryMode === 'all' ? 'all' : categoryMode)}
                  style={{
                    padding: '0.55rem 1.25rem',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                  }}
                >
                  Quét thêm tin mới ngay
                </button>
              </>
            ) : viewTab === 'starred' ? (
              <>
                <Star size={44} color="#f59e0b" style={{ margin: '0 auto 0.75rem auto' }} />
                <h3 style={{ fontSize: '1.1rem', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Chưa có tin nào được đánh dấu sao
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto' }}>
                  Bấm vào biểu tượng ⭐ trên bất kỳ bài viết nào bạn quan tâm để lưu lại vào đây và mở bản phân tích chuyên sâu đa chiều!
                </p>
              </>
            ) : (
              <>
                <AlertCircle size={44} color="#64748b" style={{ margin: '0 auto 0.75rem auto' }} />
                <h3 style={{ fontSize: '1.1rem', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Chưa có tin nào trong danh sách đã đọc
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Khi bạn bấm phát nghe tin hoặc bấm "Đã đọc", tin sẽ tự động chuyển vào đây (tự động xóa sau 48 giờ để tránh đầy bộ nhớ).
                </p>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {displayedArticles.map((art) => {
              const originalIndex = topArticles.findIndex((a) => a.id === art.id);
              const rank = originalIndex >= 0 ? originalIndex + 1 : 1;
              const isPlaying = playingArticleId === art.id;
              const isRead = readIds.has(art.id);
              const isStarred = starredIds.has(art.id) || !!art.is_starred;

              return (
                <VerticalNewsCard
                  key={art.id}
                  article={art}
                  rank={rank}
                  isPlaying={isPlaying}
                  isRead={isRead}
                  isStarred={isStarred}
                  onPlay={handlePlayArticle}
                  onStop={handleStop}
                  onToggleRead={handleToggleRead}
                  onToggleStar={handleToggleStar}
                  onOpenReader={(a) => setSelectedArticle(a)}
                  onOpenDeepAnalysis={(a) => setSelectedDeepArticle(a)}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* Quick Reader Modal */}
      <QuickReaderModal
        article={selectedArticle}
        onClose={() => setSelectedArticle(null)}
      />

      {/* Deep Dive Analysis Modal */}
      <DeepAnalysisModal
        article={selectedDeepArticle}
        isOpen={!!selectedDeepArticle}
        onClose={() => setSelectedDeepArticle(null)}
        isStarred={selectedDeepArticle ? (starredIds.has(selectedDeepArticle.id) || !!selectedDeepArticle.is_starred) : false}
        onToggleStar={handleToggleStar}
      />

      {/* Pronunciation Dictionary Modal */}
      <PronunciationModal
        isOpen={isPronunciationOpen}
        onClose={() => setIsPronunciationOpen(false)}
      />

      {/* Auth Modal (Login / Register / Forgot Password) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
    </div>
  );
};

export default App;

