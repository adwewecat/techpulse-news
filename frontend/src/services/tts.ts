import { API_BASE } from './api';

export class VietnameseTTS {
  private static audio: HTMLAudioElement | null = null;
  private static isPausedState: boolean = false;
  private static currentRate: number = 1.25; // Mặc định 1.25x nhanh, rõ, mạch lạc

  private static currentVoice: string = 'vi-VN-HoaiMyNeural';

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

  private static preloadedKeys: Set<string> = new Set();

  /**
   * Tải trước ngầm (Preload/Prefetch) âm thanh của bài viết tiếp theo:
   * - Kích hoạt Backend Render sinh trước file MP3 và lưu vào RAM Cache
   * - Nạp trước vào browser cache để khi chuyển bài phát ngay lập tức (0s delay)
   */
  public static preloadArticleAudio(articleId: number, rank: number, voice?: string) {
    if (!articleId) return;
    const selectedVoice = voice || this.getVoice();
    const key = `${articleId}_${rank}_${selectedVoice}`;
    if (this.preloadedKeys.has(key)) return;
    this.preloadedKeys.add(key);

    const audioUrl = `${API_BASE}/tts/article/${articleId}?rank=${rank}&voice=${encodeURIComponent(selectedVoice)}`;

    // 1. Tải ngầm bằng fetch để backend sinh xong và lưu vào RAM/Disk cache
    fetch(audioUrl)
      .then((res) => res.blob())
      .catch(() => {});

    // 2. Nạp trước qua thẻ Audio để trình duyệt decode & cache sẵn
    try {
      const preloader = new Audio();
      preloader.preload = 'auto';
      preloader.src = audioUrl;
      preloader.load();
    } catch {
      // ignore
    }
  }

  /**
   * Khởi tạo các sự kiện MediaSession (điều khiển trên màn hình khóa điện thoại Android / iOS / Dynamic Island)
   */
  public static initMediaSession(handlers: {
    onPlay?: () => void;
    onPause?: () => void;
    onNext?: () => void;
    onStop?: () => void;
  }) {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        if (handlers.onPlay) navigator.mediaSession.setActionHandler('play', handlers.onPlay);
        if (handlers.onPause) navigator.mediaSession.setActionHandler('pause', handlers.onPause);
        if (handlers.onNext) navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext);
        if (handlers.onStop) navigator.mediaSession.setActionHandler('stop', handlers.onStop);
      } catch (e) {
        console.warn('Lỗi cấu hình mediaSession handlers:', e);
      }
    }
  }

  /**
   * Phát âm thanh Tiếng Việt chuẩn 100% từ API backend:
   * - Tái sử dụng một instance Audio duy nhất đã được User Click cấp quyền
   * - Hỗ trợ phát ngầm khi tắt màn hình điện thoại (Mobile Background Playback & MediaSession)
   * - Giọng đọc Tiếng Việt tự nhiên Neural siêu mượt (Hoài My Nữ, Nam Minh Nam, Google)
   * - Tự động dịch tiêu đề/nội dung sang Tiếng Việt nếu là tin quốc tế
   * - Hỗ trợ chọn tốc độ đọc (1.0x, 1.25x, 1.5x, 1.75x, 2.0x)
   */
  public static playArticleAudio(
    articleId: number,
    rank: number,
    voice?: string,
    articleTitle?: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: any) => void
  ) {
    // Tái sử dụng đối tượng Audio duy nhất đã được User Click cấp quyền
    if (!this.audio) {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      // Thuộc tính quan trọng cho iOS/Android chạy âm thanh inline và không bị ngắt khi tắt màn hình
      this.audio.setAttribute('playsinline', 'true');
      this.audio.setAttribute('webkit-playsinline', 'true');
    } else {
      try {
        this.audio.pause();
      } catch {
        // ignore
      }
    }

    const audio = this.audio;
    const selectedVoice = voice || this.getVoice();
    const audioUrl = `${API_BASE}/tts/article/${articleId}?rank=${rank}&voice=${encodeURIComponent(selectedVoice)}`;
    audio.src = audioUrl;
    audio.preload = 'auto';
    this.isPausedState = false;

    // Cập nhật thông tin lên Màn hình khóa điện thoại (Lock Screen Widget trên iOS / Android)
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: articleTitle ? `[#${rank}] ${articleTitle}` : `Tin số #${rank}`,
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

    const applyRate = () => {
      try {
        audio.playbackRate = this.getPlaybackRate();
      } catch {
        // ignore
      }
    };

    audio.onloadedmetadata = applyRate;
    audio.oncanplay = applyRate;

    audio.onplay = () => {
      applyRate();
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
      if (onStart) onStart();
    };

    audio.onpause = () => {
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator && this.isPausedState) {
        navigator.mediaSession.playbackState = 'paused';
      }
    };

    audio.onended = () => {
      this.isPausedState = false;
      if (onEnd) onEnd();
    };

    audio.onerror = (e) => {
      // Nếu là MEDIA_ERR_ABORTED (mã 1), do chuyển bài hoặc đổi giọng, không phải lỗi thực tế
      if (audio.error && audio.error.code === 1) {
        return;
      }
      console.error('Lỗi khi phát âm thanh tiếng Việt:', e, audio.error);
      this.isPausedState = false;
      if (onError) onError(e);
    };

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch((err) => {
        if (err && (err.name === 'AbortError' || err.code === 20)) {
          // Bỏ qua lỗi ngắt do người dùng bấm đổi bài hoặc dừng đọc
          return;
        }
        if (err && err.name === 'NotAllowedError') {
          console.warn('Trình duyệt chặn autoplay âm thanh chưa tương tác:', err);
          if (onError) onError(new Error('Vui lòng bấm nút Nghe đọc để cấp quyền âm thanh cho trình duyệt'));
          return;
        }
        console.warn('Lỗi khi phát âm thanh:', err);
        if (onError) onError(err);
      });
    }
  }

  public static pause() {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
      this.isPausedState = true;
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'paused';
      }
    }
  }

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

  public static stop() {
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.audio.src = '';
      } catch {
        // ignore
      }
      this.isPausedState = false;
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
    }
  }

  public static isSpeaking(): boolean {
    return !!this.audio && !this.audio.paused;
  }

  public static isPaused(): boolean {
    return this.isPausedState;
  }
}
