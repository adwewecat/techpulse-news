import React, { useState } from 'react';
import { 
  Flame, Zap, Clock, ExternalLink, Layers, 
  ChevronDown, ChevronUp, Sparkles, Share2, Check
} from 'lucide-react';
import type { Article } from '../types/news';

interface NewsCardProps {
  article: Article;
  onOpenReader: (article: Article) => void;
  onTrackClick: (id: number) => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({
  article,
  onOpenReader,
  onTrackClick,
}) => {
  const [showBullets, setShowBullets] = useState(false);
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

  const handleCardClick = () => {
    onTrackClick(article.id);
    onOpenReader(article);
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
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '1.15rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div>
        {/* Top Meta Line: Source, Time, Badges */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.85rem',
          flexWrap: 'wrap',
          gap: '0.4rem',
        }}>
          {/* Source & Region Tag */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: '#f1f5f9',
              background: 'rgba(255, 255, 255, 0.08)',
              padding: '0.2rem 0.55rem',
              borderRadius: '6px',
            }}>
              {article.source_name}
            </span>
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
            {article.badge === 'hot' && (
              <span className="badge-hot" style={{
                fontSize: '0.68rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}>
                <Flame size={12} />
                HOT
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
                <Zap size={12} />
                TĂNG TỐC
              </span>
            )}
            {article.badge === 'new' && (
              <span className="badge-new" style={{
                fontSize: '0.68rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '6px',
              }}>
                MỚI
              </span>
            )}
            {article.badge === 'special' && article.category === 'special' && (
              <span style={{
                fontSize: '0.68rem',
                padding: '0.15rem 0.55rem',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(5,150,105,0.15))',
                border: '1px solid rgba(16,185,129,0.5)',
                color: '#6ee7b7',
                fontWeight: 700,
              }}>
                {article.source_name.includes('thời tiết') || article.source_name.includes('Thời tiết') ? '🌤 DỰ BÁO' : '💛 GIÁ VÀNG'}
              </span>
            )}
          </div>
        </div>


        {/* Thumbnail & Title Container */}
        <div style={{ display: 'flex', gap: '0.85rem', marginBottom: '0.75rem' }}>
          {/* Optional Image */}
          {article.image_url ? (
            <div style={{
              flex: '0 0 92px',
              height: '84px',
              borderRadius: '10px',
              overflow: 'hidden',
              background: '#1e293b',
            }}>
              <img
                src={article.image_url}
                alt={article.title}
                loading="lazy"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
          ) : null}

          {/* Headline */}
          <div style={{ flex: 1 }}>
            <h2
              onClick={handleCardClick}
              style={{
                fontSize: '1rem',
                fontWeight: 700,
                lineHeight: 1.4,
                color: '#f8fafc',
                cursor: 'pointer',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#38bdf8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#f8fafc')}
            >
              {article.title}
            </h2>
          </div>
        </div>

        {/* AI TL;DR Quick Bite */}
        {article.summary_short && (
          <div style={{
            padding: '0.65rem 0.85rem',
            borderRadius: '10px',
            background: 'rgba(99, 102, 241, 0.08)',
            borderLeft: '3px solid #6366f1',
            marginBottom: '0.75rem',
          }}>
            <p style={{
              fontSize: '0.82rem',
              color: '#cbd5e1',
              lineHeight: 1.45,
            }}>
              <strong style={{ color: article.category === 'tech_vn' || article.category === 'tech_world' ? '#38bdf8' : '#a5b4fc' }}>
                {article.category === 'tech_vn' || article.category === 'tech_world' ? '⚡ Phân tích sâu đa nguồn: ' : '💡 Tóm tắt: '}
              </strong>
              {article.summary_short}
            </p>
          </div>
        )}

        {/* Multi-source coverage badge */}
        {article.related_sources_count > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.65rem',
            borderRadius: '8px',
            background: 'rgba(56, 189, 248, 0.1)',
            border: '1px solid rgba(56, 189, 248, 0.25)',
            fontSize: '0.75rem',
            color: '#38bdf8',
            fontWeight: 600,
            marginBottom: '0.75rem',
          }}>
            <Layers size={14} />
            <span>Có {article.related_sources_count} báo chí khác cùng đưa tin về sự việc này</span>
          </div>
        )}

        {/* Expandable Key Takeaways Bullets */}
        {article.summary_bullets && article.summary_bullets.length > 0 && (
          <div style={{ marginBottom: '0.75rem' }}>
            <button
              onClick={() => setShowBullets(!showBullets)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '0.2rem 0',
              }}
            >
              <Sparkles size={13} color="#a855f7" />
              <span>{showBullets ? 'Ẩn 3 điểm cốt lõi' : 'Xem 3 điểm cốt lõi'}</span>
              {showBullets ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {showBullets && (
              <ul style={{
                marginTop: '0.5rem',
                fontSize: '0.8rem',
                color: '#cbd5e1',
                lineHeight: 1.5,
                background: 'rgba(15, 23, 42, 0.4)',
                padding: '0.6rem 0.75rem 0.6rem 1.6rem',
                borderRadius: '8px',
              }}>
                {article.summary_bullets.map((b, i) => (
                  <li key={i} style={{ marginBottom: '0.3rem' }}>{b}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.35rem',
            marginBottom: '0.85rem',
          }}>
            {article.tags.slice(0, 3).map((t, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '0.68rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '5px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: 'var(--text-secondary)',
                }}
              >
                #{t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card Action Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: '0.75rem',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
      }}>
        {/* Quick Read Button */}
        <button
          onClick={handleCardClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.4rem 0.75rem',
            borderRadius: '8px',
            background: 'rgba(99, 102, 241, 0.15)',
            color: '#a5b4fc',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.3)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)')}
        >
          <Sparkles size={14} color="#818cf8" />
          <span>Đọc nhanh</span>
        </button>

        {/* External Link & Share */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
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

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              e.stopPropagation();
              onTrackClick(article.id);
            }}
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
