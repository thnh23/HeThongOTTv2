import React, { useState } from 'react';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  GitBranch,
  FileCode,
  FileText,
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  RefreshCw,
  Award,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useToast } from '@/shared/context/ToastContext.jsx';
import './LookupPage.css';

export function LookupPage() {
  const { showToast } = useToast();
  const [studentIdInput, setStudentIdInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [searchedId, setSearchedId] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    const cleanId = studentIdInput.trim();
    if (!cleanId) {
      showToast('Vui lòng nhập Mã Sinh Viên (MSSV) để tra cứu!', 'error');
      return;
    }

    setIsLoading(true);
    setResult(null);
    setSearchedId(cleanId);

    try {
      const data = await apiClient.get(`/submit/lookup?student_id=${encodeURIComponent(cleanId)}`);
      setResult(data);
    } catch (err) {
      setResult({
        found: false,
        error_message: err.message || 'Không tìm thấy thông tin thí sinh với MSSV này.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const v = result?.validation_details || {};
  const isValid = result?.is_valid;

  return (
    <div className="lookup-page container animate-fade-in">
      {/* Header Banner */}
      <div className="lookup-header">
        <div className="lookup-badge">
          <Award size={15} color="var(--primary-400)" />
          <span>Cổng Tra Cứu Bài Thi Chính Thức</span>
        </div>
        <h1 className="lookup-title">Tra Cứu Tình Trạng Gói Nộp Bài Thi</h1>
        <p className="lookup-subtitle">
          Nhập Mã Sinh Viên (MSSV) để kiểm tra tình trạng thẩm định mã nguồn, mã commit chốt trước hạn chót và 4 tiêu chí cốt lõi của giải đấu OTTv2.
        </p>

        {/* Search Bar */}
        <form className="lookup-search-form" onSubmit={handleSearch}>
          <div className="lookup-input-wrap">
            <Search size={18} className="lookup-search-icon" />
            <input
              type="text"
              className="lookup-input"
              placeholder="Nhập Mã Sinh Viên (ví dụ: 22028123)..."
              value={studentIdInput}
              onChange={(e) => setStudentIdInput(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <button type="submit" className="btn btn-primary lookup-submit-btn" disabled={isLoading}>
            {isLoading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Đang Tra Cứu...</span>
              </>
            ) : (
              <span>Tra Cứu Ngay</span>
            )}
          </button>
        </form>
      </div>

      {/* Results Section */}
      <div className="lookup-result-container">
        {isLoading && (
          <div className="lookup-loading-box glass-card">
            <RefreshCw size={36} className="animate-spin" color="var(--primary-400)" />
            <p>Đang tìm kiếm thông tin bài nộp trên hệ thống...</p>
          </div>
        )}

        {!isLoading && result && !result.found && (
          <div className="lookup-notfound-box glass-card animate-fade-in">
            <XCircle size={44} color="var(--rose-400)" />
            <h3>Chưa Tìm Thấy Dữ Liệu</h3>
            <p className="notfound-desc">
              Hệ thống chưa tìm thấy thông tin của MSSV <strong>{searchedId}</strong>.
            </p>
            <div className="notfound-guide">
              <strong>Gợi ý kiểm tra:</strong>
              <ul>
                <li>Kiểm tra lại xem bạn đã điền đúng MSSV trong biểu mẫu Google Form chưa.</li>
                <li>Nếu bạn vừa nộp Google Form gần đây, vui lòng đợi đợt nạp dữ liệu tiếp theo của Ban Tổ chức.</li>
                <li>Liên hệ Ban Tổ chức qua email hỗ trợ nếu bạn chắc chắn đã nộp bài thành công.</li>
              </ul>
            </div>
          </div>
        )}

        {!isLoading && result && result.found && (
          <div className="lookup-card glass-card animate-fade-in">
            {/* Top Status Banner */}
            <div className={`lookup-status-banner ${isValid ? 'banner-valid' : 'banner-invalid'}`}>
              <div className="banner-icon">
                {isValid ? (
                  <CheckCircle2 size={28} color="#10b981" />
                ) : (
                  <AlertTriangle size={28} color="#f59e0b" />
                )}
              </div>
              <div className="banner-text">
                <h3>
                  {isValid
                    ? 'BÀI NỘP HỢP LỆ — ĐÃ SẴN SÀNG THI ĐẤU'
                    : 'BÀI NỘP CẦN KHẮC PHỤC SỰ CỐ'}
                </h3>
                <p>
                  {isValid
                    ? 'Mã nguồn của bạn đã vượt qua toàn bộ các bước thẩm định tự động và chạy thử Sandbox an toàn.'
                    : 'Bài nộp hiện chưa đạt đủ điều kiện để đưa vào danh sách thi đấu. Vui lòng xem chi tiết lỗi bên dưới và khắc phục.'}
                </p>
              </div>
            </div>

            {/* Candidate Info Grid */}
            <div className="candidate-info-grid">
              <div className="info-item">
                <span className="info-label">Thí Sinh</span>
                <strong className="info-value">{result.name}</strong>
              </div>
              <div className="info-item">
                <span className="info-label">Mã Sinh Viên</span>
                <strong className="info-value">{result.student_id}</strong>
              </div>
              <div className="info-item">
                <span className="info-label">Lớp Khóa</span>
                <span className="info-value">{result.class_name || 'QH-2022-I/CQ'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Tên Bot Đăng Ký</span>
                <span className="info-value bot-tag">{result.bot_name || 'OTT_Bot'}</span>
              </div>
            </div>

            {/* Repository & Commit Lock Section */}
            <div className="commit-lock-box">
              <div className="commit-box-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <GitBranch size={16} color="var(--primary-400)" />
                  <strong>Mã Nguồn & Phiên Bản Commit Được Chốt</strong>
                </div>
                {result.github_repo_url && (
                  <a
                    href={result.github_repo_url.replace('.git', '')}
                    target="_blank"
                    rel="noreferrer"
                    className="repo-link"
                  >
                    <span>Mở GitHub Repository</span>
                    <ExternalLink size={13} />
                  </a>
                )}
              </div>

              <div className="commit-details-row">
                <div className="commit-metric">
                  <span className="metric-title">Commit Hash Chốt Thi Đấu:</span>
                  <code className="commit-hash-code">
                    {result.commit_hash ? result.commit_hash.slice(0, 10) : 'HEAD (Mới nhất)'}
                  </code>
                </div>
                {result.commit_date && (
                  <div className="commit-metric">
                    <span className="metric-title">Thời Gian Commit:</span>
                    <span>{result.commit_date}</span>
                  </div>
                )}
                <div className="commit-metric">
                  <span className="metric-title">Lịch Sử Tự Viết Code:</span>
                  <span
                    className={`commit-badge ${
                      result.commit_count >= 4 ? 'badge-green' : 'badge-yellow'
                    }`}
                  >
                    {result.commit_count > 0
                      ? `${result.commit_count} commits`
                      : 'Chưa đếm được commit'}
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Core Criteria Checklist */}
            <div className="criteria-checklist-section">
              <h4 className="checklist-heading">Chi Tiết 4 Tiêu Chí Cốt Lõi (Khuyến Khích Tự Code)</h4>
              <div className="criteria-cards-grid">
                {/* 1. bot.py */}
                <div className={`criteria-card ${v.bot_py ? 'card-pass' : 'card-fail'}`}>
                  <div className="criteria-card-top">
                    <FileCode size={20} />
                    {v.bot_py ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  </div>
                  <strong>Mã Nguồn bot.py</strong>
                  <span>{v.bot_py ? 'Đã tồn tại trong repo' : 'Thiếu file bot.py'}</span>
                </div>

                {/* 2. choose_move */}
                <div className={`criteria-card ${v.choose_move_fn ? 'card-pass' : 'card-fail'}`}>
                  <div className="criteria-card-top">
                    <FileCode size={20} />
                    {v.choose_move_fn ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  </div>
                  <strong>Hàm choose_move(state)</strong>
                  <span>{v.choose_move_fn ? 'Định nghĩa đúng chuẩn' : 'Chưa có hàm choose_move'}</span>
                </div>

                {/* 3. REPORT.md */}
                <div className={`criteria-card ${v.report_md ? 'card-pass' : 'card-fail'}`}>
                  <div className="criteria-card-top">
                    <FileText size={20} />
                    {v.report_md ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  </div>
                  <strong>Ý Tưởng REPORT.md</strong>
                  <span>{v.report_md ? 'Báo cáo đầy đủ' : 'Thiếu file REPORT.md'}</span>
                </div>

                {/* 4. Git commits */}
                <div className={`criteria-card ${v.git_log ? 'card-pass' : 'card-fail'}`}>
                  <div className="criteria-card-top">
                    <GitBranch size={20} />
                    {v.git_log ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  </div>
                  <strong>Tiến Trình Git Commit</strong>
                  <span>
                    {result.commit_count >= 4
                      ? `Đạt chuẩn (${result.commit_count} commits)`
                      : v.git_log
                      ? `Ít commit (${result.commit_count}/4 commits)`
                      : 'Thiếu lịch sử commit'}
                  </span>
                </div>
              </div>
            </div>

            {/* Errors & Actionable Guidance */}
            {result.errors && result.errors.length > 0 && (
              <div className="lookup-errors-box">
                <div className="box-title">
                  <ShieldAlert size={18} color="var(--rose-400)" />
                  <strong>Các Lỗi Cần Khắc Phục Ngay:</strong>
                </div>
                <ul className="errors-list">
                  {result.errors.map((err, idx) => (
                    <li key={idx}>
                      <XCircle size={14} color="var(--rose-400)" />
                      <span>{err}</span>
                    </li>
                  ))}
                </ul>

                <div className="how-to-fix">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                    <HelpCircle size={15} color="var(--amber-400)" />
                    <strong>Hướng dẫn khắc phục nhanh:</strong>
                  </div>
                  <ol>
                    <li>
                      Nếu lỗi <strong>Repo Private</strong>: Vào GitHub repo của bạn $\rightarrow$ Chọn tab <strong>Settings</strong> $\rightarrow$ Cuộn xuống <strong>Danger Zone</strong> $\rightarrow$ Bấm <strong>Change visibility</strong> $\rightarrow$ Chuyển sang <strong>Public</strong>.
                    </li>
                    <li>
                      Nếu thiếu file hoặc sai cấu trúc: Đẩy các file <code>bot.py</code> và <code>REPORT.md</code> lên nhánh chính (<code>main</code>) của repository.
                    </li>
                    <li>
                      Sau khi sửa xong trên GitHub, bạn không cần nộp lại form nếu link repo không đổi. Hệ thống sẽ tự động cập nhật trong đợt quét tiếp theo!
                    </li>
                  </ol>
                </div>
              </div>
            )}

            {/* Warnings */}
            {result.warnings && result.warnings.length > 0 && (
              <div className="lookup-warnings-box">
                <div className="box-title">
                  <AlertTriangle size={16} color="var(--amber-400)" />
                  <strong>Lưu Ý Từ Ban Tổ Chức:</strong>
                </div>
                <ul className="warnings-list">
                  {result.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default LookupPage;
