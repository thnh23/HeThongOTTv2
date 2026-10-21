import React, { useState, useEffect } from 'react';
import {
  X,
  FileCode,
  FileText,
  Sparkles,
  Save,
  AlertTriangle,
  RefreshCw,
  Award,
  Zap,
  GitBranch,
  ShieldAlert,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useToast } from '@/shared/context/ToastContext.jsx';
import './GradeReviewModal.css';

// Trọng số học phần chuẩn hóa theo Kế hoạch Giải đấu Swiss 13 Vòng & Top 32
const TOURNAMENT_WEIGHTS = {
  bot: 40,       // 40% Hiệu quả thi đấu trong giải (Swiss 13 Vòng & Top 32)
  ai: 20,        // 20% Tiến trình Code & Lịch sử Git (git_log.txt, >= 4 commits, MOSS)
  interview: 25, // 25% Vấn đáp bảo vệ thuật toán & hiểu code (5-10 phút)
  report: 15,    // 15% Báo cáo kỹ thuật phân tích chiến thuật (REPORT.md)
};

export function GradeReviewModal({ isOpen, user, onClose, onGraded }) {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('bot');
  const [submissionFiles, setSubmissionFiles] = useState(null);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form scores (0 - 100)
  const [scoreBot, setScoreBot] = useState(user?.score_bot || 0);
  const [scoreAi, setScoreAi] = useState(user?.score_ai_profile || 0);
  const [scoreInterview, setScoreInterview] = useState(user?.score_interview || 0);
  const [scoreReport, setScoreReport] = useState(user?.score_report || 0);
  const [notes, setNotes] = useState(user?.notes || '');

  // Calculate live weighted final score (thang 100)
  const liveFinalScore = (
    (scoreBot * TOURNAMENT_WEIGHTS.bot +
      scoreAi * TOURNAMENT_WEIGHTS.ai +
      scoreInterview * TOURNAMENT_WEIGHTS.interview +
      scoreReport * TOURNAMENT_WEIGHTS.report) /
    100
  ).toFixed(2);

  // Điểm học phần hệ 10 quy đổi
  const score10 = (Number(liveFinalScore) / 10).toFixed(2);

  // Chuyển sang điểm chữ UET
  const getLetterGrade = (val10) => {
    const s = Number(val10);
    if (s >= 9.0) return { letter: 'A+', desc: 'Xuất Sắc', color: '#10b981' };
    if (s >= 8.5) return { letter: 'A', desc: 'Giỏi', color: '#059669' };
    if (s >= 8.0) return { letter: 'B+', desc: 'Khá Giỏi', color: '#3b82f6' };
    if (s >= 7.0) return { letter: 'B', desc: 'Khá', color: '#6366f1' };
    if (s >= 6.5) return { letter: 'C+', desc: 'Trung Bình Khá', color: '#f59e0b' };
    if (s >= 5.5) return { letter: 'C', desc: 'Trung Bình', color: '#d97706' };
    if (s >= 4.0) return { letter: 'D', desc: 'Đạt', color: '#ef4444' };
    return { letter: 'F', desc: 'Không Đạt', color: '#dc2626' };
  };

  const letterInfo = getLetterGrade(score10);

  const loadFiles = async (targetUser) => {
    setIsLoadingFiles(true);
    try {
      const targetId = targetUser.submission_id || targetUser.id;
      const data = await apiClient.get(`/admin/submissions/${targetId}/files`);
      setSubmissionFiles(data?.files || null);
    } catch {
      setSubmissionFiles(null);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Load files when modal opens
  useEffect(() => {
    if (!isOpen || !user) return;

    setScoreBot(user.score_bot || 0);
    setScoreAi(user.score_ai_profile || 0);
    setScoreInterview(user.score_interview || 0);
    setScoreReport(user.score_report || 0);
    setNotes(user.notes || '');

    loadFiles(user);
  }, [isOpen, user]);

  // Tự động điền điểm theo bậc thang Swiss 13 Vòng
  const handleApplySwissSuggestion = () => {
    const wins = user.swiss_wins || 0;
    const isTop32 = Boolean(user.is_top32);

    let baseScore = 70;
    if (isTop32) {
      baseScore = 100;
    } else if (wins >= 10) {
      baseScore = 95;
    } else if (wins >= 8) {
      baseScore = 90;
    } else if (wins >= 6) {
      baseScore = 85;
    } else if (wins >= 4) {
      baseScore = 75;
    } else {
      baseScore = 70;
    }

    setScoreBot(baseScore);
    setScoreAi(Math.min(100, baseScore + (user.commit_count > 10 ? 5 : 0)));
    setScoreInterview(baseScore);
    setScoreReport(baseScore);

    showToast(`Đã áp dụng thang điểm đề xuất cho ${wins} trận thắng Swiss (${baseScore}/100)!`, 'info');
  };

  const handleSaveGrades = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiClient.post(`/admin/review/${user.id}`, {
        score_bot: parseFloat(scoreBot) || 0,
        score_ai_profile: parseFloat(scoreAi) || 0,
        score_interview: parseFloat(scoreInterview) || 0,
        score_report: parseFloat(scoreReport) || 0,
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
    <div className="modal-backdrop animate-fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div className="review-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="review-modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <h2 className="review-modal-title">Hội Đồng Chấm Điểm &amp; Đánh Giá Học Phần</h2>
              {user.is_top32 ? (
                <span className="top32-pill" style={{ background: '#f59e0b', color: '#000', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                  ★ TOP 32 CHUNG KẾT
                </span>
              ) : (
                <span className="swiss-hub-badge" style={{ fontSize: '0.75rem' }}>
                  SWISS 13 VÒNG ({user.swiss_wins || 0}W - {user.swiss_points || 0} pts)
                </span>
              )}
            </div>
            <div className="review-modal-subtitle" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
              <span>Thí sinh: <strong>{user.name}</strong></span>
              {user.student_id && <span>MSSV: <code>{user.student_id}</code></span>}
              {user.class_name && <span>Lớp: <code>{user.class_name}</code></span>}
              <span>Email: <code>{user.email}</code></span>
            </div>
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
                className={`tab-btn ${activeTab === 'bot' ? 'active' : ''}`}
                onClick={() => setActiveTab('bot')}
              >
                <FileCode size={15} />
                <span>bot.py (Mã Nguồn)</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'git_log' ? 'active' : ''}`}
                onClick={() => setActiveTab('git_log')}
              >
                <GitBranch size={15} />
                <span>git_log.txt (Lịch Sử)</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
                onClick={() => setActiveTab('report')}
              >
                <FileText size={15} />
                <span>REPORT.md (Ý Tưởng)</span>
              </button>
              {submissionFiles?.prompts_md && (
                <button
                  className={`tab-btn ${activeTab === 'prompts' ? 'active' : ''}`}
                  onClick={() => setActiveTab('prompts')}
                >
                  <Sparkles size={15} />
                  <span>PROMPTS.md (Cũ)</span>
                </button>
              )}
            </div>

            <div className="file-content-viewport">
              {isLoadingFiles ? (
                <div className="file-loading-state">
                  <RefreshCw className="animate-spin" size={24} />
                  <span>Đang giải nén và tải bài làm của thí sinh...</span>
                </div>
              ) : !submissionFiles ? (
                <div className="file-empty-state">
                  <AlertTriangle size={32} color="var(--amber-400)" />
                  <p>Thí sinh chưa nộp bài hoặc file nén đang được xử lý.</p>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Bạn vẫn có thể chấm điểm vấn đáp và lưu kết quả đánh giá ở cột bên phải.
                  </span>
                </div>
              ) : (
                <pre className="file-code-pre">
                  <code>
                    {activeTab === 'bot' && (submissionFiles.bot_py || 'File bot.py trống')}
                    {activeTab === 'git_log' && (submissionFiles.git_log || 'Chưa tìm thấy git_log.txt hoặc lịch sử git')}
                    {activeTab === 'report' && (submissionFiles.report_md || 'File REPORT.md trống')}
                    {activeTab === 'prompts' && (submissionFiles.prompts_md || 'File PROMPTS.md trống')}
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
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Bảng Điểm Học Phần</h3>
              </div>
              <div className="live-score-pill">
                <span>Hệ 10: </span>
                <strong style={{ color: letterInfo.color }}>{score10} / 10</strong>
                <span style={{ marginLeft: '4px', fontSize: '0.85rem' }}>({letterInfo.letter})</span>
              </div>
            </div>

            {/* Weights Breakdown Banner */}
            <div className="weights-pill-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong>Trọng số: </strong>
                <span>Code &amp; Thi Đấu: {TOURNAMENT_WEIGHTS.bot}% • Lịch Sử Git: {TOURNAMENT_WEIGHTS.ai}% • Vấn Đáp: {TOURNAMENT_WEIGHTS.interview}% • Ý Tưởng &amp; Báo Cáo: {TOURNAMENT_WEIGHTS.report}%</span>
              </div>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={handleApplySwissSuggestion}
                title="Tự động áp dụng mức điểm theo số trận thắng Swiss"
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              >
                <Zap size={12} color="var(--amber-400)" />
                <span>Gợi Ý Điểm Swiss</span>
              </button>
            </div>

            {/* Swiss Integrity Metrics Pill */}
            {(user.commit_count > 0 || user.moss_similarity > 0) && (
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem', background: 'rgba(255,255,255,0.03)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                {user.commit_count > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
                    <GitBranch size={13} />
                    <span>Lịch sử: <strong>{user.commit_count} commits</strong></span>
                  </span>
                )}
                {user.moss_similarity > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: user.moss_similarity > 40 ? '#ef4444' : 'var(--text-secondary)' }}>
                    <ShieldAlert size={13} />
                    <span>Quét MOSS: <strong>{user.moss_similarity}%</strong></span>
                  </span>
                )}
              </div>
            )}

            <div className="grade-inputs-list">
              {/* Score Bot */}
              <div className="grade-field">
                <div className="grade-field-label">
                  <label htmlFor="score-bot">1. Mã Nguồn &amp; Hiệu Quả Thi Đấu (Swiss &amp; Top 32)</label>
                  <span className="field-weight">Trọng số {TOURNAMENT_WEIGHTS.bot}%</span>
                </div>
                <div className="grade-input-wrap">
                  <input
                    id="score-bot"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="form-control grade-input"
                    value={scoreBot}
                    onChange={(e) => setScoreBot(e.target.value)}
                    required
                  />
                  <span className="unit-label">/ 100</span>
                </div>
                <span className="grade-hint">
                  {user.swiss_wins || 0} trận thắng Swiss • Điểm đề xuất lũy tiến: {user.projected_grade_10 ? `${user.projected_grade_10 * 10} điểm` : 'Chưa thi đấu'}
                </span>
              </div>

              {/* Score AI Profile -> Git Commit History */}
              <div className="grade-field">
                <div className="grade-field-label">
                  <label htmlFor="score-ai">2. Tiến Trình Code &amp; Lịch Sử Commit (Git History)</label>
                  <span className="field-weight">Trọng số {TOURNAMENT_WEIGHTS.ai}%</span>
                </div>
                <div className="grade-input-wrap">
                  <input
                    id="score-ai"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="form-control grade-input"
                    value={scoreAi}
                    onChange={(e) => setScoreAi(e.target.value)}
                    required
                  />
                  <span className="unit-label">/ 100</span>
                </div>
                <span className="grade-hint">Đánh giá lịch sử Git (≥4 commits), thời gian commit trải đều các ngày, tự viết và nâng cấp mã</span>
              </div>

              {/* Score Interview */}
              <div className="grade-field">
                <div className="grade-field-label">
                  <label htmlFor="score-interview">3. Vấn Đáp Hiểu Code (5 - 10 phút)</label>
                  <span className="field-weight">Trọng số {TOURNAMENT_WEIGHTS.interview}%</span>
                </div>
                <div className="grade-input-wrap">
                  <input
                    id="score-interview"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="form-control grade-input"
                    value={scoreInterview}
                    onChange={(e) => setScoreInterview(e.target.value)}
                    required
                  />
                  <span className="unit-label">/ 100</span>
                </div>
                <span className="grade-hint">Giải thích thuật toán Heuristic / Minimax, thử đổi tham số hoặc sửa lỗi trực tiếp</span>
              </div>

              {/* Score Report */}
              <div className="grade-field">
                <div className="grade-field-label">
                  <label htmlFor="score-report">4. Ý Tưởng Chiến Thuật &amp; Heuristic (REPORT.md)</label>
                  <span className="field-weight">Trọng số {TOURNAMENT_WEIGHTS.report}%</span>
                </div>
                <div className="grade-input-wrap">
                  <input
                    id="score-report"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    className="form-control grade-input"
                    value={scoreReport}
                    onChange={(e) => setScoreReport(e.target.value)}
                    required
                  />
                  <span className="unit-label">/ 100</span>
                </div>
                <span className="grade-hint">Ý tưởng tiếp cận bài toán cờ 9×9, công thức heuristic lượng giá, khả năng xử lý ô cản và phân bổ thời gian</span>
              </div>

              {/* Notes */}
              <div className="grade-field">
                <label htmlFor="grade-notes" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Ghi chú nhận xét của Hội đồng / Giảng viên:
                </label>
                <textarea
                  id="grade-notes"
                  rows={3}
                  className="form-control"
                  style={{ width: '100%', resize: 'vertical' }}
                  placeholder="Ghi chú đánh giá điểm mạnh, phần phản biện, câu hỏi phỏng vấn..."
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
                    <span>Lưu Kết Quả Chấm</span>
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

export default GradeReviewModal;
