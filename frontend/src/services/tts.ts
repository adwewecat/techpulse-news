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

  /**
   * Phát âm thanh Tiếng Việt chuẩn 100% từ API backend:
   * - Tái sử dụng một instance Audio duy nhất để không bị trình duyệt chặn Autoplay khi chuyển bài
   * - Giọng đọc Tiếng Việt tự nhiên Neural siêu mượt (Hoài My Nữ, Nam Minh Nam, Google)
   * - Tự động dịch tiêu đề/nội dung sang Tiếng Việt nếu là tin quốc tế
   * - Hỗ trợ chọn tốc độ đọc (1.0x, 1.25x, 1.5x, 1.75x, 2.0x)
   */
  public static playArticleAudio(
    articleId: number,
    rank: number,
    voice?: string,
    onStart?: () => void,
    onEnd?: () => void,
    onError?: (err: any) => void
  ) {
    // Tái sử dụng đối tượng Audio duy nhất đã được User Click cấp quyền
    if (!this.audio) {
      this.audio = new Audio();
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
    audio.currentTime = 0;
    this.isPausedState = false;

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
      if (onStart) onStart();
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
    }
  }

  public static resume() {
    if (this.audio && this.audio.paused) {
      const playPromise = this.audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
      this.isPausedState = false;
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
    }
  }

  public static isSpeaking(): boolean {
    return !!this.audio && !this.audio.paused;
  }

  public static isPaused(): boolean {
    return this.isPausedState;
  }
}
