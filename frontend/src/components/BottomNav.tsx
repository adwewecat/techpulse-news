import React from 'react';
import { Flame, Globe, Zap, RefreshCw } from 'lucide-react';
import type { MainTab } from '../types/news';

interface BottomNavProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  onTriggerCrawl: () => void;
  isTriggering: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  onTriggerCrawl,
  isTriggering,
}) => {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 45,
      background: 'rgba(8, 12, 20, 0.95)',
      backdropFilter: 'blur(20px)',
      borderTop: '1px solid rgba(255, 255, 255, 0.1)',
      display: 'none',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: '0.45rem 0.5rem',
    }} className="mobile-bottom-nav">
      {/* 🇻🇳 Việt Nam */}
      <button
        onClick={() => onTabChange('vietnam')}
        style={{
          background: 'transparent',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.2rem',
          color: activeTab === 'vietnam' ? '#ef4444' : 'var(--text-muted)',
          fontSize: '0.68rem',
          fontWeight: activeTab === 'vietnam' ? 700 : 500,
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '1.1rem' }}>🇻🇳</span>
        <span>Việt Nam</span>
      </button>

      {/* 🌎 Thế Giới */}
      <button
        onClick={() => onTabChange('world')}
        style={{
          background: 'transparent',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.2rem',
          color: activeTab === 'world' ? '#38bdf8' : 'var(--text-muted)',
          fontSize: '0.68rem',
          fontWeight: activeTab === 'world' ? 700 : 500,
          cursor: 'pointer',
        }}
      >
        <Globe size={18} color={activeTab === 'world' ? '#38bdf8' : 'var(--text-muted)'} />
        <span>Thế Giới</span>
      </button>

      {/* 🔥 Top 6H */}
      <button
        onClick={() => onTabChange('top6h')}
        style={{
          background: 'transparent',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.2rem',
          color: activeTab === 'top6h' ? '#ff5722' : 'var(--text-muted)',
          fontSize: '0.68rem',
          fontWeight: activeTab === 'top6h' ? 800 : 500,
          cursor: 'pointer',
        }}
      >
        <Flame size={18} color={activeTab === 'top6h' ? '#ff5722' : 'var(--text-muted)'} />
        <span>Top 6H</span>
      </button>

      {/* ⚡ Xu Hướng */}
      <button
        onClick={() => onTabChange('trending')}
        style={{
          background: 'transparent',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.2rem',
          color: activeTab === 'trending' ? '#00d2ff' : 'var(--text-muted)',
          fontSize: '0.68rem',
          fontWeight: activeTab === 'trending' ? 700 : 500,
          cursor: 'pointer',
        }}
      >
        <Zap size={18} color={activeTab === 'trending' ? '#00d2ff' : 'var(--text-muted)'} />
        <span>Xu Hướng</span>
      </button>

      {/* 🔄 Quét Tin */}
      <button
        onClick={onTriggerCrawl}
        disabled={isTriggering}
        style={{
          background: 'transparent',
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.2rem',
          color: isTriggering ? '#818cf8' : 'var(--text-muted)',
          fontSize: '0.68rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <RefreshCw
          size={18}
          color={isTriggering ? '#818cf8' : 'var(--text-muted)'}
          style={{ animation: isTriggering ? 'spin 1s linear infinite' : 'none' }}
        />
        <span>{isTriggering ? 'Đang quét' : 'Quét tin'}</span>
      </button>

      <style>{`
        @media (max-width: 768px) {
          .mobile-bottom-nav {
            display: flex !important;
          }
        }
      `}</style>
    </nav>
  );
};
