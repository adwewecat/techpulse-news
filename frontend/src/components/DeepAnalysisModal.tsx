import React, { useState, useEffect } from 'react';
import { 
  X, Sparkles, ExternalLink, Star, Volume2, RotateCw, 
  Layers, ArrowRight, HelpCircle, CheckCircle, Clock, ShieldAlert, Zap
} from 'lucide-react';
import type { Article, DeepAnalysisResponse } from '../types/news';
import { fetchDeepAnalysis, API_BASE } from '../services/api';
import { VietnameseTTS } from '../services/tts';

interface DeepAnalysisModalProps {
  article: Article | null;
  isOpen: boolean;
  onClose: () => void;
  isStarred: boolean;
  onToggleStar: (articleId: number) => void;
  onPlaySpeech?: (text: string, title: string) => void;
}

export const DeepAnalysisModal: React.FC<DeepAnalysisModalProps> = ({
  article,
  isOpen,
  onClose,
  isStarred,
  onToggleStar,
}) => {
  const [analysis, setAnalysis] = useState<DeepAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isReadingAnalysis, setIsReadingAnalysis] = useState<boolean>(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  const stopReading = () => {
    if (audioElement) {
      try {
        audioElement.pause();
        audioElement.currentTime = 0;
      } catch {}
      setAudioElement(null);
    }
    setIsReadingAnalysis(false);
  };

  useEffect(() => {
    if (!isOpen || !article) {
      setAnalysis(null);
      setError(null);
      stopReading();
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchDeepAnalysis(article.id, false)
      .then((data) => {
        if (isMounted) {
          setAnalysis(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error(err);
          setError('Không thể tải bản phân tích chuyên sâu. Vui lòng thử lại.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
      stopReading();
    };
  }, [isOpen, article]);

  if (!isOpen || !article) return null;

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);
    stopReading();
    try {
      const data = await fetchDeepAnalysis(article.id, true);
      setAnalysis(data);
    } catch (err) {
      setError('Lỗi khi làm mới bản phân tích.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReadAloud = () => {
    if (!article) return;
    stopReading();
    setIsReadingAnalysis(true);

    // Phát âm thanh Tiếng Việt chuẩn 100% từ API backend (Neural TTS Hoài My/Nam Minh)
    const audioUrl = `${API_BASE}/tts/deep-analysis/${article.id}?voice=${encodeURIComponent(VietnameseTTS.getVoice())}`;
    const audio = new Audio(audioUrl);
    setAudioElement(audio);

    // Áp dụng tốc độ đọc mong muốn từ người dùng
    audio.playbackRate = VietnameseTTS.getPlaybackRate();

    audio.onplay = () => {
      setIsReadingAnalysis(true);
    };

    audio.onended = () => {
      setIsReadingAnalysis(false);
      setAudioElement(null);
    };

    audio.onerror = (e) => {
      console.warn('Lỗi khi phát âm thanh phân tích tiếng Việt:', e);
      setIsReadingAnalysis(false);
      setAudioElement(null);
    };

    audio.play().catch((err) => {
      if (err && err.name === 'AbortError') return;
      console.warn('Trình duyệt chặn autoplay âm thanh phân tích:', err);
      setIsReadingAnalysis(false);
    });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
        background: 'rgba(0, 0, 0, 0.85)',
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
          background: 'linear-gradient(180deg, #0f172a 0%, #090d16 100%)',
          border: '1px solid rgba(245, 158, 11, 0.4)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(245, 158, 11, 0.25)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
          background: 'rgba(245, 158, 11, 0.04)',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                color: '#f59e0b',
                background: 'rgba(245, 158, 11, 0.15)',
                padding: '0.2rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}>
                <Sparkles size={12} />
                PHÂN TÍCH CHUYÊN SÂU ĐA NGUỒN (AI)
              </span>

              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>
                {article.source_name}
              </span>

              {article.region && (
                <span style={{
                  fontSize: '0.7rem',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#cbd5e1',
                }}>
                  {article.region === 'vietnam' ? '🇻🇳 Việt Nam' : '🌎 Thế Giới'}
                </span>
              )}
            </div>

            <h2 style={{
              fontSize: '1.15rem',
              fontWeight: 800,
              color: '#fff',
              lineHeight: 1.4,
              margin: 0,
            }}>
              {article.title}
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            {/* Star Toggle Button */}
            <button
              onClick={() => onToggleStar(article.id)}
              title={isStarred ? 'Bỏ đánh dấu sao' : 'Đánh dấu sao (Tin tôi quan tâm)'}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: isStarred ? 'rgba(245, 158, 11, 0.25)' : 'rgba(255, 255, 255, 0.06)',
                border: isStarred ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                color: isStarred ? '#fbbf24' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <Star size={18} fill={isStarred ? '#fbbf24' : 'none'} />
            </button>

            {/* Close */}
            <button
              onClick={() => {
                stopReading();
                onClose();
              }}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#94a3b8',
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

        {/* Scrollable Content Body */}
        <div style={{
          padding: '1.5rem',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}>
          {isLoading ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3rem 1rem',
              gap: '1rem',
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                border: '3px solid rgba(245, 158, 11, 0.2)',
                borderTopColor: '#f59e0b',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.25rem' }}>
                  Đang phân tích chuyên sâu & đối chiếu các nguồn...
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Trích xuất dữ liệu gốc • Quét cụm tin liên quan • Tổng hợp góc nhìn đa chiều
                </p>
              </div>
            </div>
          ) : error ? (
            <div style={{
              padding: '1.5rem',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              textAlign: 'center',
            }}>
              <ShieldAlert size={28} color="#ef4444" style={{ margin: '0 auto 0.5rem auto' }} />
              <p style={{ fontSize: '0.9rem', marginBottom: '0.75rem' }}>{error}</p>
              <button
                onClick={handleRefresh}
                style={{
                  padding: '0.4rem 1rem',
                  borderRadius: '8px',
                  background: '#ef4444',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Thử lại
              </button>
            </div>
          ) : analysis ? (
            <>
              {/* Action Toolbar inside Modal */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '0.65rem 1rem',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isReadingAnalysis ? (
                    <button
                      onClick={stopReading}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '8px',
                        background: '#ef4444',
                        color: '#fff',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      <Volume2 size={15} />
                      <span>Dừng đọc phân tích</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleReadAloud}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#fff',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 0 12px rgba(245, 158, 11, 0.3)',
                      }}
                    >
                      <Volume2 size={15} />
                      <span>Nghe đọc bản phân tích</span>
                    </button>
                  )}

                  <button
                    onClick={handleRefresh}
                    title="Làm mới phân tích AI"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.78rem',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      cursor: 'pointer',
                    }}
                  >
                    <RotateCw size={13} />
                    <span>Làm mới</span>
                  </button>
                </div>

                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    fontSize: '0.78rem',
                    color: '#38bdf8',
                    textDecoration: 'none',
                  }}
                >
                  <span>Mở trang báo gốc</span>
                  <ExternalLink size={13} />
                </a>
              </div>

              {/* 1. Tổng quan sự việc & Bối cảnh nền tảng */}
              <div style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                borderRadius: '14px',
                padding: '1.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                  <Sparkles size={16} color="#f59e0b" />
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#f59e0b', margin: 0 }}>
                    1. TỔNG QUAN SỰ VIỆC & BỐI CẢNH GỐC RỄ
                  </h3>
                </div>
                <p style={{ fontSize: '0.9rem', color: '#f1f5f9', lineHeight: 1.6, margin: 0 }}>
                  {analysis.overview}
                </p>
              </div>

              {/* 2. Các sự kiện then chốt */}
              {analysis.key_facts && analysis.key_facts.length > 0 && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '14px',
                  padding: '1.25rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                    <CheckCircle size={16} color="#34d399" />
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#34d399', margin: 0 }}>
                      2. SỰ KIỆN & SỐ LIỆU THEN CHỐT
                    </h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {analysis.key_facts.map((fact, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                        <span style={{
                          color: '#34d399',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          background: 'rgba(52, 211, 153, 0.15)',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '0.1rem',
                        }}>
                          {i + 1}
                        </span>
                        <span style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                          {fact}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Đối chiếu góc nhìn từ các nguồn báo chí */}
              {analysis.multi_source_perspectives && analysis.multi_source_perspectives.length > 0 && (
                <div style={{
                  background: 'rgba(56, 189, 248, 0.04)',
                  border: '1px solid rgba(56, 189, 248, 0.2)',
                  borderRadius: '14px',
                  padding: '1.25rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                    <Layers size={16} color="#38bdf8" />
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#38bdf8', margin: 0 }}>
                      3. ĐỐI CHIẾU GÓC NHÌN TỪ CÁC NGUỒN BÁO CHÍ
                    </h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {analysis.multi_source_perspectives.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: 'rgba(15, 23, 42, 0.5)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: '10px',
                          padding: '0.75rem 1rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: '#7dd3fc',
                            background: 'rgba(56, 189, 248, 0.15)',
                            padding: '0.1rem 0.45rem',
                            borderRadius: '4px',
                          }}>
                            {p.source}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.86rem', color: '#e2e8f0', lineHeight: 1.45, margin: 0 }}>
                          {p.perspective}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Phân tích bản chất sự việc & Động cơ sâu xa */}
              <div style={{
                background: 'rgba(99, 102, 241, 0.05)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: '14px',
                padding: '1.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                  <Zap size={16} color="#818cf8" />
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#818cf8', margin: 0 }}>
                    4. BẢN CHẤT SỰ VIỆC & ĐỘNG CƠ CỐT LÕI
                  </h3>
                </div>
                <p style={{ fontSize: '0.9rem', color: '#f8fafc', lineHeight: 1.6, margin: 0 }}>
                  {analysis.deep_analysis}
                </p>
              </div>

              {/* 5. Tác động ngắn hạn & dài hạn */}
              {analysis.impacts && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '0.85rem',
                }}>
                  {/* Ngắn hạn */}
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.04)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '14px',
                    padding: '1rem 1.25rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                      <Clock size={15} color="#f87171" />
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f87171', margin: 0 }}>
                        TÁC ĐỘNG TRƯỚC MẮT (1-6 THÁNG)
                      </h4>
                    </div>
                    <p style={{ fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
                      {analysis.impacts.short_term}
                    </p>
                  </div>

                  {/* Dài hạn */}
                  <div style={{
                    background: 'rgba(168, 85, 247, 0.04)',
                    border: '1px solid rgba(168, 85, 247, 0.2)',
                    borderRadius: '14px',
                    padding: '1rem 1.25rem',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                      <ArrowRight size={15} color="#c084fc" />
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#c084fc', margin: 0 }}>
                        CHIẾN LƯỢC DÀI HẠN (1-5 NĂM)
                      </h4>
                    </div>
                    <p style={{ fontSize: '0.86rem', color: '#cbd5e1', lineHeight: 1.5, margin: 0 }}>
                      {analysis.impacts.long_term}
                    </p>
                  </div>
                </div>
              )}

              {/* 6. Câu hỏi mở cần tiếp tục theo dõi */}
              {analysis.unanswered_questions && analysis.unanswered_questions.length > 0 && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '14px',
                  padding: '1.25rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                    <HelpCircle size={16} color="#fbbf24" />
                    <h3 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#fbbf24', margin: 0 }}>
                      5. CÂU HỎI MỞ CẦN QUAN SÁT TIẾP THEO
                    </h3>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {analysis.unanswered_questions.map((q, idx) => (
                      <li key={idx} style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.45 }}>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 7. Lời khuyên hành động */}
              {analysis.actionable_takeaway && (
                <div style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.05))',
                  border: '1px solid #f59e0b',
                  borderRadius: '14px',
                  padding: '1.25rem',
                }}>
                  <p style={{ fontSize: '0.9rem', color: '#fef3c7', lineHeight: 1.55, margin: 0 }}>
                    <strong style={{ color: '#fbbf24', marginRight: '0.4rem' }}>
                      🎯 Kết luận & Lời khuyên hành động:
                    </strong>
                    {analysis.actionable_takeaway}
                  </p>
                </div>
              )}

              {/* 8. Danh sách các bài báo cùng đưa tin & Nguồn đối chiếu */}
              {analysis.related_articles && analysis.related_articles.length > 0 && (
                <div style={{
                  marginTop: '0.5rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  paddingTop: '1.25rem',
                }}>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.75rem' }}>
                    📚 Các bài báo liên quan & đối chiếu ({analysis.related_articles.length} nguồn):
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {analysis.related_articles.map((rel) => (
                      <a
                        key={rel.id}
                        href={rel.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.65rem 1rem',
                          borderRadius: '10px',
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          textDecoration: 'none',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)')}
                      >
                        <div style={{ overflow: 'hidden', paddingRight: '0.5rem' }}>
                          <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, marginRight: '0.5rem' }}>
                            {rel.source_name}
                          </span>
                          <span style={{ fontSize: '0.82rem', color: '#f1f5f9' }}>
                            {rel.title}
                          </span>
                        </div>
                        <ExternalLink size={13} color="#94a3b8" style={{ flexShrink: 0 }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
