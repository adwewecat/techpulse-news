import React, { useState } from 'react';
import { 
  Flame, Zap, Clock, ExternalLink, Layers, 
  Volume2, VolumeX, CheckCheck, Undo, Sparkles, Share2, Check, Star
} from 'lucide-react';
import type { Article } from '../types/news';

interface VerticalNewsCardProps {
  article: Article;
  rank: number;
  isPlaying: boolean;
  isRead: boolean;
  isStarred: boolean;
  onPlay: (article: Article) => void;
  onStop: () => void;
  onToggleRead: (id: number) => void;
  onToggleStar: (id: number) => void;
  onOpenReader: (article: Article) => void;
  onOpenDeepAnalysis: (article: Article) => void;
}

export const VerticalNewsCard: React.FC<VerticalNewsCardProps> = ({
  article,
  rank,
  isPlaying,
  isRead,
  isStarred,
  onPlay,
  onStop,
  onToggleRead,
  onToggleStar,
  onOpenReader,
  onOpenDeepAnalysis,
}) => {
  const [copied, setCopied] = useState(false);

  // Format relative time
  const getTimeAgo = (dateStr: string) => {
    try {
      const now = new Date();
      const pub = new Date(dateStr);
      const diffMinutes = Math.max(1, Math.floor((now.getTime() - pub.getTime()) / 60000));
      if (diffMinutes < 60) return `${diffMinutes} phút trước`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours} giờ trước`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} ngày trước`;
    } catch {
      return 'Vừa xong';
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(article.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article
      className="glass-card"
      style={{
        width: '100%',
        padding: '1.25rem',
        borderRadius: '16px',
        marginBottom: '1rem',
        border: isPlaying
          ? '1px solid #ff5722'
          : isStarred
          ? '1px solid rgba(245, 158, 11, 0.45)'
          : isRead
          ? '1px solid rgba(255, 255, 255, 0.05)'
          : '1px solid rgba(255, 255, 255, 0.1)',
        background: isPlaying
          ? 'rgba(255, 87, 34, 0.07)'
          : isStarred
          ? 'linear-gradient(180deg, rgba(245, 158, 11, 0.06) 0%, rgba(15, 23, 42, 0.85) 100%)'
          : isRead
          ? 'rgba(15, 23, 42, 0.45)'
          : 'rgba(15, 23, 42, 0.8)',
        boxShadow: isPlaying
          ? '0 0 20px rgba(255, 87, 34, 0.25)'
          : isStarred
          ? '0 0 16px rgba(245, 158, 11, 0.15)'
          : 'none',
        position: 'relative',
        transition: 'all 0.25s ease',
      }}
    >
      {/* Top Meta Line: Rank, Source, Badges, Hot Score */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.75rem',
        flexWrap: 'wrap',
        gap: '0.4rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Rank Badge */}
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            padding: '0.2rem 0.55rem',
            borderRadius: '6px',
            background: rank <= 3
              ? 'linear-gradient(135deg, #ff5722, #ff8c00)'
              : 'rgba(255, 255, 255, 0.1)',
            color: '#fff',
          }}>
            #{rank}
          </span>

          {/* Source Name */}
          <span style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: '#cbd5e1',
          }}>
            {article.source_name}
          </span>

          <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>•</span>

          <span style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.2rem',
          }}>
            <Clock size={12} />
            {getTimeAgo(article.published_at)}
          </span>
        </div>

        {/* Badges & Hot Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {article.hot_score > 0 && (
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              background: 'rgba(255, 87, 34, 0.15)',
              color: '#ff7849',
              fontSize: '0.75rem',
              fontWeight: 700,
              border: '1px solid rgba(255, 87, 34, 0.3)',
            }}>
              <Flame size={12} />
              {article.hot_score}đ
            </span>
          )}

          {article.badge === 'trending' && (
            <span className="badge-trending" style={{
              fontSize: '0.68rem',
              padding: '0.15rem 0.5rem',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.2rem',
            }}>
              <Zap size={11} />
              TĂNG TỐC
            </span>
          )}

          <span style={{
            fontSize: '0.68rem',
            padding: '0.15rem 0.45rem',
            borderRadius: '5px',
            background: article.region === 'vietnam' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
            color: article.region === 'vietnam' ? '#fca5a5' : '#7dd3fc',
            fontWeight: 600,
          }}>
            {article.region === 'vietnam' ? '🇻🇳 VN' : '🌎 Quốc tế'}
          </span>

          {/* Nút Đánh Dấu Sao (Tin Quan Tâm) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(article.id);
            }}
            title={isStarred ? 'Bỏ đánh dấu sao' : 'Đánh dấu sao (Tin quan tâm & Phân tích sâu)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              background: isStarred ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.05)',
              border: isStarred ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.08)',
              color: isStarred ? '#fbbf24' : '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              marginLeft: '0.15rem',
            }}
          >
            <Star size={14} fill={isStarred ? '#fbbf24' : 'none'} />
          </button>
        </div>
      </div>

      {/* Title */}
      <h2
        onClick={() => onOpenReader(article)}
        style={{
          fontSize: '1.05rem',
          fontWeight: 700,
          lineHeight: 1.45,
          color: isRead ? '#94a3b8' : '#f8fafc',
          marginBottom: '0.75rem',
          cursor: 'pointer',
          textDecoration: isRead ? 'none' : 'none',
          transition: 'color 0.15s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
        onMouseLeave={(e) => (e.currentTarget.style.color = isRead ? '#94a3b8' : '#f8fafc')}
      >
        {article.title}
      </h2>

      {/* AI TL;DR Summary */}
      {article.summary_short && (
        <div style={{
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          background: isPlaying 
            ? 'rgba(255, 87, 34, 0.12)' 
            : isStarred 
            ? 'rgba(245, 158, 11, 0.08)' 
            : 'rgba(99, 102, 241, 0.08)',
          borderLeft: isPlaying 
            ? '3px solid #ff5722' 
            : isStarred 
            ? '3px solid #f59e0b' 
            : '3px solid #6366f1',
          marginBottom: '0.85rem',
          transition: 'all 0.25s ease',
        }}>
          <p style={{
            fontSize: '0.86rem',
            color: '#e2e8f0',
            lineHeight: 1.55,
          }}>
            <strong style={{ 
              color: isPlaying ? '#ff9e80' : isStarred ? '#fbbf24' : '#a5b4fc', 
              marginRight: '0.35rem' 
            }}>
              {isPlaying 
                ? '🔊 Đang đọc:' 
                : isStarred 
                ? '⭐ Tóm tắt chuyên sâu đa nguồn:' 
                : article.category === 'tech_vn' || article.category === 'tech_world'
                ? '⚡ Phân tích sâu đa nguồn:'
                : '💡 Tóm tắt:'}
            </strong>
            {article.summary_short}
          </p>
        </div>
      )}

      {/* Multi-source coverage badge */}
      {article.related_sources_count > 1 && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.3rem 0.65rem',
          borderRadius: '6px',
          background: 'rgba(56, 189, 248, 0.1)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          fontSize: '0.75rem',
          color: '#38bdf8',
          fontWeight: 600,
          marginBottom: '0.85rem',
        }}>
          <Layers size={13} />
          <span>Có {article.related_sources_count} báo khác cùng đưa tin về sự kiện này</span>
        </div>
      )}

      {/* Action Bar (Audio player + Mark read + Full reader + Source link) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.5rem',
        paddingTop: '0.75rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      }}>
        {/* Left: Play Audio Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isPlaying ? (
            <button
              onClick={onStop}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 0 12px rgba(239, 68, 68, 0.4)',
              }}
            >
              <VolumeX size={15} />
              <span>Dừng đọc</span>
            </button>
          ) : (
            <button
              onClick={() => onPlay(article)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #ff5722 0%, #ff8c00 100%)',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 0 12px rgba(255, 87, 34, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              <Volume2 size={15} />
              <span>Nghe đọc Tiếng Việt</span>
            </button>
          )}

          {/* Phân tích chuyên sâu AI */}
          <button
            onClick={() => onOpenDeepAnalysis(article)}
            title="Xem bản phân tích chuyên sâu đa chiều & đối chiếu nguồn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              background: isStarred 
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(217, 119, 6, 0.25))' 
                : 'rgba(245, 158, 11, 0.12)',
              color: '#fbbf24',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: isStarred ? '0 0 10px rgba(245, 158, 11, 0.2)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <Sparkles size={14} color="#f59e0b" />
            <span>Phân tích sâu AI</span>
          </button>

          {/* Đọc nhanh tóm tắt modal */}
          <button
            onClick={() => onOpenReader(article)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.45rem 0.75rem',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#a5b4fc',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <span>3 ý cốt lõi</span>
          </button>
        </div>

        {/* Right: Toggle Read & External Link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {/* Đánh dấu đã đọc / hoàn tác */}
          <button
            onClick={() => onToggleRead(article.id)}
            title={isRead ? 'Chuyển lại về chưa đọc' : 'Đánh dấu đã đọc (chuyển qua tab Đã đọc)'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.4rem 0.65rem',
              borderRadius: '8px',
              background: isRead ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: isRead ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
              color: isRead ? '#34d399' : 'var(--text-secondary)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {isRead ? (
              <>
                <Undo size={13} />
                <span>Chưa đọc</span>
              </>
            ) : (
              <>
                <CheckCheck size={14} />
                <span>Đã đọc</span>
              </>
            )}
          </button>

          {/* Share */}
          <button
            onClick={handleShare}
            title="Sao chép link"
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: copied ? '#10b981' : 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={14} /> : <Share2 size={14} />}
          </button>

          {/* Báo gốc */}
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Đến trang báo gốc"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: '0.4rem 0.65rem',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
              textDecoration: 'none',
            }}
          >
            <span>Báo gốc</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </article>
  );
};
