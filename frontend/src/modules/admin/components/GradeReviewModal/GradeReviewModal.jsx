import React, { useState, useEffect } from 'react';
import {
  X,
  FileCode,
  FileText,
  MessageSquare,
  Sparkles,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Award,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useToast } from '@/shared/context/ToastContext.jsx';
import './GradeReviewModal.css';

const TIER_WEIGHTS = {
  A: { bot: 30, ai: 25, interview: 30, report: 15 },
  B: { bot: 40, ai: 20, interview: 25, report: 15 },
  C: { bot: 50, ai: 15, interview: 20, report: 15 },
};

export function GradeReviewModal({ isOpen, user, onClose, onGraded }) {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('prompts');
  const [submissionFiles, setSubmissionFiles] = useState(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form scores (0 - 100)
  const [scoreAi, setScoreAi] = useState(user?.score_ai_profile || 0);
  const [scoreInterview, setScoreInterview] = useState(user?.score_interview || 0);
  const [scoreReport, setScoreReport] = useState(user?.score_report || 0);
  const [scoreBot, setScoreBot] = useState(user?.score_bot || 0);
  const [notes, setNotes] = useState('');

  const tier = user?.tier || 'A';
  const weights = TIER_WEIGHTS[tier] || TIER_WEIGHTS.A;

  // Calculate live weighted final score
  const liveFinalScore = (
    (scoreBot * weights.bot +
      scoreAi * weights.ai +
      scoreInterview * weights.interview +
      scoreReport * weights.report) /
    100
  ).toFixed(2);

  // Load files when modal opens
  useEffect(() => {
    if (!isOpen || !user) return;

    setScoreAi(user.score_ai_profile || 0);
    setScoreInterview(user.score_interview || 0);
    setScoreReport(user.score_report || 0);
    setScoreBot(user.score_bot || 0);

    if (user.submission_id) {
      loadFiles(user.submission_id);
    } else {
      setSubmissionFiles(null);
    }
  }, [isOpen, user]);

  const loadFiles = async (subId) => {
    setIsLoadingFiles(true);
    try {
      const data = await apiClient.get(`/admin/submissions/${subId}/files`);
      setSubmissionFiles(data.files || null);
    } catch {
      setSubmissionFiles(null);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const handleSaveGrades = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiClient.post(`/admin/review/${user.id}`, {
        score_ai_profile: parseFloat(scoreAi) || 0,
        score_interview: parseFloat(scoreInterview) || 0,
        score_report: parseFloat(scoreReport) || 0,
        score_bot: parseFloat(scoreBot) || 0,
        notes,
      });

      showToast(`Đã lưu kết quả chấm điểm cho thí sinh ${user.name}!`, 'success');
      if (onGraded) onGraded();
      onClose();
    } catch (err) {
      showToast('Lỗi khi lưu điểm: ' + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="review-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="review-modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 className="review-modal-title">Hội Đồng Chấm Điểm & Đánh Giá Thí Sinh</h2>
              <span className={`tier-pill tier-${user.tier}`}>Bảng {user.tier}</span>
            </div>
            <p className="review-modal-subtitle">
              Thí sinh: <strong>{user.name}</strong> • Email: <code>{user.email}</code>
            </p>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>

        {/* Content Body: Dual Column */}
        <div className="review-modal-body">
          {/* Left Column: File Inspector */}
          <div className="review-files-col">
            <div className="files-nav-tabs">
              <button
                className={`tab-btn ${activeTab === 'prompts' ? 'active' : ''}`}
                onClick={() => setActiveTab('prompts')}
              >
                <Sparkles size={15} />
                <span>PROMPTS.md (T08)</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'bot' ? 'active' : ''}`}
                onClick={() => setActiveTab('bot')}
              >
                <FileCode size={15} />
                <span>bot.py</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
                onClick={() => setActiveTab('report')}
              >
                <FileText size={15} />
                <span>REPORT.md</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                <MessageSquare size={15} />
                <span>chat_history/</span>
              </button>
            </div>

            <div className="file-content-viewport">
              {isLoadingFiles ? (
                <div className="file-loading-state">
                  <RefreshCw className="animate-spin" size={24} />
                  <span>Đang giải nén và tải file bài làm...</span>
                </div>
              ) : !submissionFiles ? (
                <div className="file-empty-state">
                  <AlertTriangle size={32} color="var(--amber-400)" />
                  <p>Thí sinh chưa nộp bài hoặc file nén đang được xử lý.</p>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Bạn vẫn có thể chấm điểm vấn đáp và lưu kết quả bên phải.
                  </span>
                </div>
              ) : (
                <pre className="file-code-pre">
                  <code>
                    {activeTab === 'prompts' && (submissionFiles.prompts_md || 'File PROMPTS.md trống')}
                    {activeTab === 'bot' && (submissionFiles.bot_py || 'File bot.py trống')}
                    {activeTab === 'report' && (submissionFiles.report_md || 'File REPORT.md trống')}
                    {activeTab === 'chat' && (
                      submissionFiles.chat_history?.length > 0
                        ? submissionFiles.chat_history.map((c, idx) => `=== ${c.filename} ===\n${c.content}\n\n`).join('')
                        : 'Không có file hội thoại trong thư mục chat_history/'
                    )}
                  </code>
                </pre>
              )}
            </div>
          </div>

          {/* Right Column: Grading Form & Live Formula */}
          <form className="review-grading-col" onSubmit={handleSaveGrades}>
            <div className="grading-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Award size={18} color="var(--amber-400)" />
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Bảng Điểm Bảng {user.tier}</h3>
              </div>
              <div className="live-score-pill">
                <span>Tổng Kết: </span>
                <strong>{liveFinalScore} / 100</strong>
              </div>
            </div>

            {/* Weights Breakdown Badge */}
            <div className="weights-pill-banner">
              <span>Trọng số Bảng {user.tier}: </span>
              <span>Bot: {weights.bot}% • AI: {weights.ai}% • Vấn đáp: {weights.interview}% • Báo cáo: {weights.report}%</span>
            </div>

            <div className="grade-inputs-list">
              {/* Score AI Profile */}
              <div className="grade-field">
                <div className="grade-field-label">
                  <label htmlFor="score-ai">1. Hồ Sơ AI (Prompt log - T08)</label>
                  <span className="field-weight">Trọng số {weights.ai}%</span>
                </div>
                <div className="grade-input-wrap">
                  <input
                    id="score-ai"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="form-input grade-input"
                    value={scoreAi}
                    onChange={(e) => setScoreAi(e.target.value)}
                    required
                  />
                  <span className="unit-label">/ 100</span>
                </div>
                <span className="grade-hint">Thang Bảng 6: Xuất sắc (90-100), Tốt (70-89), Đạt (50-69)</span>
              </div>

              {/* Score Interview */}
              <div className="grade-field">
                <div className="grade-field-label">
                  <label htmlFor="score-interview">2. Vấn Đáp Hiểu Code (10 phút)</label>
                  <span className="field-weight">Trọng số {weights.interview}%</span>
                </div>
                <div className="grade-input-wrap">
                  <input
                    id="score-interview"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="form-input grade-input"
                    value={scoreInterview}
                    onChange={(e) => setScoreInterview(e.target.value)}
                    required
                  />
                  <span className="unit-label">/ 100</span>
                </div>
                <span className="grade-hint">Quy trình Bảng 7: Giải thích code, hỏi nếu đổi X, sửa nhỏ</span>
              </div>

              {/* Score Report */}
              <div className="grade-field">
                <div className="grade-field-label">
                  <label htmlFor="score-report">3. Báo Cáo Tự Đánh Giá (REPORT.md)</label>
                  <span className="field-weight">Trọng số {weights.report}%</span>
                </div>
                <div className="grade-input-wrap">
                  <input
                    id="score-report"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="form-input grade-input"
                    value={scoreReport}
                    onChange={(e) => setScoreReport(e.target.value)}
                    required
                  />
                  <span className="unit-label">/ 100</span>
                </div>
              </div>

              {/* Score Bot */}
              <div className="grade-field">
                <div className="grade-field-label">
                  <label htmlFor="score-bot">4. Hiệu Quả Bot Trong Giải Đấu</label>
                  <span className="field-weight">Trọng số {weights.bot}%</span>
                </div>
                <div className="grade-input-wrap">
                  <input
                    id="score-bot"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="form-input grade-input"
                    value={scoreBot}
                    onChange={(e) => setScoreBot(e.target.value)}
                  />
                  <span className="unit-label">/ 100</span>
                </div>
                <span className="grade-hint">Tự động theo xếp hạng vòng tròn hoặc nhập trực tiếp</span>
              </div>

              {/* Notes */}
              <div className="grade-field">
                <label htmlFor="grade-notes" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Nhận xét của Giám khảo / Hội đồng:
                </label>
                <textarea
                  id="grade-notes"
                  rows="3"
                  className="form-input"
                  style={{ width: '100%', resize: 'vertical' }}
                  placeholder="Ghi chú đánh giá điểm mạnh, phần sửa code, thái độ trả lời..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="grading-footer-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
                Hủy Bỏ
              </button>
              <button
                id="btn-save-grades-submit"
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>Đang lưu điểm...</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>Lưu & Hoàn Tất Chấm</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
