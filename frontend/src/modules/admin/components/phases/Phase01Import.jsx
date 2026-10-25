import React from 'react';
import {
  Download,
  FileSpreadsheet,
  X,
  Clock,
  Shield,
  Layers,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export function Phase01Import({
  csvFile,
  setCsvFile,
  csvText,
  setCsvText,
  fileInputRef,
  deadlineInput,
  setDeadlineInput,
  pipelineStatus,
  isPipelineRunning,
  onStartPipeline,
  onExportReport,
  onNavigateToStudents,
  formatFileSize,
}) {
  return (
    <section className="minimal-phase-container animate-fade-in">
      {/* Header Bar */}
      <div className="minimal-phase-header">
        <div>
          <div className="minimal-eyebrow">
            <span className="eyebrow-tag">GIAI ĐOẠN 01</span>
            <span className="eyebrow-text">TIẾP NHẬN BÀI THI</span>
          </div>
          <h2 className="minimal-phase-title">Thu Thập &amp; Thẩm Định Bài Thi</h2>
          <p className="minimal-phase-subtitle">
            Nạp dữ liệu bài thi từ Google Form và kiểm thử mã nguồn tự động.
          </p>
        </div>

        <div className="minimal-header-actions">
          <button
            type="button"
            className="btn-minimal-secondary"
            onClick={onExportReport}
            title="Xuất file CSV báo cáo toàn bộ kết quả thẩm định để báo cáo Ban Tổ Chức"
          >
            <Download size={14} />
            <span>Xuất Báo Cáo Đối Soát (.CSV)</span>
          </button>
        </div>
      </div>

      {/* Bento Grid: 2 Columns */}
      <div className="minimal-import-grid">
        {/* Left Column: Data Source */}
        <div className="minimal-card bento-source-card">
          <div className="minimal-card-header">
            <div className="card-title-group">
              <span className="step-bullet">1</span>
              <div>
                <h3 className="card-heading">Nguồn Dữ Liệu Google Form</h3>
                <p className="card-caption">Tải lên tệp CSV hoặc dán nội dung từ biểu mẫu nộp bài.</p>
              </div>
            </div>
            <span className="minimal-tag tag-yellow">BẮT BUỘC</span>
          </div>

          {/* File Dropzone */}
          <div
            className={`minimal-dropzone ${csvFile ? 'has-file' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              style={{ display: 'none' }}
              onChange={(e) => {
                if (e.target.files?.[0]) setCsvFile(e.target.files[0]);
              }}
            />

            {!csvFile ? (
              <div className="dropzone-idle">
                <div className="dropzone-icon">
                  <FileSpreadsheet size={22} />
                </div>
                <div className="dropzone-text-group">
                  <span className="dropzone-primary-text">Kéo thả tệp CSV vào đây, hoặc nhấp để chọn tệp</span>
                  <span className="dropzone-secondary-text">
                    Định dạng hỗ trợ: <code>.csv</code> hoặc <code>.txt</code> (mã hóa chuẩn UTF-8)
                  </span>
                </div>
              </div>
            ) : (
              <div className="dropzone-file-selected">
                <div className="file-info-group">
                  <FileSpreadsheet size={20} className="file-icon" />
                  <div>
                    <div className="selected-file-name">{csvFile.name}</div>
                    <div className="selected-file-size">{formatFileSize(csvFile.size)}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-file-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCsvFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  title="Hủy chọn tệp này"
                >
                  <X size={14} />
                  <span>Bỏ chọn</span>
                </button>
              </div>
            )}
          </div>

          {/* Text Area Alternative */}
          <div className="minimal-raw-input-wrap">
            <label htmlFor="csv-raw-textarea" className="raw-input-label">
              <span>Hoặc dán nội dung văn bản CSV trực tiếp:</span>
            </label>
            <textarea
              id="csv-raw-textarea"
              rows={4}
              className="minimal-textarea"
              placeholder="Dấu thời gian,Email,Họ và tên,MSSV,Lớp,Link GitHub Repo,Tên Bot..."
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
            />
          </div>
        </div>

        {/* Right Column: Ingestion Strategy & Deadline */}
        <div className="minimal-card bento-strategy-card">
          <div className="minimal-card-header">
            <div className="card-title-group">
              <span className="step-bullet">2</span>
              <div>
                <h3 className="card-heading">Thời Hạn &amp; Khóa Mã Nguồn</h3>
                <p className="card-caption">Thiết lập mốc thời gian chốt commit của thí sinh.</p>
              </div>
            </div>
            <span className="minimal-tag tag-blue">TIÊU CHUẨN</span>
          </div>

          <div className="deadline-config-row">
            <label htmlFor="pipeline-deadline-input" className="deadline-input-label">
              <Clock size={15} />
              <span>Thời điểm chốt bài nộp:</span>
            </label>
            <input
              id="pipeline-deadline-input"
              type="datetime-local"
              className="minimal-datetime-input"
              value={deadlineInput}
              onChange={(e) => setDeadlineInput(e.target.value)}
            />
            <span className="deadline-helper-text">
              Hệ thống tự động khóa và lấy phiên bản commit trước thời điểm này.
            </span>
          </div>

          <div className="pipeline-steps-review">
            <div className="pipeline-step-item">
              <div className="step-icon-dot">
                <Shield size={13} />
              </div>
              <div className="step-info">
                <strong>Khử Trùng Lặp &amp; Lưu Bản Mới Nhất</strong>
                <span>Tự động lọc và giữ lại bản nộp sau cùng theo từng MSSV</span>
              </div>
            </div>

            <div className="pipeline-step-item">
              <div className="step-icon-dot">
                <Layers size={13} />
              </div>
              <div className="step-info">
                <strong>Tải Mã Nguồn Repository</strong>
                <span>Kéo mã nguồn, kiểm tra file bot.py và đóng gói báo cáo</span>
              </div>
            </div>

            <div className="pipeline-step-item">
              <div className="step-icon-dot">
                <Shield size={13} />
              </div>
              <div className="step-info">
                <strong>Kiểm Thử Hợp Lệ</strong>
                <span>Chạy thử bot với các thế cờ mẫu để phát hiện lỗi cú pháp</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="btn-minimal-primary hero-pipeline-cta"
            onClick={onStartPipeline}
            disabled={isPipelineRunning}
          >
            <div className="btn-content-wrap">
              <span className="btn-title">
                {isPipelineRunning ? 'Đang thẩm định bài thi...' : 'Bắt Đầu Thẩm Định Bài Thi'}
              </span>
            </div>
            {isPipelineRunning ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <ArrowRight size={16} />
            )}
          </button>
        </div>
      </div>

      {/* Live Progress Monitor Card */}
      {pipelineStatus && pipelineStatus.status !== 'idle' && (
        <div className="minimal-card minimal-monitor-card animate-fade-in">
          <div className="minimal-monitor-header">
            <div className="monitor-title-wrap">
              <RefreshCw
                size={15}
                className={pipelineStatus.status === 'running' ? 'animate-spin text-accent' : ''}
              />
              <strong>Tiến Trình Pipeline Thẩm Định Bất Đồng Bộ</strong>
            </div>
            <span className={`minimal-status-pill pill-${pipelineStatus.status}`}>
              {pipelineStatus.status === 'running'
                ? 'ĐANG THỰC THI BẤT ĐỒNG BỘ'
                : pipelineStatus.status === 'completed'
                ? 'ĐÃ HOÀN TẤT THẨM ĐỊNH'
                : 'CẢNH BÁO LỖI'}
            </span>
          </div>

          <div className="minimal-progress-track">
            <div
              className={`minimal-progress-fill ${pipelineStatus.status === 'completed' ? 'fill-completed' : ''}`}
              style={{ width: `${pipelineStatus.percentage || 0}%` }}
            />
          </div>

          <div className="minimal-monitor-bento">
            <div className="monitor-bento-cell">
              <span className="bento-cell-label">Tổng số bản ghi</span>
              <span className="bento-cell-value">{pipelineStatus.total || 0}</span>
            </div>
            <div className="monitor-bento-cell">
              <span className="bento-cell-label">Đã xử lý</span>
              <span className="bento-cell-value">
                {pipelineStatus.processed || 0} <span className="value-pct">({pipelineStatus.percentage || 0}%)</span>
              </span>
            </div>
            <div className="monitor-bento-cell cell-valid">
              <span className="bento-cell-label">Thẩm định hợp lệ</span>
              <span className="bento-cell-value text-green">{pipelineStatus.valid_count || 0}</span>
            </div>
            <div className="monitor-bento-cell cell-invalid">
              <span className="bento-cell-label">Lỗi kiểm tra / vi phạm</span>
              <span className="bento-cell-value text-red">{pipelineStatus.invalid_count || 0}</span>
            </div>
          </div>

          {pipelineStatus.current_student && (
            <div className="minimal-current-student">
              <span className="ticker-label">Đang thẩm định sinh viên:</span>
              <code className="ticker-code">{pipelineStatus.current_student}</code>
            </div>
          )}

          {pipelineStatus.status === 'completed' && (
            <div className="minimal-monitor-action">
              <button
                type="button"
                className="btn-minimal-secondary"
                onClick={onNavigateToStudents}
              >
                <span>Chuyển Sang Bước 02: Quản Lý Danh Sách Thí Sinh</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default Phase01Import;
