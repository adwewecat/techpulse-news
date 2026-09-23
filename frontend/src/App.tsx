import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  fetchTop6hNews, fetchCrawlStatus, fetchStats, 
  recordArticleClick, triggerCrawlNow, toggleStarArticle, cleanupReadData,
  getOrCreateUserId, markUserReadApi, markUserUnreadApi, syncUserReadsApi,
  clearUserReadsApi, fetchUserReadArticles
} from './services/api';
import { VietnameseTTS } from './services/tts';
import type { Article, CrawlStatus, StatsOverview } from './types/news';
import { Header } from './components/Header';
import { AudioPlayerBar, VOICE_OPTIONS } from './components/AudioPlayerBar';
import { VerticalNewsCard } from './components/VerticalNewsCard';
import { QuickReaderModal } from './components/QuickReaderModal';
import { DeepAnalysisModal } from './components/DeepAnalysisModal';
import { 
  Flame, CheckCheck, Sparkles, Star,
  RotateCcw, AlertCircle, CheckCircle2, Cpu
} from 'lucide-react';

const STORAGE_READ_ITEMS_KEY = 'tech_pulse_read_items_v2';
const STORAGE_STARRED_KEY = 'tech_pulse_starred_ids_v1';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const App: React.FC = () => {
  // Anonymous guest user ID (no login required, auto-cached)
  const [userId] = useState<string>(() => getOrCreateUserId());

  // State for raw 30 top articles from backend
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

  // Map of read article IDs to timestamp (readAt) - Tự động xóa sau 30 ngày
  const [readMap, setReadMap] = useState<Map<number, number>>(() => {
    const map = new Map<number, number>();
    const now = Date.now();
    try {
      const saved = localStorage.getItem(STORAGE_READ_ITEMS_KEY);
      if (saved) {
        const items: { id: number; readAt: number }[] = JSON.parse(saved);
        items.forEach((it) => {
          if (now - it.readAt <= THIRTY_DAYS_MS) {
            map.set(it.id, it.readAt);
          }
        });
      } else {
        // Migrate từ v1 nếu có
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

  // Current active view tab: 'unread' (30 Tin Hot) | 'starred' (Tin quan tâm) | 'read' (Đã đọc 30 ngày)
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
      // Lập tức chuyển tin này về tin chưa đọc/chưa xem (kể cả đã nghe hoặc xem rồi)
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

    // 2. Gửi request lên server để chạy Deep Synthesis và nâng cấp tóm tắt
    try {
      const res = await toggleStarArticle(id, nextStarred);
      if (res && res.article) {
        // Cập nhật tóm tắt mới vào danh sách bài viết
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

  // Mark article as read (Chỉ lưu trữ 30 ngày)
  const markAsRead = useCallback((id: number) => {
    // Lưu tức thì lên backend cho người dùng ẩn danh
    markUserReadApi(userId, id);

    setReadMap((prev) => {
      const next = new Map(prev);
      next.set(id, Date.now());
      // Lọc bỏ bất kỳ tin nào đọc quá 30 ngày
      const now = Date.now();
      const prunedArray: { id: number; readAt: number }[] = [];
      next.forEach((readAt, artId) => {
        if (now - readAt <= THIRTY_DAYS_MS) {
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
  }, [userId]);

  // Mark article as unread (undo)
  const markAsUnread = (id: number) => {
    // Hoàn tác trên backend cho người dùng ẩn danh
    markUserUnreadApi(userId, id);

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
    if (window.confirm('Bạn có muốn đặt lại toàn bộ danh sách đã đọc không?')) {
      clearUserReadsApi(userId);
      setReadMap(new Map());
      setReadArticlesList([]);
      try {
        localStorage.removeItem(STORAGE_READ_ITEMS_KEY);
      } catch {}
      cleanupReadData(30).catch(() => {});
      showToast('Đã làm mới danh sách tin đã đọc');
      // Tải lại 30 tin hot bao gồm cả các tin vừa làm mới
      load30HotNews();
    }
  };

  // Load 30 top articles from backend (loại trừ các tin đã đọc của user)
  const load30HotNews = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchTop6hNews(undefined, 30, userId, true);
      setTopArticles(data);
      if (data.length > 0) {
        VietnameseTTS.preloadArticleAudio(data[0].id, 1);
      }
    } catch (err) {
      console.error('Error fetching 30 hot news:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Đồng bộ lịch sử đọc 2 chiều giữa client và backend server khi mở trang
  useEffect(() => {
    const localIds = Array.from(readMap.keys());
    syncUserReadsApi(userId, localIds).then((mergedIds) => {
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
  }, [userId]);

  // Khi người dùng chuyển sang tab "Đã đọc", tự động nạp danh sách tin đã đọc từ backend
  useEffect(() => {
    if (viewTab === 'read') {
      fetchUserReadArticles(userId, 50).then((arts) => {
        if (arts && arts.length > 0) {
          setReadArticlesList(arts);
        }
      }).catch(() => {});
    }
  }, [viewTab, userId]);

  // Initial load
  useEffect(() => {
    load30HotNews();
    fetchCrawlStatus().then(setCrawlStatus).catch(() => {});
    fetchStats().then(setStats).catch(() => {});
    // Tự động dọn dẹp tin đã đọc cũ hơn 30 ngày (bảo toàn tin đánh dấu sao)
    cleanupReadData(30).catch(() => {});
  }, [load30HotNews]);

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

  // Play audio for a specific article
  const handlePlayArticle = useCallback((article: Article) => {
    // Record click count
    recordArticleClick(article.id);

    setPlayingArticleId(article.id);
    setIsPaused(false);

    const rankIndex = stateRef.current.topArticles.findIndex((a) => a.id === article.id);
    const rankNum = rankIndex >= 0 ? rankIndex + 1 : 1;

    // Play audio for current article
    VietnameseTTS.playArticleAudio(
      article.id,
      rankNum,
      stateRef.current.selectedVoice,
      article.title,
      () => {
        // onStart: Khi bài hiện tại bắt đầu phát ổn định, kích hoạt preload ngầm bài kế tiếp
        setIsPaused(false);
        const remainingUnread = stateRef.current.topArticles.filter(
          (a) => !stateRef.current.readIds.has(a.id) && a.id !== article.id
        );
        if (remainingUnread.length > 0) {
          const nextArticle = remainingUnread[0];
          const nextRankIndex = stateRef.current.topArticles.findIndex((a) => a.id === nextArticle.id);
          const nextRankNum = nextRankIndex >= 0 ? nextRankIndex + 1 : 1;
          VietnameseTTS.preloadArticleAudio(nextArticle.id, nextRankNum, stateRef.current.selectedVoice);
        }
      },
      () => {
        // onEnd: Phát xong 1 lần -> Đánh dấu là tin đã đọc -> Chuyển qua tab Đã đọc
        markAsRead(article.id);
        setPlayingArticleId(null);
        showToast(`✅ Đã đọc xong tin #${rankNum} và chuyển sang tab Đã đọc`);

        // If autoplay continuous is enabled, find the next unread article and play it!
        if (stateRef.current.autoplayNext) {
          const updatedReadSet = new Set(stateRef.current.readIds);
          updatedReadSet.add(article.id);

          const nextUnreadList = stateRef.current.topArticles.filter(
            (a) => !updatedReadSet.has(a.id)
          );

          if (nextUnreadList.length > 0) {
            const nextArticle = nextUnreadList[0];
            // KHI TẮT MÀN HÌNH HOẶC CHUYỂN TAB TRÊN ĐIỆN THOẠI (document.hidden):
            // Phải phát bài tiếp theo ngay lập tức không qua setTimeout
            // để hệ điều hành iOS/Android không đình chỉ tab và duy trì âm thanh liên tục trong nền!
            if (typeof document !== 'undefined' && document.hidden) {
              handlePlayArticle(nextArticle);
            } else {
              setTimeout(() => {
                handlePlayArticle(nextArticle);
              }, 150);
            }
          } else {
            showToast('🎉 Đã nghe xong toàn bộ các tin hot!');
          }
        }
      },
      (err) => {
        console.error('Speech error:', err);
        setPlayingArticleId(null);
        showToast('⚠️ Không thể phát âm thanh tin này, tự động chuyển tiếp...');

        // Tự động bỏ qua tin bị lỗi và phát tiếp tin kế tiếp, tránh việc toàn bộ danh sách bị đơ/dừng
        if (stateRef.current.autoplayNext) {
          markAsRead(article.id);
          const updatedReadSet = new Set(stateRef.current.readIds);
          updatedReadSet.add(article.id);

          const nextUnreadList = stateRef.current.topArticles.filter(
            (a) => !updatedReadSet.has(a.id)
          );

          if (nextUnreadList.length > 0) {
            const nextArticle = nextUnreadList[0];
            setTimeout(() => {
              handlePlayArticle(nextArticle);
            }, 600);
          }
        }
      }
    );
  }, [markAsRead]);

  // Handle Play All 30 articles from beginning
  const handlePlayAll = () => {
    const unread = topArticles.filter((a) => !readIds.has(a.id));
    if (unread.length > 0) {
      handlePlayArticle(unread[0]);
    } else {
      showToast('Tất cả 30 tin đã được đọc!');
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
    const unread = topArticles.filter(
      (a) => !readIds.has(a.id) && a.id !== playingArticleId
    );
    if (unread.length > 0) {
      handlePlayArticle(unread[0]);
    } else {
      handleStop();
      showToast('Không còn tin chưa đọc tiếp theo');
    }
  };

  // Khởi tạo điều khiển MediaSession (màn hình khóa iOS/Android & tai nghe Bluetooth)
  useEffect(() => {
    VietnameseTTS.initMediaSession({
      onPlay: () => handleResume(),
      onPause: () => handlePause(),
      onNext: () => handleNext(),
      onStop: () => handleStop(),
    });
  });

  // Toggle read/unread status
  const handleToggleRead = (id: number) => {
    if (readIds.has(id)) {
      markAsUnread(id);
    } else {
      markAsRead(id);
      showToast('Đã chuyển bài viết sang tab Đã đọc');
    }
  };

  // Handle manual trigger crawl
  const handleTriggerCrawl = async () => {
    try {
      setIsTriggering(true);
      showToast('🚀 Đang quét tin mới từ các nguồn AI và Báo chí...');
      await triggerCrawlNow();
      const checkInterval = setInterval(async () => {
        const st = await fetchCrawlStatus();
        setCrawlStatus(st);
        if (!st.is_running) {
          clearInterval(checkInterval);
          setIsTriggering(false);
          showToast('✅ Quét hoàn tất! Đã cập nhật 30 tin hot mới nhất.');
          load30HotNews();
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
        userId={userId}
      />

      {/* Main Single Vertical Column Container */}
      <main style={{
        width: '100%',
        maxWidth: '780px',
        margin: '0 auto',
        padding: '0 1rem 3rem 1rem',
        flex: 1,
      }}>
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
          onToggleAutoplay={() => setAutoplayNext(!autoplayNext)}
          onPlayAll={handlePlayAll}
        />

        {/* View Switcher Tabs: 30 Tin Hot (Chưa đọc) vs Quan Tâm (Sao) vs Đã đọc (30 ngày) */}
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
            <span>🔥 30 Tin Hot ({unreadArticles.length})</span>
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

          {/* Tab 3: Đã Đọc (Lưu 30 ngày) */}
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
            <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>(30 ngày)</span>
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
                  onClick={handleTriggerCrawl}
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
                  Khi bạn bấm phát nghe tin hoặc bấm "Đã đọc", tin sẽ tự động chuyển vào đây (lưu trữ 30 ngày).
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
    </div>
  );
};

export default App;
