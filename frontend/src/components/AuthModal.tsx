import React, { useState, useEffect } from 'react';
import { X, Lock, User, UserPlus, KeyRound, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';
import type { UserProfile, UsersCountInfo } from '../types/news';
import { loginUserApi, registerUserApi, forgotPasswordApi, fetchUsersCountApi } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserProfile) => void;
  currentUser: UserProfile | null;
  onLogout: () => void;
}

type TabType = 'login' | 'register' | 'forgot';

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  currentUser,
  onLogout,
}) => {
  const [tab, setTab] = useState<TabType>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [usersCount, setUsersCount] = useState<UsersCountInfo>({ count: 1, max: 5 });

  // 60-second Cooldown timer state for anti-spam
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      fetchUsersCountApi().then(setUsersCount).catch(() => {});
    }
  }, [isOpen, tab]);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const res = await loginUserApi(username.trim(), password);
      setSuccessMessage(res.message);
      setTimeout(() => {
        onLoginSuccess(res.user);
        onClose();
      }, 500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownSeconds > 0) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const res = await registerUserApi(username.trim(), password, displayName.trim() || undefined);
      setSuccessMessage(res.message);
      setCooldownSeconds(60);
      fetchUsersCountApi().then(setUsersCount).catch(() => {});
      setTimeout(() => {
        onLoginSuccess(res.user);
        onClose();
      }, 800);
    } catch (err: any) {
      const msg = err.message || '';
      setErrorMessage(msg);
      // Nếu lỗi 429, trích xuất số giây cần đợi
      const matchSec = msg.match(/(\d+)\s*giây/);
      if (matchSec) {
        setCooldownSeconds(parseInt(matchSec[1], 10));
      } else if (msg.includes('đợi')) {
        setCooldownSeconds(60);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownSeconds > 0) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);
    try {
      const res = await forgotPasswordApi(username.trim(), newPassword);
      setSuccessMessage(res.message);
      setCooldownSeconds(60);
      setTimeout(() => {
        setTab('login');
        setPassword('');
        setSuccessMessage('Đã đổi mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.');
      }, 1200);
    } catch (err: any) {
      const msg = err.message || '';
      setErrorMessage(msg);
      const matchSec = msg.match(/(\d+)\s*giây/);
      if (matchSec) {
        setCooldownSeconds(parseInt(matchSec[1], 10));
      } else if (msg.includes('đợi')) {
        setCooldownSeconds(60);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      background: 'rgba(3, 7, 18, 0.82)',
      backdropFilter: 'blur(16px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 100%)',
        border: '1px solid rgba(99, 102, 241, 0.35)',
        borderRadius: '20px',
        padding: '1.75rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(99, 102, 241, 0.2)',
        position: 'relative',
        animation: 'modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            borderRadius: '50%',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            cursor: 'pointer',
          }}
        >
          <X size={16} />
        </button>

        {/* Header Icon & Title */}
        <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
          <div style={{
            width: '52px',
            height: '52px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(124, 58, 237, 0.45)',
            marginBottom: '0.75rem',
          }}>
            {currentUser ? (
              <User size={26} color="#fff" />
            ) : tab === 'login' ? (
              <Lock size={26} color="#fff" />
            ) : tab === 'register' ? (
              <UserPlus size={26} color="#fff" />
            ) : (
              <KeyRound size={26} color="#fff" />
            )}
          </div>
          <h2 style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            background: 'linear-gradient(to right, #ffffff, #c7d2fe)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.25rem',
          }}>
            {currentUser ? 'Tài Khoản Đang Đăng Nhập' : tab === 'login' ? 'Đăng Nhập Tài Khoản' : tab === 'register' ? 'Đăng Ký Người Dùng' : 'Quên Mật Khẩu'}
          </h2>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            {currentUser
              ? `Đang đăng nhập với vai trò: ${currentUser.role === 'admin' ? 'Quản trị viên (Admin)' : 'Người dùng'}`
              : 'Lưu trữ lịch sử đọc, tin đánh dấu sao và cài đặt đồng bộ'}
          </p>
        </div>

        {/* If user is already logged in: View Profile & Logout */}
        {currentUser ? (
          <div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '14px',
              padding: '1rem',
              marginBottom: '1.25rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Tên đăng nhập:</span>
                <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.85rem' }}>{currentUser.username}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Tên hiển thị:</span>
                <span style={{ fontWeight: 600, color: '#cbd5e1', fontSize: '0.85rem' }}>{currentUser.display_name || currentUser.username}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Vai trò:</span>
                <span style={{
                  padding: '0.15rem 0.5rem',
                  borderRadius: '6px',
                  background: currentUser.role === 'admin' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(99, 102, 241, 0.2)',
                  color: currentUser.role === 'admin' ? '#fca5a5' : '#a5b4fc',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}>
                  {currentUser.role === 'admin' ? '🛡️ ADMIN' : '👤 USER'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Tin đã đọc / Sao:</span>
                <span style={{ color: '#38bdf8', fontSize: '0.82rem', fontWeight: 600 }}>
                  {currentUser.read_ids?.length || 0} tin đọc • {currentUser.starred_ids?.length || 0} đã lưu
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Đăng Xuất
              </button>
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '0.65rem',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Tabs Selector */}
            <div style={{
              display: 'flex',
              background: 'rgba(15, 23, 42, 0.6)',
              padding: '0.25rem',
              borderRadius: '12px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              marginBottom: '1.25rem',
            }}>
              <button
                onClick={() => { setTab('login'); setErrorMessage(null); }}
                style={{
                  flex: 1,
                  padding: '0.45rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: tab === 'login' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                  color: tab === 'login' ? '#fff' : '#94a3b8',
                  fontSize: '0.82rem',
                  fontWeight: tab === 'login' ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                Đăng Nhập
              </button>
              <button
                onClick={() => { setTab('register'); setErrorMessage(null); }}
                style={{
                  flex: 1,
                  padding: '0.45rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: tab === 'register' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                  color: tab === 'register' ? '#fff' : '#94a3b8',
                  fontSize: '0.82rem',
                  fontWeight: tab === 'register' ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                Đăng Ký ({usersCount.count}/{usersCount.max})
              </button>
              <button
                onClick={() => { setTab('forgot'); setErrorMessage(null); }}
                style={{
                  flex: 1,
                  padding: '0.45rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: tab === 'forgot' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                  color: tab === 'forgot' ? '#fff' : '#94a3b8',
                  fontSize: '0.82rem',
                  fontWeight: tab === 'forgot' ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                Quên Pass
              </button>
            </div>

            {/* Notifications */}
            {errorMessage && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                borderRadius: '10px',
                padding: '0.65rem 0.85rem',
                color: '#fca5a5',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                marginBottom: '1rem',
              }}>
                <ShieldAlert size={16} color="#ef4444" style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                borderRadius: '10px',
                padding: '0.65rem 0.85rem',
                color: '#6ee7b7',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                marginBottom: '1rem',
              }}>
                <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0 }} />
                <span>{successMessage}</span>
              </div>
            )}

            {/* TAB 1: LOGIN FORM */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Tên đăng nhập
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: admin hoặc tên của bạn"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Mật khẩu</label>
                    <button
                      type="button"
                      onClick={() => setTab('forgot')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#818cf8',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="Nhập mật khẩu..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
                  }}
                >
                  {loading ? 'Đang xác thực...' : 'Đăng Nhập Ngay'}
                </button>
              </form>
            )}

            {/* TAB 2: REGISTER FORM */}
            {tab === 'register' && (
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  fontSize: '0.75rem',
                  color: '#a5b4fc',
                }}>
                  ℹ️ Hệ thống cho phép tối đa <strong>5 người dùng</strong> (1 admin + 4 người dùng). Hiện có: <strong>{usersCount.count}/5</strong>.
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Tên đăng nhập (Username)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Tối thiểu 3 ký tự (vd: user1, ducdung...)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Tên hiển thị (Tùy chọn)
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Nguyễn Đức Dũng"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Tối thiểu 4 ký tự..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || cooldownSeconds > 0 || usersCount.count >= usersCount.max}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    background: cooldownSeconds > 0 || usersCount.count >= usersCount.max
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: cooldownSeconds > 0 || usersCount.count >= usersCount.max ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  {cooldownSeconds > 0 ? (
                    <>
                      <Clock size={16} />
                      <span>Đợi {cooldownSeconds}s (chống spam)...</span>
                    </>
                  ) : usersCount.count >= usersCount.max ? (
                    'Đã đạt tối đa 5 người dùng'
                  ) : loading ? (
                    'Đang đăng ký...'
                  ) : (
                    'Đăng Ký Tài Khoản'
                  )}
                </button>
              </form>
            )}

            {/* TAB 3: FORGOT PASSWORD */}
            {tab === 'forgot' && (
              <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{
                  padding: '0.6rem 0.75rem',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  fontSize: '0.75rem',
                  color: '#fcd34d',
                }}>
                  🔑 <strong>Đổi mật khẩu nhanh:</strong> Chỉ cần nhập đúng Tên đăng nhập tồn tại là bạn có thể đổi ngay mật khẩu mới mà không cần nhớ mật khẩu cũ!
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Tên đăng nhập của bạn
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập tên đăng nhập cần lấy lại pass..."
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                    Mật khẩu mới muốn đặt
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Nhập mật khẩu mới..."
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '10px',
                      background: 'rgba(15, 23, 42, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || cooldownSeconds > 0}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem',
                    borderRadius: '10px',
                    background: cooldownSeconds > 0
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: cooldownSeconds > 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  {cooldownSeconds > 0 ? (
                    <>
                      <Clock size={16} />
                      <span>Đợi {cooldownSeconds}s (chống spam)...</span>
                    </>
                  ) : loading ? (
                    'Đang xử lý...'
                  ) : (
                    'Đổi Mật Khẩu Ngay'
                  )}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
