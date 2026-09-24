import { API_BASE } from './api';
import type { Article } from '../types/news';

export interface TTSPlaylistCallbacks {
  onArticleStart?: (article: Article, rank: number) => void;
  onArticleEnd?: (article: Article, rank: number) => void;
  onPlaylistFinished?: () => void;
  onError?: (err: any, article: Article) => void;
}

export class VietnameseTTS {
  private static audio: HTMLAudioElement | null = null;
  private static isPausedState: boolean = false;
  private static currentRate: number = 1.25; // Mặc định 1.25x nhanh, rõ, mạch lạc
  private static currentVoice: string = 'vi-VN-HoaiMyNeural';

  // Playlist độc lập không phụ thuộc React state re-render khi tắt màn hình điện thoại
  private static playlist: Article[] = [];
  private static currentIndex: number = -1;
  private static isContinuousAutoplay: boolean = true;
  private static callbacks: TTSPlaylistCallbacks = {};

  // Bộ nhớ đệm Blob URL (0ms latency khi chuyển bài trên iOS / Android lock screen)
  private static blobCache: Map<string, string> = new Map();
  private static pendingFetches: Map<string, Promise<string>> = new Map();

  // WakeLock để ngăn CPU điện thoại ngủ đông sâu khi phát audio
  private static wakeLock: any = null;

  public static setVoice(voice: string) {
    this.currentVoice = voice;
    try {
      localStorage.setItem('tech_pulse_voice', voice);
    } catch {
      // ignore
    }
  }

  public static getVoice(): string {
    try {
      const saved = localStorage.getItem('tech_pulse_voice');
      if (saved) return saved;
    } catch {
      // ignore
    }
    return this.currentVoice;
  }

  public static setPlaybackRate(rate: number) {
    this.currentRate = rate;
    if (this.audio) {
      try {
        this.audio.playbackRate = rate;
      } catch {
        // ignore
      }
    }
    try {
      localStorage.setItem('tech_pulse_playback_rate', String(rate));
    } catch {
      // ignore
    }
  }

  public static getPlaybackRate(): number {
    try {
      const saved = localStorage.getItem('tech_pulse_playback_rate');
      if (saved) return parseFloat(saved);
    } catch {
      // ignore
    }
    return this.currentRate;
  }

  public static setAutoplay(enabled: boolean) {
    this.isContinuousAutoplay = enabled;
  }

  public static getAutoplay(): boolean {
    return this.isContinuousAutoplay;
  }

  /**
   * Tạo khóa cache duy nhất cho từng bài và giọng đọc
   */
  private static getCacheKey(articleId: number, rank: number, voice: string): string {
    return `art_${articleId}_r_${rank}_${voice}`;
  }

  /**
   * Tải trước ngầm dữ liệu âm thanh dạng Blob vào bộ nhớ RAM trình duyệt:
   * - Trả về `blob:http://...` URL sẵn sàng phát ngay lập tức (0ms độ trễ)
   * - Ngăn hoàn toàn tình trạng iOS Safari / Android Chrome tắt web vì âm thanh bị ngắt quãng quá 1.5s
   */
  public static async preloadArticleAudio(articleId: number, rank: number, voice?: string): Promise<string> {
    if (!articleId) return '';
    const selectedVoice = voice || this.getVoice();
    const key = this.getCacheKey(articleId, rank, selectedVoice);

    if (this.blobCache.has(key)) {
      return this.blobCache.get(key)!;
    }

    if (this.pendingFetches.has(key)) {
      return this.pendingFetches.get(key)!;
    }

    const audioUrl = `${API_BASE}/tts/article/${articleId}?rank=${rank}&voice=${encodeURIComponent(selectedVoice)}`;

    const fetchPromise = (async () => {
      try {
        const response = await fetch(audioUrl);
        if (!response.ok) {
          throw new Error(`TTS preload failed HTTP ${response.status}`);
        }
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        this.blobCache.set(key, blobUrl);

        // Giới hạn RAM cache tối đa 10 blob url gần nhất để tránh tốn bộ nhớ
        if (this.blobCache.size > 12) {
          const firstKey = this.blobCache.keys().next().value;
          if (firstKey && firstKey !== key) {
            const oldUrl = this.blobCache.get(firstKey);
            if (oldUrl) {
              try { URL.revokeObjectURL(oldUrl); } catch {}
            }
            this.blobCache.delete(firstKey);
          }
        }

        return blobUrl;
      } catch (err) {
        console.warn(`Lỗi preload audio bài #${rank} (ID: ${articleId}):`, err);
        return audioUrl; // Fallback về direct URL nếu fetch blob gặp lỗi
      } finally {
        this.pendingFetches.delete(key);
      }
    })();

    this.pendingFetches.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Khởi tạo hoặc tái sử dụng instance Audio duy nhất được User Click cấp quyền
   */
  private static getOrCreateAudio(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      this.audio.setAttribute('playsinline', 'true');
      this.audio.setAttribute('webkit-playsinline', 'true');
    }
    return this.audio;
  }

