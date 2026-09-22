import React from 'react';
import { Play, Pause, Square, SkipForward, Volume2, Gauge, Mic } from 'lucide-react';
import type { Article } from '../types/news';

export const VOICE_OPTIONS = [
  { id: 'vi-VN-HoaiMyNeural', label: '🌸 Hoài My (Nữ - Truyền cảm)', shortLabel: 'Hoài My (Nữ)' },
  { id: 'vi-VN-NamMinhNeural', label: '🎙️ Nam Minh (Nam - Trầm ấm)', shortLabel: 'Nam Minh (Nam)' },
  { id: 'google-vi', label: '🔊 Google Nữ (Cơ bản)', shortLabel: 'Google Nữ' },
];

interface AudioPlayerBarProps {
  currentArticle: Article | null;
  isPlaying: boolean;
  isPaused: boolean;
  autoplayNext: boolean;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  currentIndex: number;
  totalArticles: number;
  onPlay: (article: Article) => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onNext: () => void;
  onToggleAutoplay: () => void;
  onPlayAll: () => void;
}

const SPEED_OPTIONS = [1.0, 1.25, 1.5, 1.75, 2.0];

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  currentArticle,
  isPlaying,
  isPaused,
  autoplayNext,
  playbackSpeed,
  onSpeedChange,
  selectedVoice,
  onVoiceChange,
  currentIndex,
  totalArticles,
  onPause,
  onResume,
  onStop,
  onNext,
  onToggleAutoplay,
  onPlayAll,
}) => {
  return (
    <div
      style={{
        position: 'sticky',
        top: '64px',
        zIndex: 35,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 87, 34, 0.3)',
        borderRadius: '16px',
        padding: '0.85rem 1.25rem',
        margin: '1rem 0 1.5rem 0',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
      }}
    >
      {/* Left: Info / Current Playing State */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '1 1 280px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: isPlaying
            ? 'linear-gradient(135deg, #ff4500, #ff8c00)'
            : 'rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isPlaying ? '0 0 14px rgba(255, 87, 34, 0.5)' : 'none',
          flexShrink: 0,
        }}>
          <Volume2 size={20} color="#fff" />
        </div>

        <div style={{ overflow: 'hidden' }}>
          {currentArticle ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.15rem' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: '#ff7849',
                  background: 'rgba(255, 87, 34, 0.15)',
                  padding: '0.1rem 0.4rem',
                  borderRadius: '4px',
                }}>
                  ĐANG ĐỌC #{currentIndex + 1}/{totalArticles} ({playbackSpeed}x)
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {currentArticle.source_name}
                </span>
              </div>
              <p style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '420px',
              }}>
                {currentArticle.title}
              </p>
            </div>
          ) : (
            <div>
              <p style={{ fontSize: '0.88rem', fontWeight: 700, color: '#f8fafc' }}>
                🎙️ Trình Đọc Tin Tiếng Việt Tự Động
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Tóm tắt AI sâu sắc • Tự động chuyển qua tab Đã đọc
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Right: Controls + Speed Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        {/* Voice Selector */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '0.25rem 0.45rem',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <Mic size={13} color="#ff7849" />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: '0.15rem' }}>Giọng:</span>
          <select
            value={selectedVoice}
            onChange={(e) => onVoiceChange(e.target.value)}
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 87, 34, 0.4)',
              color: '#f8fafc',
              borderRadius: '6px',
              padding: '0.15rem 0.35rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id} style={{ background: '#0f172a', color: '#f8fafc' }}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        {/* Speed Selector */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          background: 'rgba(255, 255, 255, 0.05)',
          padding: '0.25rem 0.45rem',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}>
          <Gauge size={13} color="#94a3b8" />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: '0.15rem' }}>Tốc độ:</span>
          {SPEED_OPTIONS.map((spd) => (
            <button
              key={spd}
              onClick={() => onSpeedChange(spd)}
              style={{
                background: playbackSpeed === spd ? 'rgba(255, 87, 34, 0.3)' : 'transparent',
                border: playbackSpeed === spd ? '1px solid #ff5722' : 'none',
                color: playbackSpeed === spd ? '#ff9e80' : 'var(--text-secondary)',
                borderRadius: '5px',
                padding: '0.15rem 0.35rem',
                fontSize: '0.72rem',
                fontWeight: playbackSpeed === spd ? 800 : 500,
                cursor: 'pointer',
              }}
            >
              {spd}x
            </button>
          ))}
        </div>

        {/* Autoplay continuous toggle */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.75rem',
            color: autoplayNext ? '#38bdf8' : 'var(--text-muted)',
            fontWeight: 600,
            cursor: 'pointer',
            background: autoplayNext ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255, 255, 255, 0.04)',
            padding: '0.35rem 0.55rem',
            borderRadius: '8px',
            border: autoplayNext ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <input
            type="checkbox"
            checked={autoplayNext}
            onChange={onToggleAutoplay}
            style={{ accentColor: '#38bdf8', cursor: 'pointer' }}
          />
          <span>Tự chuyển tin</span>
        </label>

        {isPlaying ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {/* Pause / Resume */}
            {isPaused ? (
              <button
                onClick={onResume}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  background: '#10b981',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Play size={14} />
                <span>Tiếp tục</span>
              </button>
            ) : (
              <button
                onClick={onPause}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Pause size={14} />
                <span>Tạm dừng</span>
              </button>
            )}

            {/* Next */}
            <button
              onClick={onNext}
              title="Chuyển sang tin tiếp theo"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#fff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <SkipForward size={16} />
            </button>

            {/* Stop */}
            <button
              onClick={onStop}
              title="Dừng phát"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Square size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={onPlayAll}
            disabled={totalArticles === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #ff5722 0%, #ff8c00 100%)',
              color: '#fff',
              fontSize: '0.82rem',
              fontWeight: 700,
              border: 'none',
              cursor: totalArticles === 0 ? 'not-allowed' : 'pointer',
              boxShadow: '0 0 16px rgba(255, 87, 34, 0.4)',
            }}
          >
            <Play size={15} fill="#fff" />
            <span>Phát tự động 30 tin</span>
          </button>
        )}
      </div>
    </div>
  );
};
