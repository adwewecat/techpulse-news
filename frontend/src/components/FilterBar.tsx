import React from 'react';
import { Globe, Flame, Zap, Filter } from 'lucide-react';
import type { MainTab } from '../types/news';

interface FilterBarProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
  selectedTag: string;
  onTagChange: (tag: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  hotCount?: number;
}

const TOP_TAGS = [
  'Tất cả chủ đề',
  'Trí tuệ nhân tạo (AI)',
  'Bán dẫn & Chip',
  'Apple & iOS',
  'VinFast & Xe điện',
  'An ninh mạng & Bảo mật',
  'Startup & Đầu tư',
  'Smartphone & Thiết bị',
];

export const FilterBar: React.FC<FilterBarProps> = ({
  activeTab,
  onTabChange,
  selectedTag,
  onTagChange,
  selectedCategory,
  onCategoryChange,
}) => {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      {/* Primary Navigation Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        overflowX: 'auto',
        paddingBottom: '0.5rem',
      }} className="hide-scrollbar">
        {/* Tất cả */}
        <button
          onClick={() => { onTabChange('all'); onCategoryChange(''); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 1rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: activeTab === 'all' && !selectedCategory ? '1px solid #6366f1' : '1px solid rgba(255, 255, 255, 0.08)',
            background: activeTab === 'all' && !selectedCategory ? 'rgba(99, 102, 241, 0.25)' : 'rgba(15, 23, 42, 0.6)',
            color: activeTab === 'all' && !selectedCategory ? '#fff' : 'var(--text-secondary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease',
          }}
        >
          <Globe size={16} />
          <span>Tất cả tin</span>
        </button>

        {/* 🇻🇳 Việt Nam */}
        <button
          onClick={() => { onTabChange('vietnam'); onCategoryChange(''); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 1rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: activeTab === 'vietnam' ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.08)',
            background: activeTab === 'vietnam' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(15, 23, 42, 0.6)',
            color: activeTab === 'vietnam' ? '#fca5a5' : 'var(--text-secondary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease',
          }}
        >
          <span>🇻🇳 VIỆT NAM (Tin nóng + Tech)</span>
        </button>

        {/* 🌎 Thế Giới */}
        <button
          onClick={() => { onTabChange('world'); onCategoryChange(''); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 1rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: activeTab === 'world' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
            background: activeTab === 'world' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 23, 42, 0.6)',
            color: activeTab === 'world' ? '#7dd3fc' : 'var(--text-secondary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease',
          }}
        >
          <span>🌎 THẾ GIỚI (Tech Global)</span>
        </button>

        {/* 🔥 Top 6 Giờ */}
        <button
          onClick={() => onTabChange('top6h')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 1rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 700,
            border: activeTab === 'top6h' ? '1px solid #ff5722' : '1px solid rgba(255, 255, 255, 0.08)',
            background: activeTab === 'top6h' ? 'linear-gradient(135deg, rgba(255, 87, 34, 0.3), rgba(255, 140, 0, 0.3))' : 'rgba(15, 23, 42, 0.6)',
            color: activeTab === 'top6h' ? '#ff9e80' : 'var(--text-secondary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease',
          }}
        >
          <Flame size={16} color="#ff5722" />
          <span>Top 6 Giờ</span>
        </button>

        {/* ⚡ Đang Tăng */}
        <button
          onClick={() => onTabChange('trending')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.55rem 1rem',
            borderRadius: '10px',
            fontSize: '0.85rem',
            fontWeight: 600,
            border: activeTab === 'trending' ? '1px solid #00d2ff' : '1px solid rgba(255, 255, 255, 0.08)',
            background: activeTab === 'trending' ? 'rgba(0, 210, 255, 0.2)' : 'rgba(15, 23, 42, 0.6)',
            color: activeTab === 'trending' ? '#38bdf8' : 'var(--text-secondary)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease',
          }}
        >
          <Zap size={16} color="#00d2ff" />
          <span>Đang Tăng Tốc</span>
        </button>
      </div>

      {/* Sub-tags Horizontal Pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        overflowX: 'auto',
        marginTop: '0.65rem',
        paddingBottom: '0.25rem',
      }} className="hide-scrollbar">
        <span style={{
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          marginRight: '0.2rem',
        }}>
          <Filter size={13} /> Lọc:
        </span>
        {TOP_TAGS.map((tag) => {
          const isSelected = (tag === 'Tất cả chủ đề' && !selectedTag) || selectedTag === tag;
          return (
            <button
              key={tag}
              onClick={() => onTagChange(tag === 'Tất cả chủ đề' ? '' : tag)}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: isSelected ? 600 : 400,
                border: isSelected ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.06)',
                background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: isSelected ? '#a5b4fc' : 'var(--text-muted)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
};
