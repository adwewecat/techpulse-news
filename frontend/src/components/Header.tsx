import React from 'react';
import { Flame, RefreshCw, Search } from 'lucide-react';
import type { CrawlStatus, StatsOverview } from '../types/news';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  crawlStatus: CrawlStatus | null;
  stats: StatsOverview | null;
  onTriggerCrawl: () => void;
  isTriggering: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  crawlStatus,
  stats,
  onTriggerCrawl,
  isTriggering,
}) => {
  const formatLastRun = () => {
    if (!crawlStatus?.last_run) return 'Vừa quét gần đây';
    try {
      const date = new Date(crawlStatus.last_run);
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Vừa cập nhật';
    }
  };

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 40,
      background: 'rgba(8, 12, 20, 0.85)',
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
              🇻🇳 Tin Nóng & Tech VN • 🌎 Tech Thế Giới
              {stats ? ` (${stats.total_articles} tin)` : ''}
            </p>
          </div>
        </div>

        {/* Search Box */}
        <div style={{
          position: 'relative',
          flex: '1 1 280px',
          maxWidth: '420px',
          minWidth: '220px'
        }}>
          <Search size={16} color="var(--text-muted)" style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
          }} />
          <input
            type="text"
            placeholder="Tìm theo chủ đề, AI, VinFast, Apple..."
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

        {/* Live Status & Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* Crawl Status Info */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.4rem 0.75rem',
            borderRadius: '8px',
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            fontSize: '0.75rem',
            color: '#34d399',
          }}>
            <div className="live-dot" />
            <span>Mỗi 30p</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>•</span>
            <span style={{ color: 'var(--text-secondary)' }}>Cập nhật {formatLastRun()}</span>
          </div>

          {/* Trigger Now Button */}
          <button
            onClick={onTriggerCrawl}
            disabled={isTriggering || crawlStatus?.is_running}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.85rem',
              borderRadius: '10px',
              background: isTriggering || crawlStatus?.is_running
                ? 'rgba(255, 255, 255, 0.08)'
                : 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              color: '#fff',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: 'none',
              cursor: isTriggering || crawlStatus?.is_running ? 'not-allowed' : 'pointer',
              boxShadow: isTriggering ? 'none' : '0 0 12px rgba(99, 102, 241, 0.35)',
              transition: 'all 0.2s ease',
            }}
          >
            <RefreshCw
              size={15}
              style={{
                animation: isTriggering || crawlStatus?.is_running ? 'spin 1s linear infinite' : 'none'
              }}
            />
            <span>{isTriggering || crawlStatus?.is_running ? 'Đang quét...' : 'Quét tin ngay'}</span>
          </button>
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
