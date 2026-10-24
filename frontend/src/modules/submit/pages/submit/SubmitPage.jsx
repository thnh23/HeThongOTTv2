import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ExternalLink,
  FileCode,
  Sparkles,
  ShieldAlert,
  GitBranch,
  GitCommit,
  FileText,
  Search,
  ArrowRight,
  Cpu,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { StarterKitModal } from '@/shared/components/StarterKitModal/index.js';
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

  useEffect(() => {
    let isMounted = true;
    apiClient
      .get('/submit/config')
      .then((res) => {
        if (isMounted && res) {
          setConfig((prev) => ({ ...prev, ...res }));
        }
      })
      .catch(() => {});
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
            <Sparkles size={13} /> Cổng Nộp Bài Chính Thức 2026
          </span>
        </div>
        <h1 className="submit-main-title">
          Cổng Nộp Bài &amp; <span className="gradient-text">Quy Chế</span>
        </h1>
        <p className="submit-subtitle">
          Nộp link GitHub qua Google Form. Hệ thống <strong>không tự điền bot hộ</strong>; vi phạm sẽ bị xử thua T1.
        </p>

        {/* Action Buttons */}
        <div className="submit-cta-row">
          <a
            href={config.google_form_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-glow"
            id="btn-open-google-form"
          >
            <ExternalLink size={16} />
            <span>Mở Google Form</span>
          </a>

          <a
            href={config.github_template_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
            id="btn-github-template"
          >
            <GitBranch size={16} />
            <span>GitHub Template</span>
          </a>

          <button
            className="btn btn-starter-kit"
            onClick={() => setIsStarterKitOpen(true)}
            id="btn-view-starter-kit"
          >
            <FileCode size={16} />
            <span>Starter Kit</span>
          </button>

          <Link to="/sandbox" className="btn btn-outline" id="btn-goto-sandbox-top">
            <Cpu size={16} />
            <span>Đấu Thử Bot</span>
          </Link>
        </div>
      </div>

      {/* ── RULE BANNER (KHÔNG ĐIỀN HỘ BOT) ── */}
      <div className="forfeit-rule-card">
        <div className="forfeit-icon-wrap">
          <ShieldAlert size={28} />
        </div>
        <div className="forfeit-content">
          <div className="forfeit-title-row">
            <h3>Quy định: Không tự điền bot hộ</h3>
            <span className="forfeit-tag">Xử thua T1</span>
          </div>
          <ul className="forfeit-list">
            <li>
              <strong>Không cấp bot thay thế:</strong> Không nộp bài, repo Private, thiếu <code>bot.py</code> hoặc không có hàm <code>choose_move</code> &rarr; không cấp bot dự phòng.
            </li>
            <li>
              <strong>Xử thua phạt T1:</strong> Lỗi cú pháp, crash, phạm luật hoặc tính toán quá 300ms &rarr; xử thua ngay 0 điểm.
            </li>
            <li>
              <strong>Kênh nộp duy nhất:</strong> Nộp đường dẫn GitHub Repository qua Google Form chính thức trước deadline.
            </li>
          </ul>
        </div>
      </div>

      {/* ── Form Fields & 4-Step Guide ── */}
      <div className="form-guide-grid">
        {/* Card 1: Cấu trúc Google Form */}
        <div className="glass-card form-structure-card">
          <div className="card-header-line">
            <div className="icon-badge-cyan">
              <FileText size={20} color="var(--cyan-400)" />
            </div>
            <div>
              <h3 className="card-title">Thông Tin Google Form</h3>
              <span className="card-subtitle">4 trường bắt buộc cần khai báo</span>
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
              <span>Đi Tới Google Form</span>
            </a>
          </div>
        </div>

        {/* Card 2: Quy trình 4 bước */}
        <div className="glass-card workflow-card">
          <div className="card-header-line">
            <div className="icon-badge-indigo">
              <GitCommit size={20} color="var(--primary-400)" />
            </div>
            <div>
              <h3 className="card-title">Quy Trình 4 Bước</h3>
              <span className="card-subtitle">Từ template đến nộp bài</span>
            </div>
          </div>

          <div className="workflow-steps">
            <div className="workflow-step-item">
              <div className="step-circle">1</div>
              <div className="step-body">
                <h4>Khởi Tạo Repo Từ Template</h4>
                <p>
                  Bấm <strong>Use this template</strong>, đặt tên <code>ottv2-&lt;MaSV&gt;</code> (chế độ <strong>Public</strong>).
                </p>
              </div>
            </div>

            <div className="workflow-step-item">
              <div className="step-circle">2</div>
              <div className="step-body">
                <h4>Lập Trình &amp; Commit Đều Đặn</h4>
                <p>
                  Cài đặt hàm <code>choose_move(state)</code> trong <code>bot.py</code> (tối thiểu <strong>4 commits</strong> phản ánh quá trình làm).
                </p>
              </div>
            </div>

            <div className="workflow-step-item">
              <div className="step-circle">3</div>
              <div className="step-body">
                <h4>Kiểm Tra CI GitHub Actions</h4>
                <p>
                  Đảm bảo workflow Actions báo xanh, cú pháp hợp lệ, độ trễ &le; 300ms và không rò rỉ mã bí mật.
                </p>
              </div>
            </div>

            <div className="workflow-step-item">
              <div className="step-circle">4</div>
              <div className="step-body">
                <h4>Điền Link Vào Google Form</h4>
                <p>
                  Gửi link repo trước giờ đóng cổng, sau đó kiểm tra tình trạng tại Cổng Tra Cứu.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── REDIRECT CTA TO LOOKUP & SANDBOX ── */}
      <div className="glass-card lookup-redirect-card">
        <div className="lookup-redirect-content">
          <div className="icon-badge-cyan redirect-badge">
            <Search size={24} color="var(--cyan-400)" />
          </div>
          <div>
            <h3 className="redirect-title">Đã Nộp Bài? Tra Cứu Tình Trạng Ngay</h3>
            <p className="redirect-desc">
              Kiểm tra mã commit chốt, kết quả thẩm định tự động và phát hiện sự cố kịp thời.
            </p>
          </div>
        </div>
        <div className="lookup-redirect-actions">
          <Link to="/sandbox" className="btn btn-secondary" id="btn-goto-sandbox" style={{ marginRight: '0.75rem' }}>
            <Cpu size={16} />
            <span>Đấu Thử Bot</span>
          </Link>
          <Link to="/lookup" className="btn btn-primary btn-glow" id="btn-goto-lookup">
            <Search size={16} />
            <span>Tra Cứu Bài Thi</span>
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* ── Starter Kit Modal ── */}
      <StarterKitModal
        isOpen={isStarterKitOpen}
        onClose={() => setIsStarterKitOpen(false)}
      />
    </div>
  );
}

export default SubmitPage;
