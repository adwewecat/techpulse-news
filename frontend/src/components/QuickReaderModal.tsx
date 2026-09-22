import React, { useEffect } from 'react';
import { 
  X, ExternalLink, Flame, Sparkles, Layers, 
  CheckCircle2, Share2, Check 
} from 'lucide-react';
import type { Article } from '../types/news';

interface QuickReaderModalProps {
  article: Article | null;
  onClose: () => void;
}

export const QuickReaderModal: React.FC<QuickReaderModalProps> = ({ article, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!article) return null;

  const handleShare = () => {
    navigator.clipboard.writeText(article.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(4, 7, 13, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '20px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '0.25rem 0.6rem',
              borderRadius: '6px',
              background: article.region === 'vietnam' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(56, 189, 248, 0.2)',
              color: article.region === 'vietnam' ? '#fca5a5' : '#7dd3fc',
            }}>
              {article.region === 'vietnam' ? '🇻🇳 VIỆT NAM' : '🌎 THẾ GIỚI'}
            </span>

            <span style={{
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              fontWeight: 600,
            }}>
              {article.source_name}
            </span>

            {article.hot_score > 0 && (
              <span style={{
                fontSize: '0.75rem',
                color: '#ff7849',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.2rem',
                background: 'rgba(255, 87, 34, 0.12)',
                padding: '0.2rem 0.5rem',
                borderRadius: '6px',
              }}>
                <Flame size={12} />
                {article.hot_score} điểm nóng
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              onClick={handleShare}
              title="Sao chép liên kết"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                color: copied ? '#10b981' : 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              {copied ? <Check size={16} /> : <Share2 size={16} />}
            </button>

            <button
              onClick={onClose}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: 'none',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{
          padding: '1.5rem',
          overflowY: 'auto',
          flex: 1,
        }}>
          {/* Headline */}
          <h1 style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            lineHeight: 1.4,
            marginBottom: '1rem',
            color: '#fff',
          }}>
            {article.title}
          </h1>

          {/* AI TL;DR Section */}
          {article.summary_short && (
            <div style={{
              padding: '1rem 1.2rem',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(168, 85, 247, 0.12) 100%)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              marginBottom: '1.25rem',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: '#a5b4fc',
                fontWeight: 700,
                fontSize: '0.85rem',
                marginBottom: '0.45rem',
              }}>
                <Sparkles size={16} color="#818cf8" />
                <span>BẢN TÓM TẮT SIÊU NHANH (TL;DR)</span>
              </div>
              <p style={{
                fontSize: '0.95rem',
                lineHeight: 1.6,
                color: '#e2e8f0',
              }}>
                {article.summary_short}
              </p>
            </div>
          )}

          {/* Key Takeaways Bullets */}
          {article.summary_bullets && article.summary_bullets.length > 0 && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: '#cbd5e1',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}>
                <CheckCircle2 size={16} color="#10b981" />
                <span>3 ĐIỂM CỐT LÕI QUAN TRỌNG NHẤT</span>
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {article.summary_bullets.map((b, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.65rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <span style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}>
                      {i + 1}
                    </span>
                    <span style={{
                      fontSize: '0.88rem',
                      color: '#cbd5e1',
                      lineHeight: 1.5,
                    }}>
                      {b}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Related Articles in Same Story Cluster */}
          {article.related_articles && article.related_articles.length > 0 && (
            <div style={{
              padding: '1.25rem',
              borderRadius: '14px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              marginBottom: '1.25rem',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                color: '#38bdf8',
                fontWeight: 700,
                fontSize: '0.85rem',
                marginBottom: '0.85rem',
              }}>
                <Layers size={16} />
                <span>CÁC BÁO CHÍ CÙNG ĐƯA TIN VỀ SỰ VIỆC NÀY ({article.related_articles.length + 1} nguồn)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {article.related_articles.map((rel) => (
                  <a
                    key={rel.id}
                    href={rel.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      color: '#cbd5e1',
                      textDecoration: 'none',
                      fontSize: '0.82rem',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)')}
                  >
                    <span style={{ flex: 1, fontWeight: 500 }}>
                      <strong style={{ color: '#93c5fd', marginRight: '0.5rem' }}>[{rel.source_name}]</strong>
                      {rel.title}
                    </span>
                    <ExternalLink size={14} color="var(--text-muted)" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(10, 15, 26, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#cbd5e1',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Đóng
          </button>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.6rem 1.25rem',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              color: '#fff',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 0 16px rgba(99, 102, 241, 0.4)',
            }}
          >
            <span>Mở bài viết gốc trên {article.source_name}</span>
            <ExternalLink size={15} />
          </a>
        </div>
      </div>
      <style>{`
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.96);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
};
