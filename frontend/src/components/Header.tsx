import React, { useState, useRef, useEffect } from 'react';
import { Flame, RefreshCw, Search, ChevronDown, Check, User, ShieldCheck } from 'lucide-react';
import type { CrawlStatus, StatsOverview, CrawlMode, UserProfile } from '../types/news';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  crawlStatus: CrawlStatus | null;
  stats: StatsOverview | null;
  onTriggerCrawl: (mode: CrawlMode) => void;
  isTriggering: boolean;
  userId?: string;
  currentUser: UserProfile | null;
  onOpenAuth: () => void;
}

const CRAWL_MODE_OPTIONS: { id: CrawlMode; label: string; desc: string; icon: string }[] = [
  { id: 'all', label: 'Tất cả các nguồn', desc: 'Quét toàn bộ AI, Việt Nam và Quốc tế', icon: '🌐' },
  { id: 'ai_tech', label: 'Tin A.I & Công nghệ', desc: 'Tìm 20 tin AI, chip, công nghệ hot nhất', icon: '🤖' },
  { id: 'hot_vn', label: 'Tin hot Việt Nam', desc: 'Tìm 20 tin nổi cộm hot nhất trong nước', icon: '🇻🇳' },
  { id: 'hot_world', label: 'Tin hot Quốc tế', desc: 'Tìm 20 tin hot thế giới từ nguồn uy tín', icon: '🌎' },
  { id: 'trending', label: 'Trending VN + QT', desc: 'Tìm 20 tin xu hướng bùng nổ nhất', icon: '⚡' },
];

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  crawlStatus,
  stats,
  onTriggerCrawl,
  isTriggering,
  userId,
  currentUser,
  onOpenAuth,
}) => {
  const [selectedCrawlMode, setSelectedCrawlMode] = useState<CrawlMode>('all');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatLastRun = () => {
    if (!crawlStatus?.last_run) return 'Vừa quét gần đây';
    try {
      const date = new Date(crawlStatus.last_run);
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Vừa cập nhật';
    }
  };

  const handleCrawlClick = (mode: CrawlMode) => {
    setSelectedCrawlMode(mode);
    setIsMenuOpen(false);
    onTriggerCrawl(mode);
  };

  const currentOption = CRAWL_MODE_OPTIONS.find((o) => o.id === selectedCrawlMode) || CRAWL_MODE_OPTIONS[0];

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 40,
      background: 'rgba(8, 12, 20, 0.88)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '0.75rem 0'
    }}>
      <div className="app-container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem'
      }}>
        {/* Brand & Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #ff5722 0%, #ff8c00 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(255, 87, 34, 0.45)',
          }}>
            <Flame size={24} color="#fff" strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{
                fontSize: '1.25rem',
                fontWeight: 800,
                fontFamily: 'var(--font-heading)',
                background: 'linear-gradient(to right, #ffffff, #94a3b8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                TECH PULSE
              </span>
              <span style={{
                fontSize: '0.68rem',
                padding: '0.15rem 0.45rem',
                borderRadius: '6px',
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                fontWeight: 700,
                letterSpacing: '0.05em'
              }}>
                AI RADAR
              </span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              🇻🇳 Tin Nóng & Tech VN • 🌎 Quốc Tế Hot
              {stats ? ` (${stats.total_articles} tin)` : ''}
            </p>
          </div>
        </div>

        {/* Search Box */}
        <div style={{
          position: 'relative',
          flex: '1 1 240px',
          maxWidth: '380px',
          minWidth: '200px'
        }}>
          <Search size={16} color="var(--text-muted)" style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
          }} />
          <input
            type="text"
            placeholder="Tìm tin tức, AI, thời tiết, giá vàng..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 1rem 0.55rem 2.25rem',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(15, 23, 42, 0.6)',
              color: '#fff',
              fontSize: '0.85rem',
              outline: 'none',
              transition: 'all 0.2s ease',
            }}
            onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
            onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)')}
          />
        </div>

        {/* User Auth Chip & Crawl Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {/* User Account Button */}
          {currentUser ? (
            <button
              onClick={onOpenAuth}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.75rem',
                borderRadius: '10px',
                background: currentUser.role === 'admin'
                  ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(245, 158, 11, 0.2))'
                  : 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))',
                border: currentUser.role === 'admin'
                  ? '1px solid rgba(239, 68, 68, 0.4)'
                  : '1px solid rgba(99, 102, 241, 0.4)',
                cursor: 'pointer',
                color: '#fff',
                fontSize: '0.8rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
              title="Nhấn để xem thông tin tài khoản hoặc đăng xuất"
            >
              {currentUser.role === 'admin' ? (
                <ShieldCheck size={16} color="#f87171" />
              ) : (
                <User size={16} color="#818cf8" />
              )}
              <span>{currentUser.display_name || currentUser.username}</span>
              {currentUser.role === 'admin' && (
                <span style={{
                  fontSize: '0.65rem',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '4px',
                  background: 'rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  fontWeight: 700,
                }}>
                  ADMIN
                </span>
              )}
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <button
                onClick={onOpenAuth}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.45rem 0.8rem',
                  borderRadius: '10px',
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.35)',
                  color: '#c7d2fe',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Đăng nhập để lưu tin yêu thích, lịch sử đọc và cấu hình cá nhân"
              >
                <User size={15} />
                <span>Đăng nhập</span>
              </button>
              {userId && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.4rem 0.65rem',
                  borderRadius: '8px',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  fontSize: '0.72rem',
                  color: '#a5b4fc',
                }} title={`ID thiết bị: ${userId} (Tự động lưu lịch sử đọc không cần đăng nhập)`}>
                  <span>👤</span>
                  <span style={{ fontWeight: 600 }}>Khách</span>
                </div>
              )}
            </div>
          )}

          {/* Crawl Status Info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.45rem 0.7rem',
            borderRadius: '10px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            fontSize: '0.75rem',
            color: '#34d399',
          }}>
            <div className="live-dot" />
            <span style={{ color: 'var(--text-secondary)' }}>{formatLastRun()}</span>
          </div>

          {/* Crawl Mode Selector + Trigger Split Button */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <div style={{
              display: 'flex',
              alignItems: 'stretch',
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: isTriggering ? 'none' : '0 0 14px rgba(99, 102, 241, 0.35)',
            }}>
              {/* Primary Action Button */}
              <button
                onClick={() => handleCrawlClick(selectedCrawlMode)}
                disabled={isTriggering || crawlStatus?.is_running}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 0.85rem',
                  background: isTriggering || crawlStatus?.is_running
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                  color: '#fff',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: isTriggering || crawlStatus?.is_running ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <RefreshCw
                  size={15}
                  style={{
                    animation: isTriggering || crawlStatus?.is_running ? 'spin 1s linear infinite' : 'none'
                  }}
                />
                <span>
                  {isTriggering || crawlStatus?.is_running
                    ? 'Đang quét...'
                    : `Quét: ${currentOption.label}`}
                </span>
              </button>

              {/* Dropdown Toggle Arrow */}
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                disabled={isTriggering || crawlStatus?.is_running}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 0.55rem',
                  background: isTriggering || crawlStatus?.is_running
                    ? 'rgba(255, 255, 255, 0.08)'
                    : '#4338ca',
                  borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  color: '#fff',
                  cursor: isTriggering || crawlStatus?.is_running ? 'not-allowed' : 'pointer',
                }}
                title="Chọn loại tin để quét (Tìm 20 tin hot nhất)"
              >
                <ChevronDown size={14} />
              </button>
            </div>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '310px',
                background: 'rgba(15, 23, 42, 0.98)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '12px',
                padding: '0.5rem',
                boxShadow: '0 15px 35px rgba(0, 0, 0, 0.5)',
                zIndex: 100,
              }}>
                <div style={{
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.72rem',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                  marginBottom: '0.35rem',
                }}>
                  Chọn danh mục quét (20 tin hot nhất)
                </div>
                {CRAWL_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleCrawlClick(opt.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.6rem',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '8px',
                      background: selectedCrawlMode === opt.id ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                      border: selectedCrawlMode === opt.id ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
                      color: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>{opt.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '0.82rem',
                        fontWeight: selectedCrawlMode === opt.id ? 700 : 600,
                        color: selectedCrawlMode === opt.id ? '#a5b4fc' : '#e2e8f0',
                      }}>
                        {opt.label}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                        {opt.desc}
                      </div>
                    </div>
                    {selectedCrawlMode === opt.id && (
                      <Check size={16} color="#818cf8" style={{ marginTop: '2px' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </header>
  );
};

