import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  Trophy,
  RotateCcw,
  Search,
  CheckCircle2,
  RefreshCw,
  Award,
  Laptop,
  Check,
  Zap,
  ExternalLink,
  Download,
  Edit2,
  GitBranch,
  Bot,
  UploadCloud,
  FolderArchive,
  Shield,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useToast } from '@/shared/context/ToastContext.jsx';
import { GradeReviewModal } from '../../components/GradeReviewModal/GradeReviewModal.jsx';
import { EditUserModal } from '../../components/EditUserModal/index.js';
import './AdminDashboardPage.css';


export function AdminDashboardPage() {
  const { showToast } = useToast();

  // Active Admin Tab: 'tournament' | 'import' | 'students' | 'top32'
  const [activeAdminTab, setActiveAdminTab] = useState('tournament');

  const [swissStatus, setSwissStatus] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [submissionFilter, setSubmissionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Tournament Controller: Swiss 13 Vòng
  const [selectedSwissRound, setSelectedSwissRound] = useState(1);
  const [isPairingSwiss, setIsPairingSwiss] = useState(false);
  const [isPublishingSwiss, setIsPublishingSwiss] = useState(false);
  const [isSyncingData, setIsSyncingData] = useState(false);

  // Chunks & Machine Results State
  const [resultsStatus, setResultsStatus] = useState(null);
  const [isUploadingResult, setIsUploadingResult] = useState(false);

  // Google Form Import State
  const [csvFile, setCsvFile] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  // Pipeline Ingestion & Time Freeze State
  const [deadlineInput, setDeadlineInput] = useState('');
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);

  // Polling pipeline status when on import tab
  useEffect(() => {
    let timer = null;
    if (activeAdminTab === 'import') {
      const checkStatus = async () => {
        try {
          const st = await apiClient.get('/admin/pipeline/status');
          setPipelineStatus(st);
          if (st.status === 'running') {
            setIsPipelineRunning(true);
          } else {
            setIsPipelineRunning(false);
          }
        } catch {
          // ignore
        }
      };

      checkStatus();
      timer = setInterval(checkStatus, 2500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeAdminTab, isPipelineRunning]);

  const handleStartPipeline = async () => {
    if (!csvFile && !csvText.trim()) {
      showToast('Vui lòng chọn file CSV hoặc dán nội dung CSV từ Google Form!', 'error');
      return;
    }

    try {
      const formData = new FormData();
      if (csvFile) formData.append('file', csvFile);
      if (csvText.trim()) formData.append('csv_text', csvText.trim());
      if (deadlineInput) formData.append('deadline', deadlineInput);

      showToast('Đang khởi động Pipeline: Khử trùng lặp, Clone song song & Khóa commit...', 'info');
      const res = await apiClient.post('/admin/pipeline/start', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setIsPipelineRunning(true);
      showToast(res.message || 'Pipeline đang chạy bất đồng bộ trong nền!', 'success');
    } catch (err) {
      showToast(err.message || 'Lỗi khi khởi động Pipeline', 'error');
    }
  };

  const handleExportValidationReport = () => {
    window.open('/api/admin/pipeline/export-report', '_blank');
  };

  // Top 32 Obstacles Config State
  const [top32Obstacles, setTop32Obstacles] = useState(['d4', 'd6', 'f4', 'f6', 'e5']);
  const [top32Announcement, setTop32Announcement] = useState('');
  const [top32Seeds, setTop32Seeds] = useState([]);
  const [isSavingObstacles, setIsSavingObstacles] = useState(false);
  const [isBenchmarkOpen, setIsBenchmarkOpen] = useState(false);

  // Modals state
  const [selectedUserForReview, setSelectedUserForReview] = useState(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);


  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [swissRes, usersRes] = await Promise.all([
        apiClient.get('/admin/swiss/status').catch(() => null),
        apiClient.get('/admin/users').catch(() => []),
      ]);
      setSwissStatus(swissRes);
      setUsersList(usersRes || []);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const fetchChunksAndResults = async (roundNum) => {
    try {
      const resultsRes = await apiClient.get(`/admin/swiss/results-status/${roundNum}`).catch(() => null);
      if (resultsRes) setResultsStatus(resultsRes);
    } catch {
      // ignore
    }
  };

  const fetchTop32Config = async () => {
    try {
      const res = await apiClient.get('/admin/top32/config');
      if (res?.obstacles) setTop32Obstacles(res.obstacles);
      if (res?.rules_announcement) setTop32Announcement(res.rules_announcement);
      if (res?.seeds) setTop32Seeds(res.seeds);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (activeAdminTab === 'tournament') {
      fetchChunksAndResults(selectedSwissRound);
    } else if (activeAdminTab === 'top32') {
      fetchTop32Config();
    }
  }, [activeAdminTab, selectedSwissRound]);

  // Filter students list by search and submission status
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchSubmission =
        !submissionFilter ||
        (submissionFilter === 'submitted' ? u.has_submission : !u.has_submission);
      const query = searchQuery.toLowerCase().trim();
      const matchSearch =
        !query ||
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.student_id?.toLowerCase().includes(query) ||
        u.bot_name?.toLowerCase().includes(query) ||
        u.class_name?.toLowerCase().includes(query);
      return matchSubmission && matchSearch;
    });
  }, [usersList, submissionFilter, searchQuery]);

  // 1. Handle Swiss Pairing
  const handleTriggerSwissPair = async () => {
    setIsPairingSwiss(true);
    try {
      showToast(`Đang bốc thăm ghép cặp Vòng ${selectedSwissRound} (2.000 SV) và cắt 10 Chunks...`, 'info');
      const res = await apiClient.post('/admin/swiss/pair', {
        round_num: Number(selectedSwissRound),
        num_chunks: 10,
        player_count: 2000,
      });
      showToast(res.message || `Đã ghép cặp thành công Vòng ${selectedSwissRound}!`, 'success');
      fetchDashboardData();
      fetchChunksAndResults(selectedSwissRound);
    } catch (err) {
      showToast(err.message || 'Lỗi khi ghép cặp Swiss', 'error');
    } finally {
      setIsPairingSwiss(false);
    }
  };

  // 2. Handle Swiss Publish
  const handleTriggerSwissPublish = async () => {
    setIsPublishingSwiss(true);
    try {
      showToast(`Đang hợp nhất kết quả Vòng ${selectedSwissRound}, tính Buchholz / SB và xuất bản...`, 'info');
      const res = await apiClient.post('/admin/swiss/publish', {
        round_num: Number(selectedSwissRound),
      });
      showToast(res.message || `Xuất bản bảng xếp hạng Vòng ${selectedSwissRound} thành công!`, 'success');
      fetchDashboardData();
      fetchChunksAndResults(selectedSwissRound);
    } catch (err) {
      showToast(err.message || 'Lỗi khi xuất bản kết quả Swiss', 'error');
    } finally {
      setIsPublishingSwiss(false);
    }
  };

  // 3. Download All Chunks ZIP
  const handleDownloadAllChunksZip = () => {
    window.open(`/api/admin/swiss/chunks/${selectedSwissRound}/download-zip`, '_blank');
    showToast(`Đang tải file ZIP 10 chunks Vòng ${selectedSwissRound}...`, 'info');
  };

  // 4. Download Single Chunk
  const handleDownloadSingleChunk = (chunkId) => {
    window.open(`/api/admin/swiss/chunks/${selectedSwissRound}/${chunkId}/download`, '_blank');
  };

  // 5. Handle Upload Machine Result File (JSON or ZIP)
  const handleUploadResultFile = async (file) => {
    if (!file) return;
    setIsUploadingResult(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('round_num', selectedSwissRound);

      const res = await apiClient.post('/admin/swiss/upload-result', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      showToast(res.message || 'Tiếp nhận file kết quả thành công!', 'success');
      fetchChunksAndResults(selectedSwissRound);
      fetchDashboardData();
    } catch (err) {
      showToast(err.message || 'Lỗi khi nộp file kết quả', 'error');
    } finally {
      setIsUploadingResult(false);
    }
  };

  // 6. Handle Google Form CSV Import
  const handleImportGoogleForm = async (e) => {
    e.preventDefault();
    if (!csvFile && !csvText.trim()) {
      showToast('Vui lòng chọn file CSV hoặc dán nội dung CSV từ Google Form!', 'error');
      return;
    }

    setIsImporting(true);
    try {
      const formData = new FormData();
      if (csvFile) {
        formData.append('file', csvFile);
      }
      if (csvText.trim()) {
        formData.append('csv_text', csvText.trim());
      }

      showToast('Đang phân tích dữ liệu Google Form và nạp thí sinh...', 'info');
      const res = await apiClient.post('/admin/import/google-form', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setImportResult(res);
      showToast(res.message || 'Nạp danh sách thí sinh từ Google Form thành công!', 'success');
      fetchDashboardData();
    } catch (err) {
      showToast(err.message || 'Lỗi khi nhập dữ liệu từ Google Form', 'error');
    } finally {
      setIsImporting(false);
    }
  };

  // 7. Toggle Top 32 Obstacle Cell
  const toggleObstacleCell = (sq) => {
    const cleanSq = sq.toLowerCase().trim();
    if (top32Obstacles.includes(cleanSq)) {
      setTop32Obstacles(top32Obstacles.filter((o) => o !== cleanSq));
    } else {
      setTop32Obstacles([...top32Obstacles, cleanSq]);
    }
  };

  // 8. Save Top 32 Obstacles
  const handleSaveTop32Config = async () => {
    setIsSavingObstacles(true);
    try {
      const res = await apiClient.post('/admin/top32/config', {
        obstacles: top32Obstacles,
        rules_announcement: top32Announcement,
      });
      showToast(res.message || 'Đã lưu cấu hình ô chướng ngại vật Top 32!', 'success');
    } catch (err) {
      showToast(err.message || 'Lỗi khi lưu cấu hình Top 32', 'error');
    } finally {
      setIsSavingObstacles(false);
    }
  };

  // 9. Sync demo data
  const handleSyncSeedData = async () => {
    if (!window.confirm('Bạn có muốn đồng bộ lại toàn bộ dữ liệu bài nộp mẫu cho các thí sinh vào cơ sở dữ liệu hiện tại?')) {
      return;
    }
    setIsSyncingData(true);
    try {
      showToast('Đang đồng bộ dữ liệu bài nộp mẫu lên cơ sở dữ liệu...', 'info');
      const res = await apiClient.post('/admin/seed-data');
      showToast(res.message || 'Đồng bộ bài nộp mẫu thành công!', 'success');
      fetchDashboardData();
    } catch (err) {
      showToast(err.message || 'Lỗi khi đồng bộ dữ liệu bài nộp', 'error');
    } finally {
      setIsSyncingData(false);
    }
  };

  return (
    <div className="admin-page animate-fade-in">
      {/* Admin Header */}
      <div className="admin-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="admin-badge-icon">
              <ShieldCheck size={22} color="var(--primary-700)" />
            </div>
            <h1 className="admin-title">
              Bảng Điều Khiển <span className="gradient-text">Ban Tổ Chức (Admin)</span>
            </h1>
          </div>
          <p className="admin-subtitle">
            Hội đồng Chấm thi • Điều hành Giải đấu Thụy Sĩ (Swiss 13 Vòng) • Quản lý Cụm 10 Máy Chấm Phân Tán
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleSyncSeedData}
            disabled={isSyncingData}
            title="Đồng bộ lại dữ liệu thí sinh mẫu"
          >
            <RotateCcw size={14} className={isSyncingData ? 'animate-spin' : ''} />
            <span>Nạp Dữ Liệu Mẫu</span>
          </button>
          <button
            id="btn-admin-refresh"
            className="btn btn-outline btn-sm"
            onClick={() => {
              fetchDashboardData();
              if (activeAdminTab === 'tournament') fetchChunksAndResults(selectedSwissRound);
            }}
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="admin-stats-grid">
        <div className="glass-card stat-metric-card">
          <div className="stat-metric-header">
            <span className="stat-metric-title">Tổng Thí Sinh</span>
            <Users size={18} color="var(--primary-600)" />
          </div>
          <div className="stat-metric-value">{usersList.length || 2000}</div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Toàn bộ sinh viên Khoa CNTT - UET
          </span>
        </div>

        <div className="glass-card stat-metric-card">
          <div className="stat-metric-header">
            <span className="stat-metric-title">Thể Thức Thi Đấu</span>
            <Trophy size={18} color="var(--amber-600)" />
          </div>
          <div className="stat-metric-value">13 Vòng</div>
          <span style={{ fontSize: '0.8rem', color: 'var(--primary-700)', fontWeight: 600 }}>
            Hệ Thống Thụy Sĩ (Swiss System)
          </span>
        </div>

        <div className="glass-card stat-metric-card">
          <div className="stat-metric-header">
            <span className="stat-metric-title">Cụm Máy Chấm</span>
            <Laptop size={18} color="var(--emerald-600)" />
          </div>
          <div className="stat-metric-value">10 Máy</div>
          <span style={{ fontSize: '0.8rem', color: 'var(--emerald-700)', fontWeight: 600 }}>
            100 trận/chunk • Chấm phân tán 0đ
          </span>
        </div>

        <div className="glass-card stat-metric-card">
          <div className="stat-metric-header">
            <span className="stat-metric-title">Vòng Chung Kết</span>
            <Award size={18} color="var(--primary-600)" />
          </div>
          <div className="stat-metric-value">Top 32</div>
          <span style={{ fontSize: '0.8rem', color: 'var(--amber-700)', fontWeight: 600 }}>
            Knockout &amp; Ô chướng ngại vật
          </span>
        </div>
      </div>

      {/* 4 MAIN ADMIN NAVIGATION TABS */}
      <div className="admin-main-tabs-bar">
        <button
          type="button"
          className={`admin-main-tab-item ${activeAdminTab === 'tournament' ? 'active' : ''}`}
          onClick={() => setActiveAdminTab('tournament')}
        >
          <Zap size={16} />
          <span>Điều Hành Giải Đấu (Swiss &amp; 10 Máy Chấm)</span>
          <span className="admin-tab-count-badge">Vòng {selectedSwissRound}</span>
        </button>

        <button
          type="button"
          className={`admin-main-tab-item ${activeAdminTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveAdminTab('import')}
        >
          <FileSpreadsheet size={16} />
          <span>Thu Thập Google Form &amp; Repositories</span>
          <span className="admin-tab-count-badge">CSV</span>
        </button>

        <button
          type="button"
          className={`admin-main-tab-item ${activeAdminTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveAdminTab('students')}
        >
          <Users size={16} />
          <span>Quản Lý Thí Sinh &amp; Chấm Điểm</span>
          <span className="admin-tab-count-badge">{usersList.length} SV</span>
        </button>

        <button
          type="button"
          className={`admin-main-tab-item ${activeAdminTab === 'top32' ? 'active' : ''}`}
          onClick={() => setActiveAdminTab('top32')}
        >
          <Award size={16} />
          <span>Vòng Chung Kết Top 32 &amp; Ô Chướng Ngại Vật</span>
          <span className="admin-tab-count-badge">{top32Obstacles.length} Ô Cản</span>
        </button>
      </div>

      {/* TAB 1: TOURNAMENT & SWISS 10 CHUNKS OPERATIONS */}
      {activeAdminTab === 'tournament' && (
        <div className="glass-card tournament-hub-card" style={{ marginBottom: '2.5rem' }}>
          <div className="hub-header">
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <span className="swiss-hub-badge">SWISS ENGINE CONTROLLER</span>
                <span className="round-badge">VÒNG {selectedSwissRound} / 13</span>
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Điều Hành Giải Đấu Thụy Sĩ (Swiss System)
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem', margin: 0 }}>
                Tự động bốc thăm theo điểm số, cắt nhỏ 1.000 trận thành 10 file chunk cho 10 máy chấm sinh viên và hợp nhất xuất bản bảng xếp hạng Jamstack.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Chọn Vòng:</span>
                <select
                  className="swiss-round-select"
                  value={selectedSwissRound}
                  onChange={(e) => setSelectedSwissRound(Number(e.target.value))}
                  aria-label="Chọn vòng đấu Swiss"
                >
                  {Array.from({ length: 13 }, (_, i) => i + 1).map((r) => (
                    <option key={r} value={r}>Vòng {r}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleDownloadAllChunksZip}
                title="Tải trọn gói 10 file chunk kèm script chấm thi"
              >
                <FolderArchive size={14} color="var(--primary-600)" />
                <span>Tải Gói 10 Chunks (.ZIP)</span>
              </button>

              <Link to="/leaderboard" className="btn btn-outline btn-sm">
                <ExternalLink size={14} />
                <span>Xem Bảng Xếp Hạng</span>
              </Link>
            </div>
          </div>

          {/* Swiss 3-Step Action Workflow */}
          <div className="swiss-actions-row">
            {/* Step 1: Pair */}
            <div className="swiss-step-box">
              <div className="step-box-header">
                <span className="step-number">BƯỚC 1</span>
                <h4>Ghép Cặp &amp; Cắt Chunk</h4>
              </div>
              <p className="step-desc">
                Ghép 1.000 trận theo nhóm điểm, tránh đối thủ cũ và chia đều thành 10 file chunk (chunk_01 .. chunk_10).
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleTriggerSwissPair}
                disabled={isPairingSwiss}
              >
                <Zap size={14} className={isPairingSwiss ? 'animate-spin' : ''} />
                <span>{isPairingSwiss ? 'Đang ghép cặp...' : `Bốc Thăm Vòng ${selectedSwissRound}`}</span>
              </button>
            </div>

            {/* Step 2: Distribute & Monitor */}
            <div className="swiss-step-box">
              <div className="step-box-header">
                <span className="step-number">BƯỚC 2</span>
                <h4>Phân Bổ &amp; Nhận Kết Quả</h4>
              </div>
              <p className="step-desc">
                10 máy chấm chạy <code>run_batch.py</code> độc lập qua Sandbox (mỗi máy 100 trận, ~2-3 phút xong).
              </p>
              <div className="chunk-progress-summary">
                <span>Tiến độ nộp kết quả:</span>
                <strong>{resultsStatus?.ready_count || 0} / 10 Máy Chấm</strong>
              </div>
              <label
                className="btn btn-outline btn-sm"
                style={{ width: '100%', justifyContent: 'center', cursor: 'pointer' }}
              >
                <UploadCloud size={14} />
                <span>{isUploadingResult ? 'Đang xử lý...' : 'Nộp Gói Kết Quả (File/ZIP)'}</span>
                <input
                  type="file"
                  accept=".json,.zip"
                  style={{ display: 'none' }}
                  disabled={isUploadingResult}
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleUploadResultFile(e.target.files[0]);
                  }}
                />
              </label>
            </div>

            {/* Step 3: Merge & Publish */}
            <div className="swiss-step-box">
              <div className="step-box-header">
                <span className="step-number">BƯỚC 3</span>
                <h4>Hợp Nhất &amp; Xuất Bản</h4>
              </div>
              <p className="step-desc">
                Cập nhật điểm Match Points (3-1-0), tính hệ số Buchholz / SB, chốt Top 32 và xuất file JSON tĩnh.
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleTriggerSwissPublish}
                disabled={isPublishingSwiss}
              >
                <CheckCircle2 size={14} className={isPublishingSwiss ? 'animate-spin' : ''} />
                <span>{isPublishingSwiss ? 'Đang xuất bản...' : `Hợp Nhất & Xuất Bản Vòng ${selectedSwissRound}`}</span>
              </button>
            </div>
          </div>

          {/* 10 Chunks Cluster Monitor Grid with Actions */}
          <div className="chunks-monitor-wrap">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Laptop size={16} color="var(--primary-700)" />
                <span>Trạng Thái Cụm 10 Máy Chấm Phân Tán (Vòng {selectedSwissRound})</span>
              </h4>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Đã nhận kết quả: <strong>{resultsStatus?.total_matches_done || 0} / 1.000 trận đấu</strong>
              </span>
            </div>

            <div className="chunks-grid">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((chunkId) => {
                const machine = resultsStatus?.machines?.find((m) => m.chunk_id === chunkId);
                const isReady = machine?.is_ready || (swissStatus?.results_ready || 0) >= chunkId;

                return (
                  <div key={chunkId} className={`chunk-card ${isReady ? 'chunk-done' : 'chunk-pending'}`}>
                    <div className="chunk-card-header">
                      <span className="chunk-id-tag">MÁY #{String(chunkId).padStart(2, '0')}</span>
                      {isReady ? (
                        <span className="chunk-status-pill done">✓ Xong ({machine?.matches_count || 100} trận)</span>
                      ) : (
                        <span className="chunk-status-pill waiting">Chờ nộp</span>
                      )}
                    </div>
                    <div className="chunk-matches-num">100 Trận</div>
                    <div className="chunk-file-name">chunk_{String(chunkId).padStart(2, '0')}.json</div>

                    {/* Machine Actions: Download chunk & Upload result */}
                    <div className="chunk-actions-row">
                      <button
                        type="button"
                        className="btn btn-outline btn-xs"
                        style={{ fontSize: '0.72rem', padding: '0.2rem 0.45rem' }}
                        onClick={() => handleDownloadSingleChunk(chunkId)}
                        title={`Tải file chunk_${chunkId}.json`}
                      >
                        <Download size={11} />
                        <span>Tải Chunk</span>
                      </button>

                      <label
                        className="chunk-upload-label-btn"
                        title={`Tải file result_${chunkId}.json cho Máy #${chunkId}`}
                      >
                        <UploadCloud size={11} />
                        <span>{isReady ? 'Nộp Lại' : 'Nộp KQ'}</span>
                        <input
                          type="file"
                          accept=".json"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            if (e.target.files?.[0]) handleUploadResultFile(e.target.files[0], chunkId);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: GOOGLE FORM IMPORT & REPOSITORIES */}
      {activeAdminTab === 'import' && (
        <div className="google-import-card animate-fade-in">
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
              <span className="swiss-hub-badge">TRỤ CỘT 1: THU THẬP BÀI THI</span>
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Nhập Danh Sách Bài Thi Từ Google Form
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Xuất file CSV từ Google Form (thu link GitHub Repository và Mã Sinh Viên) rồi tải lên hoặc dán trực tiếp bên dưới. Hệ thống sẽ tự động đối soát và cập nhật vào danh sách thí sinh.
            </p>
          </div>

          <form onSubmit={handleImportGoogleForm}>
            <div
              className={`import-dropzone ${csvFile ? 'drag-active' : ''}`}
              onClick={() => fileInputRef.current?.click()}
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
              <div className="import-icon-wrap">
                <FileSpreadsheet size={28} />
              </div>
              <div>
                <strong>{csvFile ? csvFile.name : 'Nhấp hoặc kéo thả file CSV từ Google Form vào đây'}</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                  Hỗ trợ định dạng: <code>.csv</code> (UTF-8). Tự động nhận diện các cột MSSV, Họ tên, Email, Link GitHub.
                </p>
              </div>
            </div>

            <div style={{ marginTop: '1.25rem' }}>
              <label htmlFor="csv-raw-textarea" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                Hoặc dán trực tiếp nội dung CSV vào ô dưới đây:
              </label>
              <textarea
                id="csv-raw-textarea"
                rows={4}
                className="form-control"
                style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                placeholder={`Dấu thời gian,Địa chỉ email,Họ và tên,Mã sinh viên,Lớp,Link GitHub Repository,Tên Bot\n2026/10/20 8:30:15 CH,21020001@vnu.edu.vn,Nguyễn Văn An,21020001,QH-2022-I/CQ-CLC1,https://github.com/annguyen/ottv2-bot,AlphaBot`}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
              />
            </div>

            <div style={{ marginTop: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              <div>
                <label htmlFor="pipeline-deadline-input" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                  ⏰ Hạn Chót Nộp Bài (Deadline Freeze):
                </label>
                <input
                  id="pipeline-deadline-input"
                  type="datetime-local"
                  className="form-control"
                  style={{ fontSize: '0.85rem' }}
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.25rem' }}>
                  Hệ thống tự động lọc bản nộp cuối trước giờ này và <code>git checkout</code> commit hợp lệ trước deadline.
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={handleExportValidationReport}
                  title="Xuất danh sách thí sinh, mã commit chốt và tình trạng hợp lệ ra file CSV"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                >
                  <Download size={15} />
                  <span>Xuất Báo Cáo Đối Soát (.CSV)</span>
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleStartPipeline}
                disabled={isPipelineRunning}
                style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)', border: 'none' }}
              >
                <Zap size={16} className={isPipelineRunning ? 'animate-spin' : ''} />
                <span>{isPipelineRunning ? 'Pipeline Đang Chạy Nền...' : '⚡ Khởi Động Pipeline Toàn Diện (Clone & Freeze)'}</span>
              </button>

              <button
                type="submit"
                className="btn btn-outline"
                disabled={isImporting || isPipelineRunning}
              >
                <CheckCircle2 size={16} className={isImporting ? 'animate-spin' : ''} />
                <span>{isImporting ? 'Đang Nạp...' : 'Nạp Nhanh Vào CSDL (Sync)'}</span>
              </button>
            </div>
          </form>

          {/* Pipeline Live Progress Box */}
          {pipelineStatus && pipelineStatus.status !== 'idle' && (
            <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid var(--border-subtle)', borderRadius: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <RefreshCw size={16} className={pipelineStatus.status === 'running' ? 'animate-spin' : ''} color="var(--primary-400)" />
                  <strong>Tiến Trình Pipeline Thẩm Định Hàng Loạt</strong>
                </div>
                <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.6rem', borderRadius: '999px', background: pipelineStatus.status === 'completed' ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.15)', color: pipelineStatus.status === 'completed' ? '#10b981' : '#818cf8', fontWeight: 600 }}>
                  {pipelineStatus.status === 'running' ? 'ĐANG CHẠY BẤT ĐỒNG BỘ' : pipelineStatus.status === 'completed' ? 'ĐÃ HOÀN THÀNH' : 'THẤT BẠI'}
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden', margin: '0.75rem 0' }}>
                <div style={{ width: `${pipelineStatus.percentage || 0}%`, height: '100%', background: 'linear-gradient(90deg, #4f46e5, #06b6d4)', transition: 'width 0.3s ease' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <span>Đã xử lý: <strong>{pipelineStatus.processed} / {pipelineStatus.total}</strong> ({pipelineStatus.percentage}%)</span>
                <span>Hợp lệ: <strong style={{ color: '#10b981' }}>{pipelineStatus.valid_count}</strong> • Lỗi: <strong style={{ color: '#ef4444' }}>{pipelineStatus.invalid_count}</strong></span>
              </div>

              {pipelineStatus.current_student && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Đang xử lý sinh viên: <code>{pipelineStatus.current_student}</code>
                </div>
              )}
            </div>
          )}

          {/* Import Preview Table */}
          {importResult && (
            <div className="import-preview-table-wrap">
              <div style={{ padding: '0.85rem 1.25rem', background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--emerald-600)' }}>
                  ✓ {importResult.message}
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Xem trước {importResult.preview?.length || 0} bản ghi đầu tiên
                </span>
              </div>
              <div className="table-responsive" style={{ margin: 0, maxHeight: '320px', overflowY: 'auto' }}>
                <table className="styled-table">
                  <thead>
                    <tr>
                      <th>MSSV</th>
                      <th>Họ và Tên</th>
                      <th>Email VNU</th>
                      <th>Lớp</th>
                      <th>Tên Bot</th>
                      <th>GitHub Repository</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.preview?.map((p, idx) => (
                      <tr key={idx}>
                        <td><code>{p.student_id || '—'}</code></td>
                        <td><strong>{p.name}</strong></td>
                        <td>{p.email}</td>
                        <td>{p.class_name}</td>
                        <td><span className="bot-name-chip">{p.bot_name}</span></td>
                        <td>
                          {p.github_repo_url ? (
                            <a href={p.github_repo_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-600)', fontSize: '0.78rem' }}>
                              {p.github_repo_url}
                            </a>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: STUDENTS LIST & GRADING REVIEW TABLE */}
      {activeAdminTab === 'students' && (
        <div className="glass-card animate-fade-in" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="students-table-toolbar">
            <div>
              <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800 }}>Danh Sách Thí Sinh &amp; Chấm Thi</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Hiển thị {filteredUsers.length} / {usersList.length} thí sinh
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div className="admin-search-wrap">
                <Search size={15} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo MSSV, tên, email, lớp..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="admin-search-input"
                />
              </div>

              <select
                className="admin-filter-select"
                value={submissionFilter}
                onChange={(e) => setSubmissionFilter(e.target.value)}
                aria-label="Lọc theo trạng thái nộp bot"
              >
                <option value="">Tất Cả Thí Sinh</option>
                <option value="submitted">Đã Nộp Bot (Hợp Lệ)</option>
                <option value="pending">Chưa Nộp Bot</option>
              </select>
            </div>
          </div>

          <div className="table-responsive" style={{ margin: 0 }}>
            <table className="styled-table" aria-label="Bảng quản lý thí sinh">
              <thead>
                <tr>
                  <th>Thí Sinh / MSSV / Lớp</th>
                  <th>Bot &amp; GitHub</th>
                  <th style={{ textAlign: 'center' }}>Bài Nộp</th>
                  <th style={{ textAlign: 'center' }}>Swiss 13 Vòng</th>
                  <th style={{ textAlign: 'center' }}>Điểm HP Đề Xuất</th>
                  <th style={{ textAlign: 'center' }}>Hội Đồng Chấm (Bot / AI / VD / BC)</th>
                  <th style={{ textAlign: 'center' }}>Điểm Tổng</th>
                  <th style={{ textAlign: 'center' }}>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                      Không tìm thấy thí sinh phù hợp
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '0.92rem' }}>{u.name}</strong>
                            {u.is_top32 && (
                              <span className="swiss-hub-badge" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                                ★ TOP 32
                              </span>
                            )}
                            {u.is_admin && <span className="admin-tag">Admin</span>}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {u.student_id ? <code>MSSV: {u.student_id}</code> : <span style={{ color: 'var(--text-muted)' }}>Chưa có MSSV</span>}
                            {u.class_name && <span> • {u.class_name}</span>}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                        </div>
                      </td>

                      <td>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, color: 'var(--primary-700)' }}>
                            <Bot size={13} />
                            <span>{u.bot_name || 'Chưa đặt tên'}</span>
                          </div>
                          {u.github_repo_url ? (
                            <a
                              href={u.github_repo_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--cyan-400)', marginTop: '2px' }}
                            >
                              <GitBranch size={11} />
                              <span>GitHub Repo</span>
                              <ExternalLink size={10} />
                            </a>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chưa liên kết</span>
                          )}
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className={`submission-status-badge ${u.has_submission ? 'valid' : 'none'}`}>
                          {u.has_submission ? '✓ Đã Nộp' : 'Chưa Nộp'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          {u.swiss_wins || 0} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ 13 thắng</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {u.swiss_points || 0} pts
                        </div>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="admin-final-score-pill"
                          style={{
                            background: u.projected_grade_10 >= 8.5 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                            borderColor: u.projected_grade_10 >= 8.5 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(59, 130, 246, 0.35)',
                            color: u.projected_grade_10 >= 8.5 ? '#10b981' : '#3b82f6',
                            fontWeight: 700,
                          }}
                        >
                          {u.projected_grade_10 !== undefined && u.projected_grade_10 !== null
                            ? `${Number(u.projected_grade_10).toFixed(1)} / 10`
                            : '—'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {u.score_bot || 0} • {u.score_ai_profile || 0} • {u.score_interview || 0} • {u.score_report || 0}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <span className="admin-final-score-pill">
                          {u.final_score !== undefined ? u.final_score : '—'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() => setSelectedUserForEdit(u)}
                            title="Chỉnh sửa thông tin thí sinh"
                          >
                            <Edit2 size={12} />
                            <span>Sửa</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-xs btn-review-action"
                            onClick={() => setSelectedUserForReview(u)}
                            title="Hội đồng chấm điểm và đánh giá"
                          >
                            <Award size={12} />
                            <span>Chấm</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: TOP 32 FINALS & OBSTACLES CONFIGURATION */}
      {activeAdminTab === 'top32' && (
        <div className="google-import-card animate-fade-in">
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.35rem' }}>
              <span className="round-badge">VÒNG CHUNG KẾT TOP 32</span>
            </div>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Cấu Hình Địa Hình Ô Chướng Ngại Vật (Bot v2)
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Để thử thách thuật toán tìm đường (A*, Minimax) tại Vòng Chung kết, hãy chọn các vị trí ô cấm đi trên bàn cờ 9×9. Cấu hình này sẽ được công bố ngay sau khi chốt Top 32 để thí sinh có 01 tuần thay đổi mã nguồn.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', flexWrap: 'wrap' }}>
            {/* Interactive 9x9 Obstacle Cell Selector */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Bàn Cờ 9×9 Chọn Vị Trí Ô Cấm (Nhấp để bật/tắt):
              </h4>
              <div className="obstacles-grid-selector">
                {['9', '8', '7', '6', '5', '4', '3', '2', '1'].map((row) =>
                  ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((col) => {
                    const sq = `${col}${row}`;
                    const isObs = top32Obstacles.includes(sq);
                    const isGoal = sq === 'i9' || sq === 'a1';

                    return (
                      <button
                        key={sq}
                        type="button"
                        disabled={isGoal}
                        className={`obstacle-cell-toggle ${isObs ? 'is-obstacle' : ''}`}
                        onClick={() => toggleObstacleCell(sq)}
                        title={isGoal ? `Ô đích ${sq} không thể đặt cản` : `Ô ${sq}: ${isObs ? 'ĐANG LÀ Ô CẢN' : 'Bình thường'}`}
                      >
                        {isObs ? '✕' : isGoal ? '★' : sq}
                      </button>
                    );
                  })
                )}
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Các ô cản hiện tại ({top32Obstacles.length} ô): <strong>{top32Obstacles.join(', ') || 'Chưa chọn'}</strong>
              </span>
            </div>

            {/* Announcement & Save */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label htmlFor="top32-announcement-input" style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                  Thông báo đổi luật cho 32 Thí sinh:
                </label>
                <textarea
                  id="top32-announcement-input"
                  rows={4}
                  className="form-control"
                  value={top32Announcement}
                  onChange={(e) => setTop32Announcement(e.target.value)}
                  placeholder="Thông báo danh sách ô cản, thời hạn nộp Bot v2..."
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: 'fit-content' }}
                  onClick={handleSaveTop32Config}
                  disabled={isSavingObstacles}
                >
                  <Check size={16} />
                  <span>{isSavingObstacles ? 'Đang lưu...' : 'Lưu Cấu Hình Ô Cản Top 32'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ borderColor: 'rgba(245, 158, 11, 0.5)', color: '#fbbf24' }}
                  onClick={() => setIsBenchmarkOpen(true)}
                >
                  <Shield size={16} color="#fbbf24" />
                  <span>Mở Sandbox Benchmark Kiểm Thử</span>
                </button>
              </div>

              {/* Seeds Preview */}
              <div style={{ marginTop: '0.5rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <h5 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
                  Hạt Giống Top 32 Dẫn Đầu ({top32Seeds.length} thí sinh):
                </h5>
                <div style={{ maxHeight: '180px', overflowY: 'auto', fontSize: '0.8rem' }}>
                  {top32Seeds.slice(0, 10).map((s) => (
                    <div key={s.seed} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px dashed var(--border-subtle)' }}>
                      <span><strong>#{s.seed}</strong>. {s.name} ({s.student_id})</span>
                      <span style={{ color: 'var(--primary-700)', fontWeight: 600 }}>{s.swiss_wins} thắng • {s.swiss_points} pts</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grade Review Modal */}
      {selectedUserForReview && (
        <GradeReviewModal
          user={selectedUserForReview}
          isOpen={!!selectedUserForReview}
          onClose={() => setSelectedUserForReview(null)}
          onGraded={() => {
            fetchDashboardData();
            setSelectedUserForReview(null);
          }}
        />
      )}

      {/* Edit User Modal */}
      {selectedUserForEdit && (
        <EditUserModal
          user={selectedUserForEdit}
          isOpen={!!selectedUserForEdit}
          onClose={() => setSelectedUserForEdit(null)}
          onUpdated={() => {
            fetchDashboardData();
            setSelectedUserForEdit(null);
          }}
          onDeleted={() => {
            fetchDashboardData();
            setSelectedUserForEdit(null);
          }}
        />
      )}
    </div>
  );
}

export default AdminDashboardPage;


