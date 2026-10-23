import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ExternalLink,
  FileCode,
  Sparkles,
  Shield,
  ShieldAlert,
  GitBranch,
  GitCommit,
  FileText,
  Search,
  ArrowRight,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { StarterKitModal } from '@/shared/components/StarterKitModal/index.js';
import { BenchmarkObstacleModal } from '@/shared/components/BenchmarkObstacleModal/BenchmarkObstacleModal.jsx';
import './SubmitPage.css';

export function SubmitPage() {
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
          Cổng Nộp Bài &amp; <span className="gradient-text">Quy Chế Thi Đấu</span>
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
            onClick={() => setIsBenchmarkOpen(true)}
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
                  Dán link repo của bạn vào Google Form trước giờ đóng cổng. Sau đó kiểm tra tình trạng ghi nhận tại Cổng Tra Cứu chính thức.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── REDIRECT CTA TO DEDICATED LOOKUP PAGE ── */}
      <div className="glass-card lookup-redirect-card">
        <div className="lookup-redirect-content">
          <div className="icon-badge-cyan redirect-badge">
            <Search size={28} color="var(--cyan-400)" />
          </div>
          <div>
            <h3 className="redirect-title">Đã Nộp Bài Qua Google Form? Kiểm Tra Tình Trạng Ngay</h3>
            <p className="redirect-desc">
              Mọi lượt nộp link repo sẽ được hệ thống clone và thẩm định tự động theo định kỳ. 
              Hãy truy cập <strong>Cổng Tra Cứu (Lookup)</strong> để xác minh mã commit hash chốt, kiểm tra 4 tiêu chí cốt lõi, 
              và phát hiện kịp thời các sự cố trước khi bước vào giải đấu.
            </p>
          </div>
        </div>
        <div className="lookup-redirect-actions">
          <Link to="/lookup" className="btn btn-primary btn-glow" id="btn-goto-lookup">
            <Search size={18} />
            <span>Mở Cổng Tra Cứu Bài Thi</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* ── Modals ── */}
      <StarterKitModal
        isOpen={isStarterKitOpen}
        onClose={() => setIsStarterKitOpen(false)}
      />
      <BenchmarkObstacleModal
        isOpen={isBenchmarkOpen}
        onClose={() => setIsBenchmarkOpen(false)}
      />
    </div>
  );
}

export default SubmitPage;
