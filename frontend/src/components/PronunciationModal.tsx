import React, { useState, useEffect } from 'react';
import { 
  X, Volume2, Plus, Trash2, Edit2, RotateCcw, 
  Search, Check, BookOpen, AlertCircle, Loader2 
} from 'lucide-react';
import { 
  fetchPronunciationDictionary, 
  addOrUpdatePronunciationWord, 
  deletePronunciationWord, 
  resetPronunciationDictionary, 
  previewPronunciationAudio,
  type PronunciationItem 
} from '../services/api';
import { VietnameseTTS } from '../services/tts';

interface PronunciationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDictionaryUpdated?: () => void;
}

export const PronunciationModal: React.FC<PronunciationModalProps> = ({ 
  isOpen, 
  onClose,
  onDictionaryUpdated 
}) => {
  const [dictionary, setDictionary] = useState<PronunciationItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [originalWord, setOriginalWord] = useState('');
  const [replacementWord, setReplacementWord] = useState('');
  const [editingWord, setEditingWord] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewingWord, setPreviewingWord] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadDictionary();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const loadDictionary = async () => {
    try {
      setIsLoading(true);
      const res = await fetchPronunciationDictionary();
      setDictionary(res.dictionary || []);
    } catch (err) {
      console.error('Lỗi khi tải từ điển phát âm:', err);
      showMessage('Không thể tải từ điển phát âm từ máy chủ', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const showMessage = (text: string, type: 'success' | 'error') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  };

  const handleSaveWord = async (e: React.FormEvent) => {
    e.preventDefault();
    const orig = originalWord.trim();
    const repl = replacementWord.trim();

    if (!orig || !repl) {
      showMessage('Vui lòng nhập cả từ gốc và cách phát âm', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await addOrUpdatePronunciationWord(orig, repl);
      setDictionary(res.dictionary);
      setOriginalWord('');
      setReplacementWord('');
      setEditingWord(null);
      showMessage(`✅ Đã lưu cấu hình: "${orig}" ➔ "${repl}"`, 'success');
      if (onDictionaryUpdated) onDictionaryUpdated();
    } catch (err) {
      console.error('Lỗi khi lưu từ:', err);
      showMessage('Không thể lưu từ vào từ điển', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (item: PronunciationItem) => {
    setOriginalWord(item.original);
    setReplacementWord(item.replacement);
    setEditingWord(item.original);
  };

  const handleCancelEdit = () => {
    setOriginalWord('');
    setReplacementWord('');
    setEditingWord(null);
  };

  const handleDeleteWord = async (original: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa quy tắc đọc cho "${original}"?`)) {
      return;
    }

    try {
      setIsLoading(true);
      const res = await deletePronunciationWord(original);
      setDictionary(res.dictionary);
      if (editingWord === original) {
        handleCancelEdit();
      }
      showMessage(`Đã xóa từ "${original}" khỏi từ điển`, 'success');
      if (onDictionaryUpdated) onDictionaryUpdated();
    } catch (err) {
      console.error('Lỗi khi xóa từ:', err);
      showMessage('Không thể xóa từ', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetDefault = async () => {
    if (!window.confirm('Khôi phục từ điển về danh sách mặc định của hệ thống?')) {
      return;
    }

    try {
      setIsLoading(true);
      const res = await resetPronunciationDictionary();
      setDictionary(res.dictionary);
      handleCancelEdit();
      showMessage('Đã khôi phục từ điển phát âm mặc định', 'success');
      if (onDictionaryUpdated) onDictionaryUpdated();
    } catch (err) {
      console.error('Lỗi khi khôi phục mặc định:', err);
      showMessage('Không thể khôi phục từ điển', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviewAudio = async (textToRead: string, identifierKey: string) => {
    if (!textToRead.trim()) return;
    try {
      setPreviewingWord(identifierKey);
      const voice = VietnameseTTS.getVoice();
      const blob = await previewPronunciationAudio(textToRead, voice);
      VietnameseTTS.playAudioBlob(blob);
    } catch (err) {
      console.error('Lỗi nghe thử:', err);
      showMessage('Không thể phát âm thanh nghe thử', 'error');
    } finally {
      setTimeout(() => setPreviewingWord(null), 1500);
    }
  };

  if (!isOpen) return null;

  const filteredList = dictionary.filter(
    (item) =>
      item.original.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.replacement.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
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
          maxWidth: '720px',
          maxHeight: '90vh',
          background: 'rgba(15, 23, 42, 0.98)',
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
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
              }}
            >
              <BookOpen size={20} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Cấu hình cách đọc từ ngữ & thuật ngữ
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0.2rem 0 0' }}>
                Tùy chỉnh phiên âm Tiếng Việt cho từ viết tắt, tiếng Anh (VD: OPENAI ➔ ô pần ây ai)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        {/* Thông báo feedback */}
        {message && (
          <div
            style={{
              padding: '0.65rem 1.25rem',
              background: message.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              borderBottom: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: message.type === 'success' ? '#6ee7b7' : '#fca5a5',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <AlertCircle size={16} />
            <span>{message.text}</span>
          </div>
        )}

        {/* Nội dung cuộn */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Form thêm / sửa từ */}
          <form
            onSubmit={handleSaveWord}
            style={{
              background: 'rgba(30, 41, 59, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '14px',
              padding: '1rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#38bdf8' }}>
                {editingWord ? `✏️ Đang sửa quy tắc: ${editingWord}` : '➕ Thêm từ phát âm mới'}
              </span>
              {editingWord && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#94a3b8',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  Hủy sửa
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                  Từ gốc (Từ hiển thị trong bài viết)
                </label>
                <input
                  type="text"
                  placeholder="VD: OPENAI, Claude, CEO..."
                  value={originalWord}
                  onChange={(e) => setOriginalWord(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.3rem' }}>
                  Cách đọc (Phiên âm Tiếng Việt)
                </label>
                <input
                  type="text"
                  placeholder="VD: ô pần ây ai, cờ lốt, xê e o..."
                  value={replacementWord}
                  onChange={(e) => setReplacementWord(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.85rem',
                    background: 'rgba(15, 23, 42, 0.8)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.2rem' }}>
              {replacementWord.trim() && (
                <button
                  type="button"
                  onClick={() => handlePreviewAudio(replacementWord, 'form_preview')}
                  disabled={previewingWord === 'form_preview'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.55rem 0.9rem',
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    borderRadius: '8px',
                    color: '#38bdf8',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  title="Nghe thử cách phát âm này"
                >
                  {previewingWord === 'form_preview' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Volume2 size={16} />
                  )}
                  <span>Nghe thử</span>
                </button>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !originalWord.trim() || !replacementWord.trim()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 1.15rem',
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: (!originalWord.trim() || !replacementWord.trim()) ? 0.6 : 1,
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                }}
              >
                {isSubmitting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : editingWord ? (
                  <Check size={16} />
                ) : (
                  <Plus size={16} />
                )}
                <span>{editingWord ? 'Lưu thay đổi' : 'Thêm vào từ điển'}</span>
              </button>
            </div>
          </form>

          {/* Thanh tìm kiếm & đếm số lượng */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={16}
                color="#64748b"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                placeholder="Tìm kiếm từ hoặc phiên âm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.85rem 0.55rem 2.25rem',
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <button
              onClick={handleResetDefault}
              disabled={isLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 0.9rem',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: '10px',
                color: '#fca5a5',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              title="Khôi phục danh sách từ vựng gốc của AI"
            >
              <RotateCcw size={14} />
              <span>Khôi phục mặc định</span>
            </button>
          </div>

          {/* Danh sách từ điển */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1.5fr 110px',
                padding: '0.65rem 1rem',
                background: 'rgba(30, 41, 59, 0.4)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: '0.75rem',
                fontWeight: 700,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <span>Từ gốc</span>
              <span>Đọc là</span>
              <span style={{ textAlign: 'right' }}>Thao tác</span>
            </div>

            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {isLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem' }} />
                  <div>Đang tải từ điển...</div>
                </div>
              ) : filteredList.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                  {searchTerm ? 'Không tìm thấy từ nào khớp với tìm kiếm' : 'Chưa có từ nào trong từ điển'}
                </div>
              ) : (
                filteredList.map((item, idx) => (
                  <div
                    key={item.original}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 1.5fr 110px',
                      alignItems: 'center',
                      padding: '0.65rem 1rem',
                      borderBottom: idx < filteredList.length - 1 ? '1px solid rgba(255, 255, 255, 0.04)' : 'none',
                      background: editingWord === item.original ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontWeight: 700,
                          color: '#38bdf8',
                          fontSize: '0.9rem',
                          background: 'rgba(56, 189, 248, 0.12)',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '6px',
                        }}
                      >
                        {item.original}
                      </span>
                    </div>

                    <div style={{ color: '#f1f5f9', fontSize: '0.88rem', fontStyle: 'italic' }}>
                      "{item.replacement}"
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                      <button
                        onClick={() => handlePreviewAudio(item.replacement, item.original)}
                        disabled={previewingWord === item.original}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: 'none',
                          borderRadius: '6px',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#38bdf8',
                          cursor: 'pointer',
                        }}
                        title="Nghe thử"
                      >
                        {previewingWord === item.original ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Volume2 size={14} />
                        )}
                      </button>

                      <button
                        onClick={() => handleEditClick(item)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.06)',
                          border: 'none',
                          borderRadius: '6px',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fbbf24',
                          cursor: 'pointer',
                        }}
                        title="Chỉnh sửa"
                      >
                        <Edit2 size={14} />
                      </button>

                      <button
                        onClick={() => handleDeleteWord(item.original)}
                        style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          border: 'none',
                          borderRadius: '6px',
                          width: '28px',
                          height: '28px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#f87171',
                          cursor: 'pointer',
                        }}
                        title="Xóa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(15, 23, 42, 0.95)',
          }}
        >
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
            Tổng cộng: <strong style={{ color: '#94a3b8' }}>{dictionary.length}</strong> quy tắc phát âm
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '0.55rem 1.25rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              color: '#f8fafc',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
