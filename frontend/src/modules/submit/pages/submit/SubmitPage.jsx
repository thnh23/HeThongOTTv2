import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Clock,
  History,
  FileArchive,
  RefreshCw,
  LogIn,
  Sparkles,
  ShieldCheck,
  FileCode,
  Info,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useAuth } from '@/shared/context/AuthContext.jsx';
import { useToast } from '@/shared/context/ToastContext.jsx';
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge.jsx';
import { StarterKitModal } from '@/shared/components/StarterKitModal/index.js';
import './SubmitPage.css';

export function SubmitPage() {
  const { isAuthenticated, user } = useAuth();
  const { showToast } = useToast();
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [latestSubmission, setLatestSubmission] = useState(null);
  const [history, setHistory] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);

  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isStarterKitOpen, setIsStarterKitOpen] = useState(false);

  const fileInputRef = useRef(null);

  // Load user's submission history
  const loadHistory = async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiClient.get('/submit/history');
      setHistory(data || []);
      if (data && data.length > 0 && !latestSubmission) {
        setLatestSubmission(data[0]);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadHistory();
  }, [isAuthenticated]);

  const handleValidateFile = (file) => {
    if (!file) return false;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      const err = 'Chỉ chấp nhận file định dạng nén .ZIP';
      setErrorMsg(err);
      showToast(err, 'error');
      return false;
    }
    // Limit size to 25MB
    if (file.size > 25 * 1024 * 1024) {
      const err = 'Kích thước file không được vượt quá 25MB';
      setErrorMsg(err);
      showToast(err, 'error');
      return false;
    }
    setSelectedFile(file);
    setErrorMsg(null);
    showToast(`Đã chọn file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`, 'info');
    return true;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) handleValidateFile(file);
  };

  // Drag and Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleValidateFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setErrorMsg(null);
    setTestResult(null);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const result = await apiClient.post('/submit', formData);
      setLatestSubmission(result);
      setSelectedFile(null);
      if (result.status === 'valid') {
        showToast('Nộp bài thành công! Gói nộp đã vượt qua toàn bộ bước kiểm tra T08/T09.', 'success');
      } else {
        showToast('Gói nộp có lỗi cấu trúc, vui lòng kiểm tra danh sách bên dưới!', 'warning');
      }
      loadHistory();
    } catch (err) {
      const msg = err.message || 'Lỗi khi tải bài nộp lên máy chủ';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleTestRun = async () => {
    if (!latestSubmission) return;

    setIsRunningTest(true);
    setTestResult(null);
    showToast('Đang khởi chạy Sandbox đấu thử với GreedyBot...', 'info');

    try {
      const res = await apiClient.post(`/submit/test-run/${latestSubmission.id}`);
      setTestResult(res);
      if (res.status === 'finished') {
        showToast(`Đấu thử hoàn tất! Kết quả: ${res.winner ? `Thắng (${res.winner})` : 'Hòa/Kết thúc'}`, 'success');
      } else {
        showToast('Đấu thử kết thúc: ' + (res.reason || res.status), 'info');
      }
      loadHistory();
    } catch (err) {
      const msg = err.message || 'Không thể chạy thử bot';
      setErrorMsg(msg);
      showToast(msg, 'error');
    } finally {
      setIsRunningTest(false);
    }
  };

  // Guest state (Friendly guidance instead of dead-end wall)
  if (!isAuthenticated) {
    return (
      <div className="submit-page animate-fade-in">
        <div className="submit-header">
          <h1 style={{ fontSize: '2.4rem', marginBottom: '0.6rem' }}>
            Cổng Nộp Bài & <span className="gradient-text">Kiểm Thử Bot OTTv2</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '720px', margin: '0 auto' }}>
            Hệ thống chấm điểm tự động hỗ trợ sandbox cô lập, kiểm tra cấu trúc mã nguồn (T08), quét rò rỉ API key (T09) và đấu thử trực tiếp với GreedyBot.
          </p>
        </div>

        <div className="guest-grid">
          {/* Left: Guidance & Starter Kit */}
          <div className="glass-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div className="icon-badge-cyan">
                <FileCode size={22} color="var(--cyan-400)" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Chuẩn Bị Gói Bài Nộp</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tiêu chuẩn nộp bài môn Lập Trình Mạng 2026</span>
              </div>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Trước khi nộp, hãy chuẩn bị gói nén <code>.ZIP</code> gồm 4 thành phần bắt buộc:
            </p>

            <ul className="guide-file-list">
              <li>
                <strong>bot.py</strong>: Chứa hàm quyết định nước đi <code>choose_move(state)</code>
              </li>
              <li>
                <strong>PROMPTS.md</strong>: Nhật ký Prompt Engineering tương tác cùng AI (T08)
              </li>
              <li>
                <strong>REPORT.md</strong>: Báo cáo phân tích thuật toán và hàm heuristic
              </li>
              <li>
                <strong>chat_history/</strong>: Thư mục chứa lịch sử hội thoại trích xuất từ ChatGPT / Claude
              </li>
            </ul>

            <div style={{ marginTop: '1.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => setIsStarterKitOpen(true)}
              >
                <Sparkles size={16} />
                <span>Xem & Tải Starter Kit (.ZIP)</span>
              </button>
              <Link to="/rules" className="btn btn-outline">
                <span>Đọc Luật OTTv2</span>
              </Link>
            </div>
          </div>

          {/* Right: Login call to action */}
          <div className="glass-card auth-cta-card">
            <div className="icon-badge-indigo">
              <Upload size={28} color="var(--primary-400)" />
            </div>
            <h3 style={{ fontSize: '1.35rem', margin: '0.5rem 0' }}>Đăng Nhập Để Nộp Bài</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Đăng nhập bằng tài khoản sinh viên UET để tải lên gói bài làm, nhận phản hồi tức thì từ validator và khởi chạy trận đấu thử trong Sandbox.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
              <Link to="/login" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                <LogIn size={17} />
                <span>Đăng Nhập Ngay</span>
              </Link>
              <Link to="/register" className="btn btn-outline" style={{ justifyContent: 'center' }}>
                <span>Chưa có tài khoản? Đăng ký</span>
              </Link>
            </div>

            <div className="security-notice">
              <ShieldCheck size={16} color="var(--emerald-400)" />
              <span>Sandbox cô lập an toàn — Mã nguồn của bạn được bảo mật tuyệt đối</span>
            </div>
          </div>
        </div>

        <StarterKitModal isOpen={isStarterKitOpen} onClose={() => setIsStarterKitOpen(false)} />
      </div>
    );
  }

  // Authenticated state
  return (
    <div className="submit-page animate-fade-in">
      <div className="submit-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <h1 style={{ fontSize: '2.4rem', margin: 0 }}>
            Cổng Nộp Bài & <span className="gradient-text">Kiểm Thử Bot</span>
          </h1>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', maxWidth: '720px', margin: '0 auto 1.25rem' }}>
          Tải lên gói bài làm (.zip) để hệ thống tự động kiểm tra cấu trúc (T08), quét an ninh API Key (T09) và đấu thử trực tiếp với GreedyBot.
        </p>

        {/* Action bar */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
          <button
            className="btn btn-starter-kit"
            onClick={() => setIsStarterKitOpen(true)}
          >
            <Sparkles size={16} color="var(--cyan-400)" />
            <span>Mở Bộ Khởi Động (Starter Kit)</span>
          </button>
          <Link to="/rules" className="btn btn-outline btn-sm">
            <span>Xem Luật Chơi OTTv2</span>
          </Link>
        </div>
      </div>

      {/* Upload Dropzone */}
      <div className="glass-card upload-container-card" style={{ marginBottom: '2.5rem' }}>
        <input
          ref={fileInputRef}
          id="file-upload-input"
          type="file"
          accept=".zip"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <div
          className={`upload-dropzone ${isDragging ? 'drag-active' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Kéo thả hoặc bấm để chọn file ZIP"
        >
          <div className="upload-icon-circle">
            <Upload size={32} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>
              {selectedFile ? selectedFile.name : 'Kéo thả file .ZIP hoặc bấm vào đây để chọn'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Hỗ trợ định dạng file <code>.zip</code> (tối đa 25MB) chứa <code>bot.py</code>, <code>PROMPTS.md</code>, <code>REPORT.md</code>, và <code>chat_history/</code>
            </p>
          </div>
          {selectedFile && (
            <div className="file-preview-pill">
              <FileArchive size={16} />
              <span>Kích thước: {(selectedFile.size / 1024).toFixed(1)} KB</span>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="upload-error-banner" role="alert">
            <XCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {selectedFile && (
          <div className="upload-actions-bar">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setSelectedFile(null)}
              disabled={isUploading}
            >
              Hủy bỏ
            </button>
            <button
              id="btn-upload-submit"
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Đang tải lên & kiểm tra cấu trúc...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Xác Nhận Nộp Bài</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Validation Result Box */}
      {latestSubmission && (
        <div className="glass-card validation-card" style={{ marginBottom: '2.5rem' }}>
          <div className="validation-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Kết Quả Kiểm Tra Gói Nộp</h3>
                <StatusBadge status={latestSubmission.status} />
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Mã bài nộp: <code>{latestSubmission.id}</code> • Nộp lúc: {new Date(latestSubmission.submitted_at || Date.now()).toLocaleTimeString('vi-VN')}
              </p>
            </div>

            {latestSubmission.status === 'valid' && (
              <button
                id="btn-run-test-match"
                className="btn btn-primary btn-sm"
                onClick={handleTestRun}
                disabled={isRunningTest}
              >
                {isRunningTest ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Đang chạy đấu thử...</span>
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    <span>Đấu Thử Với GreedyBot</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Validation Checklist */}
          <ul className="validation-checklist" aria-label="Tiêu chí kiểm tra cấu trúc gói nộp">
            <li className={`checklist-item ${latestSubmission.validation?.bot_py ? 'passed' : 'failed'}`}>
              {latestSubmission.validation?.bot_py ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              <span>File <code>bot.py</code> hợp lệ</span>
            </li>
            <li className={`checklist-item ${latestSubmission.validation?.choose_move_fn ? 'passed' : 'failed'}`}>
              {latestSubmission.validation?.choose_move_fn ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              <span>Hàm <code>choose_move(state)</code></span>
            </li>
            <li className={`checklist-item ${latestSubmission.validation?.prompts_md ? 'passed' : 'failed'}`}>
              {latestSubmission.validation?.prompts_md ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              <span>File <code>PROMPTS.md</code> (T08)</span>
            </li>
            <li className={`checklist-item ${latestSubmission.validation?.chat_history ? 'passed' : 'failed'}`}>
              {latestSubmission.validation?.chat_history ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              <span>Thư mục <code>chat_history/</code></span>
            </li>
            <li className={`checklist-item ${latestSubmission.validation?.report_md ? 'passed' : 'failed'}`}>
              {latestSubmission.validation?.report_md ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
              <span>Báo cáo <code>REPORT.md</code></span>
            </li>
            <li className={`checklist-item ${latestSubmission.validation?.git_log ? 'passed' : 'failed'}`}>
              {latestSubmission.validation?.git_log ? <CheckCircle2 size={18} /> : <CheckCircle2 size={18} style={{ opacity: 0.5 }} />}
              <span>Lịch sử Git commit (≥ 4 commits)</span>
            </li>
          </ul>

          {/* Errors list */}
          {latestSubmission.errors && latestSubmission.errors.length > 0 && (
            <div className="error-callout" role="alert">
              <strong style={{ color: 'var(--rose-500)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <XCircle size={16} /> Lỗi cấu trúc gói nộp (Cần sửa để kích hoạt):
              </strong>
              <ul style={{ paddingLeft: '1.25rem', color: '#fff', fontSize: '0.9rem' }}>
                {latestSubmission.errors.map((e, idx) => (
                  <li key={idx}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Security Warnings (T09) */}
          {latestSubmission.warnings && latestSubmission.warnings.length > 0 && (
            <div className="warning-callout" role="alert">
              <strong style={{ color: 'var(--amber-400)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                <AlertTriangle size={16} /> Cảnh báo an ninh (T09):
              </strong>
              <ul style={{ paddingLeft: '1.25rem', color: '#fff', fontSize: '0.9rem' }}>
                {latestSubmission.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Test Run Result Box */}
          {testResult && (
            <div className="test-run-box animate-fade-in">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--cyan-400)' }}>
                  <Play size={18} /> Kết Quả Đấu Thử Với GreedyBot (Sandbox Cô Lập)
                </h4>
                {testResult.match_id && (
                  <Link to={`/matches/${testResult.match_id}`} className="btn btn-outline btn-xs">
                    <span>Xem Replay Chi Tiết</span>
                    <ExternalLink size={13} />
                  </Link>
                )}
              </div>

              <div className="test-stat-grid">
                <div className="test-stat-item">
                  <span className="stat-label">Trạng thái</span>
                  <StatusBadge status={testResult.status} />
                </div>
                <div className="test-stat-item">
                  <span className="stat-label">Mã kết thúc</span>
                  <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {testResult.end_code || 'N/A'}
                  </strong>
                </div>
                <div className="test-stat-item">
                  <span className="stat-label">Tổng số nước</span>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {testResult.total_moves !== undefined ? `${testResult.total_moves} nước` : 'Đang xử lý'}
                  </strong>
                </div>
              </div>

              {testResult.reason && (
                <div className="test-reason-wrap">
                  <Info size={15} color="var(--cyan-400)" style={{ flexShrink: 0 }} />
                  <span>{testResult.reason}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Submission History */}
      <div className="glass-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <History size={20} /> Lịch Sử Nộp Bài Của Bạn
          </h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Tổng cộng: {history.length} bản nộp
          </span>
        </div>

        {history.length === 0 ? (
          <div className="empty-history-state">
            <FileArchive size={36} color="var(--text-muted)" />
            <p>Bạn chưa nộp bài lần nào. Hãy kéo thả file <code>.zip</code> ở trên để bắt đầu!</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="styled-table">
              <thead>
                <tr>
                  <th>Thời Gian Nộp</th>
                  <th>Mã Bản Nộp</th>
                  <th>Trạng Thái</th>
                  <th>Hiệu Lực</th>
                  <th>Kết Quả Đấu Thử</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{new Date(h.submitted_at).toLocaleString('vi-VN')}</td>
                    <td><code>{h.id.substring(0, 8)}...</code></td>
                    <td><StatusBadge status={h.status} /></td>
                    <td>
                      {h.is_active ? (
                        <span style={{ color: 'var(--emerald-400)', fontWeight: 600 }}>✅ Đang áp dụng</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>Bản cũ</span>
                      )}
                    </td>
                    <td>
                      {h.test_run_result ? (
                        <StatusBadge status={h.test_run_result.status} />
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Chưa chạy</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Starter Kit Modal */}
      <StarterKitModal isOpen={isStarterKitOpen} onClose={() => setIsStarterKitOpen(false)} />
    </div>
  );
}
