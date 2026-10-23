import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ExternalLink,
  FileCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Sparkles,
  Shield,
  ShieldAlert,
  GitBranch,
  GitCommit,
  FileText,
  Clock,
  RefreshCw,
  Play,
  Info,
  Check,
  User as UserIcon,
  HelpCircle,
  Award,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useAuth } from '@/shared/context/AuthContext.jsx';
import { useToast } from '@/shared/context/ToastContext.jsx';
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge.jsx';
import { StarterKitModal } from '@/shared/components/StarterKitModal/index.js';
import { BenchmarkObstacleModal } from '@/shared/components/BenchmarkObstacleModal/BenchmarkObstacleModal.jsx';
import './SubmitPage.css';

export function SubmitPage() {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [config, setConfig] = useState({
    submission_mode: 'google_form',
    google_form_url: 'https://forms.gle/official-ottv2-submission-form',
    github_template_url: 'https://github.com/lekimlonguet/ottv2-template',
    form_fields: [
      { id: 'fullname', label: 'Họ và tên', description: 'Họ tên đầy đủ theo danh sách lớp UET' },
      { id: 'student_id', label: 'Mã sinh viên (MSSV)', description: '8 chữ số (ví dụ: 22028100)' },
      { id: 'class_name', label: 'Lớp học phần', description: 'Lớp môn học Lập trình mạng (INT3304)' },
      { id: 'github_repo_url', label: 'Link GitHub Repository', description: 'https://github.com/<username>/ottv2-<MaSV> (Public, tạo từ Template chuẩn)' },
    ],
    announcement: 'Giải đấu thống nhất phương thức nộp bài qua GitHub Repository & Google Form chính thức.',
  });

  const [isStarterKitOpen, setIsStarterKitOpen] = useState(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);
  const [benchmarkStudentId, setBenchmarkStudentId] = useState('');

  // Lookup state
  const [searchStudentId, setSearchStudentId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Fetch config from server
  useEffect(() => {
    let isMounted = true;
    apiClient
      .get('/submit/config')
      .then((res) => {
        if (isMounted && res) {
          setConfig((prev) => ({ ...prev, ...res }));
        }
      })
      .catch(() => {
        // use fallback defaults
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Pre-fill and auto search if user is authenticated with student_id
  useEffect(() => {
    if (isAuthenticated && user?.student_id && !hasSearched) {
      setSearchStudentId(user.student_id);
      handleLookup(user.student_id);
    }
  }, [isAuthenticated, user]);

  const handleLookup = async (idToSearch) => {
    const targetId = (idToSearch || searchStudentId || '').trim();
    if (!targetId) {
      showToast('Vui lòng nhập Mã Sinh Viên (MSSV) để tra cứu', 'warning');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    try {
      const data = await apiClient.get(`/submit/lookup/${encodeURIComponent(targetId)}`);
      setLookupResult(data);
      if (data && data.status === 'valid') {
        showToast(`Tìm thấy bài nộp hợp lệ của MSSV ${targetId}!`, 'success');
      } else if (data && data.found === false) {
        showToast(`Chưa có dữ liệu thí sinh cho MSSV ${targetId}`, 'info');
      }
    } catch (err) {
      const msg = err.message || 'Không thể tra cứu thông tin bài nộp';
      showToast(msg, 'error');
      setLookupResult({
        found: false,
        student_id: targetId,
        message: msg,
      });
    } finally {
      setIsSearching(false);
    }
  };

  const openBenchmarkForStudent = (studentId) => {
    setBenchmarkStudentId(studentId);
    setIsBenchmarkOpen(true);
  };

  return (
    <div className="submit-page animate-fade-in">
      {/* ── Page Header ── */}
      <div className="submit-header">
        <div className="header-badge-wrap">
          <span className="unified-portal-badge">
            <Sparkles size={14} /> Thống Nhất Phương Thức Nộp Bài Giải Đấu 2026
          </span>
        </div>
        <h1 className="submit-main-title">
          Cổng Nộp Bài & <span className="gradient-text">Tra Cứu Thẩm Định</span>
        </h1>
        <p className="submit-subtitle">
          Giải đấu OTTv2 chuyển đổi toàn diện sang mô hình GitHub Repository &amp; Google Form.
          Hệ thống <strong className="highlight-danger">KHÔNG tự điền bot hộ thí sinh</strong>. 
          Mọi bài nộp không hợp lệ sẽ bị xử thua trực tiếp (Forfeit T1).
        </p>

        {/* Primary Call-to-Action Buttons */}
        <div className="submit-cta-row">
          <a
            href={config.google_form_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-glow"
          >
            <ExternalLink size={18} />
            <span>Mở Google Form Nộp Bài Thi</span>
          </a>

          <a
            href={config.github_template_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
          >
            <GitBranch size={18} />
            <span>GitHub Template Chuẩn (ottv2-template)</span>
          </a>

          <button
            className="btn btn-starter-kit"
            onClick={() => setIsStarterKitOpen(true)}
          >
            <FileCode size={18} />
            <span>Xem Starter Kit Bot</span>
          </button>

          <button
            className="btn btn-outline btn-amber"
            onClick={() => openBenchmarkForStudent(lookupResult?.student_id || '')}
          >
            <Shield size={18} />
            <span>Benchmark Top 32 (Ô Cản)</span>
          </button>
        </div>
      </div>

      {/* ── CRITICAL TOURNAMENT RULE BANNER (KHÔNG ĐIỀN HỘ BOT) ── */}
      <div className="forfeit-rule-card">
        <div className="forfeit-icon-wrap">
          <ShieldAlert size={32} />
        </div>
        <div className="forfeit-content">
          <div className="forfeit-title-row">
            <h3>Quy Chế Giải Đấu Nghiêm Ngặt: Hệ Thống KHÔNG Tự Điền Bot Hộ</h3>
            <span className="forfeit-tag">Xử Thua Trực Tiếp T1</span>
          </div>
          <p className="forfeit-desc">
            Nhằm đảm bảo tính minh bạch, công bằng tuyệt đối cho giải đấu:
          </p>
          <ul className="forfeit-list">
            <li>
              <strong>Không hỗ trợ Bot thay thế:</strong> Nếu thí sinh không nộp bài, repo đặt Private, thiếu file <code>bot.py</code>, hoặc không chứa hàm <code>choose_move(state)</code>, hệ thống <strong>tuyệt đối không</strong> tự điền GreedyBot hay RandomBot hộ.
            </li>
            <li>
              <strong>Xử thua Forfeit (T1):</strong> Mọi lỗi cú pháp Python (SyntaxError), bot bị crash, vi phạm ô cản, hoặc timeout quá 2.0 giây sẽ lập tức bị <strong>xử thua 0 điểm</strong> trong trận đấu tương ứng.
            </li>
            <li>
              <strong>Thống nhất kênh nộp:</strong> Cổng nộp file .zip qua web đã đóng. Thí sinh phải nộp đường dẫn GitHub Repository qua <strong>Google Form chính thức</strong> trước thời hạn chót (Deadline).
            </li>
          </ul>
        </div>
      </div>

      {/* ── Two-Column Information Cards: Google Form Fields & 4-Step Guide ── */}
      <div className="form-guide-grid">
        {/* Card 1: Cấu trúc Google Form */}
        <div className="glass-card form-structure-card">
          <div className="card-header-line">
            <div className="icon-badge-cyan">
              <FileText size={22} color="var(--cyan-400)" />
            </div>
            <div>
              <h3 className="card-title">Cấu Trúc Google Form Nộp Link</h3>
              <span className="card-subtitle">4 trường thông tin bắt buộc thí sinh cần khai báo</span>
            </div>
          </div>

          <div className="form-fields-list">
            {config.form_fields.map((field, idx) => (
              <div key={field.id || idx} className="form-field-item">
                <div className="field-number">{idx + 1}</div>
                <div className="field-info">
                  <div className="field-label-row">
                    <span className="field-name">{field.label}</span>
                    <span className="field-required">Bắt buộc</span>
                  </div>
                  <span className="field-desc">{field.description}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="form-cta-footer">
            <a
              href={config.google_form_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <ExternalLink size={16} />
              <span>Đi Tới Biểu Mẫu Google Form</span>
            </a>
          </div>
        </div>

        {/* Card 2: Quy trình 4 bước nộp bài */}
        <div className="glass-card workflow-card">
          <div className="card-header-line">
            <div className="icon-badge-indigo">
              <GitCommit size={22} color="var(--primary-400)" />
            </div>
            <div>
              <h3 className="card-title">Quy Trình 4 Bước Hoàn Thiện Bài Nộp</h3>
              <span className="card-subtitle">Minh chứng năng lực phát triển phần mềm qua Git</span>
            </div>
          </div>

          <div className="workflow-steps">
            <div className="workflow-step-item">
              <div className="step-circle">1</div>
              <div className="step-body">
                <h4>Nhận &amp; Khởi Tạo Repository từ Template</h4>
                <p>
                  Truy cập GitHub Template của BTC, bấm <strong>Use this template</strong> để tạo repo cá nhân theo cú pháp: <code>https://github.com/&lt;user&gt;/ottv2-&lt;MaSV&gt;</code> (chế độ <strong>Public</strong>).
                </p>
              </div>
            </div>

            <div className="workflow-step-item">
              <div className="step-circle">2</div>
              <div className="step-body">
                <h4>Lập Trình Thuật Toán &amp; Commit Đều Đặn</h4>
                <p>
                  Cài đặt hàm <code>choose_move(state)</code> trong <code>bot.py</code>. Viết báo cáo giải thuật tại <code>REPORT.md</code>. Thực hiện tối thiểu <strong>4 commits phân tán</strong> phản ánh quá trình tự làm.
                </p>
              </div>
            </div>

            <div className="workflow-step-item">
              <div className="step-circle">3</div>
              <div className="step-body">
                <h4>Kiểm Tra CI/CD GitHub Actions Xanh 100%</h4>
                <p>
                  Đẩy code lên GitHub và kiểm tra tab Actions. Hệ thống tự động kiểm tra cú pháp, đo độ trễ &lt; 200ms và quét an ninh mã nguồn (không rò rỉ API Key).
                </p>
              </div>
            </div>

            <div className="workflow-step-item">
              <div className="step-circle">4</div>
              <div className="step-body">
                <h4>Điền Link Repo Vào Google Form Trước Deadline</h4>
                <p>
                  Dán link repo của bạn vào Google Form trước giờ đóng cổng. Dùng công cụ tra cứu bên dưới để xác nhận máy chủ đã ghi nhận commit hash của bạn.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── LIVE STUDENT VERIFICATION & LOOKUP PORTAL ── */}
      <div className="glass-card lookup-container-card">
        <div className="lookup-header">
          <div className="lookup-title-wrap">
            <div className="icon-badge-cyan">
              <Search size={22} color="var(--cyan-400)" />
            </div>
            <div>
              <h3 className="card-title">Tra Cứu Tình Trạng Thẩm Định &amp; Commit Hash</h3>
              <span className="card-subtitle">
                Kiểm tra mã commit hash chốt, kết quả validator tự động, và tính hợp lệ trước giờ thi đấu
              </span>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <form
          className="lookup-search-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleLookup();
          }}
        >
          <div className="lookup-input-wrapper">
            <Search size={18} className="search-input-icon" />
            <input
              type="text"
              id="student-lookup-input"
              className="lookup-input"
              placeholder="Nhập Mã Sinh Viên (MSSV) 8 chữ số (ví dụ: 22028100 hoặc 22020001)..."
              value={searchStudentId}
              onChange={(e) => setSearchStudentId(e.target.value)}
            />
          </div>
          <button
            type="submit"
            id="btn-student-lookup"
            className="btn btn-primary lookup-submit-btn"
            disabled={isSearching}
          >
            {isSearching ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Đang Tra Cứu...</span>
              </>
            ) : (
              <>
                <Search size={16} />
                <span>Tra Cứu Trạng Thái</span>
              </>
            )}
          </button>
        </form>

        {/* Lookup Results Display */}
        {lookupResult && (
          <div className="lookup-result-box animate-fade-in">
            {lookupResult.found === false ? (
              <div className="lookup-not-found-card">
                <AlertTriangle size={32} color="var(--amber-400)" />
                <div>
                  <h4>Chưa Tìm Thấy Dữ Liệu Cho MSSV "{lookupResult.student_id}"</h4>
                  <p>{lookupResult.message || 'Thí sinh chưa nộp link qua Google Form hoặc hệ thống đang đồng bộ danh sách.'}</p>
                  <div style={{ marginTop: '0.75rem' }}>
                    <a
                      href={config.google_form_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-outline btn-sm"
                    >
                      <ExternalLink size={14} />
                      <span>Nộp Link Bài Thi Ngay Qua Google Form</span>
                    </a>
                  </div>
                </div>
              </div>
            ) : (
              <div className="lookup-detail-card">
                {/* Result Header */}
                <div className="result-card-header">
                  <div className="candidate-primary-info">
                    <div className="candidate-avatar">
                      <UserIcon size={24} />
                    </div>
                    <div>
                      <div className="candidate-name-row">
                        <h4 className="candidate-name">{lookupResult.name || 'Thí sinh UET'}</h4>
                        <span className="candidate-mssv">MSSV: {lookupResult.student_id}</span>
                        {lookupResult.class_name && (
                          <span className="candidate-class">Lớp: {lookupResult.class_name}</span>
                        )}
                      </div>
                      {lookupResult.github_repo_url && (
                        <div className="candidate-repo-link">
                          <GitBranch size={14} />
                          <a
                            href={lookupResult.github_repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {lookupResult.github_repo_url}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="candidate-status-wrap">
                    <StatusBadge status={lookupResult.status || 'unknown'} />
                  </div>
                </div>

                {/* Git Checkout Verification Card */}
                {lookupResult.has_submission && (
                  <div className="git-checkout-strip">
                    <div className="git-strip-item">
                      <span className="git-label">Mã Commit Chốt:</span>
                      <code className="git-hash-code">
                        {(lookupResult.commit_hash || lookupResult.git_log?.checkout_hash)
                          ? (lookupResult.commit_hash || lookupResult.git_log?.checkout_hash).substring(0, 10)
                          : 'N/A'}
                      </code>
                    </div>
                    <div className="git-strip-item">
                      <span className="git-label">Tổng Commit Hợp Lệ:</span>
                      <strong>{lookupResult.commit_count || lookupResult.git_log?.total_commits || 0} commits</strong>
                    </div>
                    <div className="git-strip-item">
                      <span className="git-label">Thời Điểm Commit / Nộp:</span>
                      <span>
                        {(lookupResult.commit_date || lookupResult.git_log?.latest_commit_date || lookupResult.submitted_at)
                          ? new Date(lookupResult.commit_date || lookupResult.git_log?.latest_commit_date || lookupResult.submitted_at).toLocaleString('vi-VN')
                          : 'Chưa đồng bộ'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Validation Checklist Items */}
                <div className="validation-section">
                  <h5 className="validation-section-title">
                    <Check size={16} color="var(--cyan-400)" />
                    Kết Quả Thẩm Định Tự Động:
                  </h5>

                  {(() => {
                    const val = lookupResult.validation || lookupResult.validation_details || {};
                    return (
                      <div className="validation-grid-badges">
                        <div className={`val-pill ${val.bot_py ? 'pill-pass' : 'pill-fail'}`}>
                          {val.bot_py ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                          <span>File <code>bot.py</code></span>
                        </div>

                        <div className={`val-pill ${val.choose_move_fn ? 'pill-pass' : 'pill-fail'}`}>
                          {val.choose_move_fn ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                          <span>Hàm <code>choose_move(state)</code></span>
                        </div>

                        <div className={`val-pill ${val.report_md ? 'pill-pass' : 'pill-fail'}`}>
                          {val.report_md ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                          <span>Báo Cáo <code>REPORT.md</code></span>
                        </div>

                        <div className={`val-pill ${val.git_log ? 'pill-pass' : 'pill-fail'}`}>
                          {val.git_log ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                          <span>Lịch Sử Git (≥ 4 commits)</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Errors display if any */}
                {lookupResult.errors && lookupResult.errors.length > 0 && (
                  <div className="error-callout" role="alert">
                    <strong style={{ color: 'var(--rose-500)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                      <XCircle size={16} /> Cảnh báo lỗi: Bot sẽ bị xử thua T1 nếu không sửa các lỗi sau:
                    </strong>
                    <ul style={{ paddingLeft: '1.25rem', color: '#fff', fontSize: '0.9rem' }}>
                      {lookupResult.errors.map((e, idx) => (
                        <li key={idx}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings display if any */}
                {lookupResult.warnings && lookupResult.warnings.length > 0 && (
                  <div className="warning-callout" role="alert">
                    <strong style={{ color: 'var(--amber-400)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
                      <AlertTriangle size={16} /> Cảnh báo an ninh mã nguồn (T09):
                    </strong>
                    <ul style={{ paddingLeft: '1.25rem', color: '#fff', fontSize: '0.9rem' }}>
                      {lookupResult.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action buttons */}
                <div className="lookup-actions-row">
                  <button
                    className="btn btn-outline btn-amber btn-sm"
                    onClick={() => openBenchmarkForStudent(lookupResult.student_id)}
                  >
                    <Shield size={15} />
                    <span>Đưa Bot Này Vào Benchmark Sandbox Top 32</span>
                  </button>

                  <a
                    href={config.google_form_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline btn-sm"
                  >
                    <ExternalLink size={15} />
                    <span>Cập Nhật Lại Link Bài Thi</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <StarterKitModal
        isOpen={isStarterKitOpen}
        onClose={() => setIsStarterKitOpen(false)}
      />
      <BenchmarkObstacleModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
        initialStudentId={benchmarkStudentId}
      />
    </div>
  );
}
