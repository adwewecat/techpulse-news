import React, { useRef } from 'react';
import { Flame, ChevronLeft, ChevronRight, Layers, Sparkles } from 'lucide-react';
import type { Article } from '../types/news';

interface Top6hBannerProps {
  articles: Article[];
  onSelectArticle: (article: Article) => void;
}

export const Top6hBanner: React.FC<Top6hBannerProps> = ({ articles, onSelectArticle }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!articles || articles.length === 0) return null;

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const offset = direction === 'left' ? -340 : 340;
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const getRankBadgeStyle = (index: number) => {
    if (index === 0) {
      return {
        background: 'linear-gradient(135deg, #ffd700, #ff8c00)',
        color: '#000',
        boxShadow: '0 0 10px rgba(255, 215, 0, 0.5)',
      };
    }
    if (index === 1) {
      return {
        background: 'linear-gradient(135deg, #e2e8f0, #94a3b8)',
        color: '#000',
      };
    }
    if (index === 2) {
      return {
        background: 'linear-gradient(135deg, #d97706, #b45309)',
        color: '#fff',
      };
    }
    return {
      background: 'rgba(255, 255, 255, 0.12)',
      color: '#cbd5e1',
    };
  };

  return (
    <section style={{
      margin: '1.5rem 0 2rem 0',
      padding: '1.25rem',
      borderRadius: '16px',
      background: 'linear-gradient(180deg, rgba(255, 87, 34, 0.08) 0%, rgba(15, 23, 42, 0.6) 100%)',
      border: '1px solid rgba(255, 87, 34, 0.25)',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      position: 'relative',
    }}>
      {/* Banner Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #ff4500, #ff8c00)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 12px rgba(255, 69, 0, 0.5)',
          }}>
            <Flame size={18} color="#fff" />
          </div>
          <div>
            <h2 style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}>
              🔥 10 TIN NỔI BẬT NHẤT 6 GIỜ QUA
            </h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Được AI tổng hợp & xếp hạng tự động: Nhiều nguồn cùng đưa tin • Tốc độ bùng nổ • Lượt đọc cao
            </p>
          </div>
        </div>

        {/* Carousel Arrow Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <button
            onClick={() => scroll('left')}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scroll('right')}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div
        ref={scrollRef}
        className="hide-scrollbar"
        style={{
          display: 'flex',
          gap: '1rem',
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          paddingBottom: '0.5rem',
        }}
      >
        {articles.slice(0, 10).map((art, idx) => (
          <div
            key={art.id}
            onClick={() => onSelectArticle(art)}
            style={{
              flex: '0 0 310px',
              scrollSnapAlign: 'start',
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '1rem',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 0.2s ease',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 87, 34, 0.5)';
              e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* Top Bar inside card */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}>
                <span style={{
                  ...getRankBadgeStyle(idx),
                  width: '24px',
                  height: '24px',
                  borderRadius: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  #{idx + 1}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontWeight: 600,
                }}>
                  {art.source_name}
                </span>
              </div>

              {/* Hot Score Pill */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
                background: 'rgba(255, 87, 34, 0.15)',
                color: '#ff7849',
                fontSize: '0.72rem',
                fontWeight: 700,
                border: '1px solid rgba(255, 87, 34, 0.3)',
              }}>
                <Flame size={12} />
                <span>{art.hot_score} đ</span>
              </div>
            </div>

            {/* Title */}
            <h3 style={{
              fontSize: '0.92rem',
              fontWeight: 700,
              lineHeight: 1.4,
              marginBottom: '0.75rem',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              color: '#f8fafc',
            }}>
              {art.title}
            </h3>

            {/* Bottom Meta */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: '0.6rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {art.related_sources_count > 1 ? (
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.2rem',
                    color: '#38bdf8',
                    fontWeight: 600,
                  }}>
                    <Layers size={13} />
                    {art.related_sources_count} nguồn báo
                  </span>
                ) : (
                  <span>1 nguồn</span>
                )}
                <span>•</span>
                <span>{art.region === 'vietnam' ? '🇻🇳 VN' : '🌎 Quốc tế'}</span>
              </div>

              <span style={{
                color: '#a855f7',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
              }}>
                <Sparkles size={12} />
                Đọc tóm tắt
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
