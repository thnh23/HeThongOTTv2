import React from 'react';
import { Link } from 'react-router-dom';
import {
  Zap,
  FolderArchive,
  ExternalLink,
  Laptop,
  UploadCloud,
  CheckCircle2,
  Download,
  RotateCcw,
  Trash2,
} from 'lucide-react';

export function Phase03Swiss({
  selectedSwissRound,
  setSelectedSwissRound,
  usersList,
  totalRoundMatches,
  avgMatchesPerChunk,
  swissStatus,
  resultsStatus,
  isPairingSwiss,
  isPublishingSwiss,
  isUploadingResult,
  onTriggerSwissPair,
  onTriggerSwissPublish,
  onDownloadAllChunksZip,
  onDownloadSingleChunk,
  onUploadResultFile,
  onResetRoundResults,
  onDeleteChunkResult,
}) {
  return (
    <section className="doppelrand-shell phase-container animate-fade-in">
      <div className="doppelrand-core phase-core">
        {/* Phase Header */}
        <div className="phase-header-bar">
          <div>
            <div className="phase-eyebrow">
              <span className="eyebrow-number">GIAI ĐOẠN 03</span>
              <span>ĐIỀU HÀNH VÒNG ĐẤU THỤY SĨ</span>
            </div>
            <h2 className="phase-title">Vòng Đấu Thụy Sĩ</h2>
            <p className="phase-subtitle">
              Bốc thăm ghép cặp theo nhóm điểm, điều phối máy chấm và xuất bản bảng xếp hạng theo từng vòng đấu.
            </p>
          </div>

          {/* Tournament Controls */}
          <div className="tournament-top-controls">
            <div className="round-picker-box">
              <span className="round-picker-label">Vòng Đấu:</span>
              <select
                className="round-select-pill"
                value={selectedSwissRound}
                onChange={(e) => setSelectedSwissRound(Number(e.target.value))}
                aria-label="Chọn vòng đấu Swiss"
              >
                {Array.from({ length: 13 }, (_, i) => i + 1).map((r) => (
                  <option key={r} value={r}>
                    Vòng {r}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn-island btn-island-secondary"
              onClick={onDownloadAllChunksZip}
              title="Tải trọn gói các file chunk kèm script chấm thi"
            >
              <span className="btn-island-text">Tải Gói Chunks (.ZIP)</span>
              <span className="btn-island-badge">
                <FolderArchive size={14} />
              </span>
            </button>

            <Link to="/leaderboard" className="btn-island btn-island-secondary">
              <span className="btn-island-text">Bảng Xếp Hạng</span>
              <span className="btn-island-badge">
                <ExternalLink size={14} />
              </span>
            </Link>
          </div>
        </div>

        {/* Swiss 3-Step Sequential Stepper Cards */}
        <div className="swiss-stepper-grid">
          {/* Step 3.1: Pair & Split Chunks */}
          <div className="doppelrand-shell step-card-shell">
            <div className="doppelrand-core step-card-core">
              <div className="step-card-header">
                <span className="step-badge">BƯỚC 3.1</span>
                <h3 className="step-card-title">Bốc Thăm &amp; Ghép Cặp</h3>
              </div>
              <p className="step-card-desc">
                Ghép cặp tự động theo nhóm điểm số và chia đều dữ liệu trận đấu cho các máy chấm.
              </p>
              <div className="step-card-action">
                <button
                  type="button"
                  className="btn-island btn-island-primary w-full"
                  onClick={onTriggerSwissPair}
                  disabled={isPairingSwiss || usersList.length < 2}
                  title={usersList.length < 2 ? 'Cần nạp ít nhất 2 thí sinh tại Bước 01' : ''}
                >
                  <span className="btn-island-text">
                    {isPairingSwiss ? 'Đang bốc thăm...' : `Bốc Thăm Vòng ${selectedSwissRound}`}
                  </span>
                  <span className="btn-island-badge">
                    <Zap size={14} className={isPairingSwiss ? 'animate-spin' : ''} />
                  </span>
                </button>
                {usersList.length < 2 && (
                  <span className="gated-warning-text">Chưa có dữ liệu thí sinh (cần nạp tại Giai đoạn 01)</span>
                )}
              </div>
            </div>
          </div>

          {/* Step 3.2: Distribute to Machines & Receive */}
          <div className="doppelrand-shell step-card-shell">
            <div className="doppelrand-core step-card-core">
              <div className="step-card-header">
                <span className="step-badge">BƯỚC 3.2</span>
                <h3 className="step-card-title">Phân Bổ &amp; Nhận Kết Quả</h3>
              </div>
              <p className="step-card-desc">
                Vận hành chấm thi phân tán trên các máy trạm và thu thập kết quả thi đấu.
              </p>
              <div className="step-status-meter">
                <span>Tiến độ nộp kết quả:</span>
                <strong>{resultsStatus?.ready_count || 0} / 4 máy hoàn tất</strong>
              </div>
              <div className="step-card-action">
                <label className="btn-island btn-island-secondary w-full file-upload-island">
                  <span className="btn-island-text">
                    {isUploadingResult ? 'Đang nạp file...' : 'Nộp Gói Kết Quả (.ZIP / .JSON)'}
                  </span>
                  <span className="btn-island-badge">
                    <UploadCloud size={14} className={isUploadingResult ? 'animate-spin' : ''} />
                  </span>
                  <input
                    type="file"
                    accept=".json,.zip"
                    style={{ display: 'none' }}
                    disabled={isUploadingResult}
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        onUploadResultFile(e.target.files[0]);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Step 3.3: Merge & Publish Standings */}
          <div className="doppelrand-shell step-card-shell">
            <div className="doppelrand-core step-card-core">
              <div className="step-card-header">
                <span className="step-badge">BƯỚC 3.3</span>
                <h3 className="step-card-title">Hợp Nhất &amp; Xuất Bản</h3>
              </div>
              <p className="step-card-desc">
                Tổng hợp kết quả, cập nhật hệ số phụ và công bố bảng xếp hạng mới nhất.
              </p>
              <div className="step-card-action">
                <button
                  type="button"
                  className="btn-island btn-island-accent w-full"
                  onClick={onTriggerSwissPublish}
                  disabled={isPublishingSwiss || (resultsStatus?.ready_count || 0) < 4}
                  title={
                    (resultsStatus?.ready_count || 0) < 4
                      ? 'Cần nộp đủ kết quả từ các máy chấm trước khi xuất bản'
                      : ''
                  }
                >
                  <span className="btn-island-text">
                    {isPublishingSwiss ? 'Đang xuất bản...' : `Xuất Bản Vòng ${selectedSwissRound}`}
                  </span>
                  <span className="btn-island-badge">
                    <CheckCircle2 size={14} className={isPublishingSwiss ? 'animate-spin' : ''} />
                  </span>
                </button>
                {(resultsStatus?.ready_count || 0) < 4 && (
                  <span className="gated-warning-text">
                    Chờ đủ kết quả ({resultsStatus?.ready_count || 0}/4 máy đã nộp)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Chunks Cluster Monitor Grid */}
        <div className="chunks-cluster-wrapper">
          <div className="chunks-cluster-header">
            <div className="cluster-header-title">
              <Laptop size={16} className="text-primary-accent" />
              <h4>Tiến Độ Cụm Máy Chấm (Vòng {selectedSwissRound})</h4>
            </div>
            <div className="cluster-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="cluster-stats-pill">
                Đã thu thập: <strong>{resultsStatus?.total_matches_done || 0} / {totalRoundMatches.toLocaleString('vi-VN')} trận đấu</strong>
              </span>
              {(resultsStatus?.ready_count || 0) > 0 && onResetRoundResults && (
                <button
                  type="button"
                  className="chunk-sub-btn"
                  onClick={onResetRoundResults}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                  title="Đặt lại toàn bộ các máy chấm về trạng thái Chờ nộp"
                >
                  <RotateCcw size={12} />
                  <span>Đặt Lại</span>
                </button>
              )}
            </div>
          </div>

          <div className="chunks-cluster-grid">
            {Array.from({ length: 4 }, (_, i) => i + 1).map((chunkId) => {
              const machine = resultsStatus?.machines?.find((m) => m.chunk_id === chunkId);
              const isReady = Boolean(machine?.is_ready);
              const expectedChunkMatches =
                Math.floor(totalRoundMatches / 4) + (chunkId <= (totalRoundMatches % 4) ? 1 : 0);
              const chunkMatches = machine?.matches_count || expectedChunkMatches;

              return (
                <div key={chunkId} className={`chunk-box ${isReady ? 'ready' : 'pending'}`}>
                  <div className="chunk-box-top">
                    <span className="chunk-id-label">MÁY #{String(chunkId).padStart(2, '0')}</span>
                    {isReady ? (
                      <span className="chunk-status-chip done">Hoàn tất ({chunkMatches} trận)</span>
                    ) : (
                      <span className="chunk-status-chip waiting">Chờ nộp</span>
                    )}
                  </div>

                  <div className="chunk-box-matches">{chunkMatches} Trận</div>
                  <div className="chunk-box-filename">chunk_{String(chunkId).padStart(2, '0')}.json</div>

                  <div className="chunk-box-actions">
                    <button
                      type="button"
                      className="chunk-sub-btn"
                      onClick={() => onDownloadSingleChunk(chunkId)}
                      title={`Tải file chunk_${chunkId}.json`}
                    >
                      <Download size={11} />
                      <span>Tải</span>
                    </button>

                    <label
                      htmlFor={`chunk-file-input-${chunkId}`}
                      className="chunk-sub-btn upload"
                      title={`Nộp kết quả máy #${chunkId}`}
                      style={{ cursor: 'pointer' }}
                    >
                      <UploadCloud size={11} />
                      <span>{isReady ? 'Nộp Lại' : 'Nộp KQ'}</span>
                    </label>
                    <input
                      id={`chunk-file-input-${chunkId}`}
                      type="file"
                      accept=".json"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          onUploadResultFile(e.target.files[0], chunkId);
                          e.target.value = '';
                        }
                      }}
                    />

                    {isReady && onDeleteChunkResult && (
                      <button
                        type="button"
                        className="chunk-sub-btn"
                        onClick={() => onDeleteChunkResult(chunkId)}
                        style={{ color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                        title={`Hủy kết quả Máy #${chunkId}`}
                      >
                        <Trash2 size={11} />
                        <span>Hủy</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default Phase03Swiss;