  /**
   * Yêu cầu Screen WakeLock để điện thoại không rơi vào trạng thái ngủ đông khi đang phát
   */
  private static async requestWakeLock() {
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      try {
        if (!this.wakeLock) {
          this.wakeLock = await (navigator as any).wakeLock.request('screen');
          this.wakeLock.addEventListener('release', () => {
            this.wakeLock = null;
          });
        }
      } catch {
        // ignore
      }
    }
  }

  private static releaseWakeLock() {
    if (this.wakeLock) {
      try {
        this.wakeLock.release();
      } catch {}
      this.wakeLock = null;
    }
  }

  /**
   * Cập nhật thông tin lên Màn hình khóa điện thoại (MediaSession Widget)
   */
  private static updateMediaSession(article: Article, rank: number) {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: `[#${rank}] ${article.title}`,
          artist: 'TECH PULSE - AI News Radio',
          album: 'Bản tin AI & Công nghệ nổi bật',
          artwork: [
            { src: '/favicon.svg', sizes: '96x96', type: 'image/svg+xml' },
            { src: '/icons.svg', sizes: '192x192', type: 'image/svg+xml' },
          ],
        });
        navigator.mediaSession.playbackState = 'playing';
      } catch {
        // ignore
      }
    }
  }

  /**
   * Bắt đầu phát danh sách bài viết (Playlist) liên tục chuẩn Mobile Background:
   * - Tự động chuyển bài tức thì ngay trong sự kiện onended
   * - Tải trước Blob của 2 bài tiếp theo vào RAM
   * - Hoạt động bền bỉ khi tắt màn hình hoặc chuyển ứng dụng khác
   */
  public static startPlaylist(
    articles: Article[],
    startIndex: number = 0,
    callbacks?: TTSPlaylistCallbacks,
    voice?: string
  ) {
    if (!articles || articles.length === 0) return;

    this.playlist = [...articles];
    this.currentIndex = Math.max(0, Math.min(startIndex, articles.length - 1));
    this.callbacks = callbacks || {};
    if (voice) {
      this.setVoice(voice);
    }

    this.requestWakeLock();
    this.playCurrentTrack();
  }

  /**
   * Phát bài hiện tại trong danh sách
   */
  private static async playCurrentTrack() {
    if (this.currentIndex < 0 || this.currentIndex >= this.playlist.length) {
      this.stop();
      if (this.callbacks.onPlaylistFinished) {
        this.callbacks.onPlaylistFinished();
      }
      return;
    }

    const currentArticle = this.playlist[this.currentIndex];
    const rank = this.currentIndex + 1;
    const selectedVoice = this.getVoice();
    const audio = this.getOrCreateAudio();

    // Dọn dẹp listeners cũ
    audio.onloadedmetadata = null;
    audio.oncanplay = null;
    audio.onplay = null;
    audio.onpause = null;
    audio.onended = null;
    audio.onerror = null;

    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {}

    // 1. Kiểm tra xem bài hiện tại đã có Blob URL trong cache chưa
    const key = this.getCacheKey(currentArticle.id, rank, selectedVoice);
    let playableSrc = this.blobCache.get(key);

    if (!playableSrc) {
      playableSrc = `${API_BASE}/tts/article/${currentArticle.id}?rank=${rank}&voice=${encodeURIComponent(selectedVoice)}`;
    }

    audio.src = playableSrc;
    audio.preload = 'auto';
    this.isPausedState = false;

    try {
      audio.load();
    } catch {}

    this.updateMediaSession(currentArticle, rank);

    const applyRate = () => {
      try {
        audio.playbackRate = this.getPlaybackRate();
      } catch {}
    };

    audio.onloadedmetadata = applyRate;
    audio.oncanplay = applyRate;

    audio.onplay = () => {
      applyRate();
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
      if (this.callbacks.onArticleStart) {
        this.callbacks.onArticleStart(currentArticle, rank);
      }

      // 2. KHI BÀI HIỆN TẠI BẮT ĐẦU PHÁT: Tải trước Blob của 2 bài kế tiếp ngay lập tức!
      // Việc này đảm bảo khi bài hiện tại kết thúc, bài tiếp theo ĐÃ CÓ SẴN TRONG RAM!
      this.preloadUpcomingTracks();
    };

    audio.onpause = () => {
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && this.isPausedState) {
        navigator.mediaSession.playbackState = 'paused';
      }
    };

    // 3. SỰ KIỆN QUAN TRỌNG NHẤT: ONENDED
    // Chuyển bài ĐỒNG BỘ trong cùng luồng sự kiện để iOS Safari / Android Chrome không tắt web
    audio.onended = () => {
      this.isPausedState = false;
      const finishedArticle = this.playlist[this.currentIndex];
      const finishedRank = this.currentIndex + 1;

      // Báo cho UI React biết bài này đã kết thúc
      if (this.callbacks.onArticleEnd) {
        try {
          this.callbacks.onArticleEnd(finishedArticle, finishedRank);
        } catch (e) {
          console.error('Lỗi onArticleEnd callback:', e);
        }
      }

      if (this.isContinuousAutoplay && this.currentIndex + 1 < this.playlist.length) {
        this.currentIndex++;
        // Phát bài kế tiếp NGAY LẬP TỨC (0ms)
        this.playCurrentTrack();
      } else {
        this.stop();
        if (this.callbacks.onPlaylistFinished) {
          this.callbacks.onPlaylistFinished();
        }
      }
    };

    audio.onerror = (e) => {
      if (audio.error && audio.error.code === 1) {
        // MEDIA_ERR_ABORTED do user đổi bài, bỏ qua
        return;
      }
      console.error('Lỗi khi phát audio bài viết:', e, audio.error);
      this.isPausedState = false;

      if (this.callbacks.onError) {
        this.callbacks.onError(e, currentArticle);
      }

      // Tự động bỏ qua bài lỗi và phát bài tiếp theo sau 200ms để không bị kẹt
      if (this.isContinuousAutoplay && this.currentIndex + 1 < this.playlist.length) {
        this.currentIndex++;
        setTimeout(() => {
          this.playCurrentTrack();
        }, 200);
      }
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (err && (err.name === 'AbortError' || err.code === 20)) {
          return;
        }
        console.warn('Lỗi audio.play():', err);
        if (this.callbacks.onError) {
          this.callbacks.onError(err, currentArticle);
        }
      });
    }
  }

  /**
   * Tải trước Blob ngầm cho bài N+1 và N+2
   */
  private static preloadUpcomingTracks() {
    const selectedVoice = this.getVoice();
    // Tải bài kế tiếp N+1
    if (this.currentIndex + 1 < this.playlist.length) {
      const nextArt = this.playlist[this.currentIndex + 1];
      this.preloadArticleAudio(nextArt.id, this.currentIndex + 2, selectedVoice);
    }
    // Tải trước thêm bài N+2 để chuẩn bị sẵn
    if (this.currentIndex + 2 < this.playlist.length) {
      const nextArt2 = this.playlist[this.currentIndex + 2];
      this.preloadArticleAudio(nextArt2.id, this.currentIndex + 3, selectedVoice);
    }
  }

  /**
   * Chuyển sang bài tiếp theo (Next track) - Hỗ trợ cả nút bấm tai nghe Bluetooth & Lock Screen
   */
  public static playNext() {
    if (this.currentIndex + 1 < this.playlist.length) {
      const finishedArt = this.playlist[this.currentIndex];
      if (this.callbacks.onArticleEnd && finishedArt) {
        this.callbacks.onArticleEnd(finishedArt, this.currentIndex + 1);
      }
      this.currentIndex++;
      this.playCurrentTrack();
    } else {
      this.stop();
      if (this.callbacks.onPlaylistFinished) {
        this.callbacks.onPlaylistFinished();
      }
    }
  }

  /**
   * Quay lại bài trước đó (Previous track)
   */
  public static playPrevious() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.playCurrentTrack();
    } else {
      if (this.audio) {
        this.audio.currentTime = 0;
      }
    }
  }

  /**
   * Tạm dừng
   */
  public static pause() {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
      this.isPausedState = true;
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    }
  }

  /**
   * Tiếp tục phát
   */
  public static resume() {
    if (this.audio && this.audio.paused) {
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
      this.isPausedState = false;
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    }
  }

  /**
   * Dừng hẳn
   */
  public static stop() {
    this.releaseWakeLock();
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.src = '';
      } catch {}
      this.isPausedState = false;
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
    }
    this.currentIndex = -1;
  }

  public static isSpeaking(): boolean {
    return !!this.audio && !this.audio.paused;
  }

  public static isPaused(): boolean {
    return this.isPausedState;
  }

  public static getCurrentArticle(): Article | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.playlist.length) {
      return this.playlist[this.currentIndex];
    }
    return null;
  }

  public static getCurrentIndex(): number {
    return this.currentIndex;
  }

  /**
   * Đăng ký sự kiện MediaSession toàn cục (Lock Screen Widget & Phím tai nghe)
   */
  public static initMediaSession(extraHandlers?: {
    onPlay?: () => void;
    onPause?: () => void;
    onNext?: () => void;
    onPrevious?: () => void;
    onStop?: () => void;
  }) {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          this.resume();
          if (extraHandlers?.onPlay) extraHandlers.onPlay();
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          this.pause();
          if (extraHandlers?.onPause) extraHandlers.onPause();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          this.playNext();
          if (extraHandlers?.onNext) extraHandlers.onNext();
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          this.playPrevious();
          if (extraHandlers?.onPrevious) extraHandlers.onPrevious();
        });
        navigator.mediaSession.setActionHandler('stop', () => {
          this.stop();
          if (extraHandlers?.onStop) extraHandlers.onStop();
        });
      } catch (e) {
        console.warn('Lỗi cấu hình mediaSession handlers:', e);
      }
    }
  }

  /**
   * Phát audio bản xem trước phát âm hoặc phân tích chuyên sâu
   */
  public static playAudioBlob(blob: Blob): HTMLAudioElement {
    const blobUrl = URL.createObjectURL(blob);
    const audio = new Audio(blobUrl);
    audio.playbackRate = this.getPlaybackRate();
    audio.play().catch(() => {});
    audio.onended = () => {
      try { URL.revokeObjectURL(blobUrl); } catch {}
    };
    return audio;
  }
}
