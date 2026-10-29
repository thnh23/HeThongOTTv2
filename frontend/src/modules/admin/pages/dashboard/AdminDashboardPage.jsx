import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Users,
  Trophy,
  RefreshCw,
  Award,
  Laptop,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useToast } from '@/shared/context/ToastContext.jsx';
import { EditUserModal } from '../../components/EditUserModal/index.js';
import {
  Phase01Import,
  Phase02Students,
  Phase03Swiss,
  Phase04Top32,
} from '../../components/phases/index.js';
import './AdminDashboardPage.css';

export function AdminDashboardPage() {
  const { showToast } = useToast();

  // 4 Chronological Admin Phases:
  // Step 1: 'import' -> Step 2: 'students' -> Step 3: 'tournament' -> Step 4: 'top32'
  const [activeAdminTab, setActiveAdminTab] = useState('import');

  // Global Core State
  const [swissStatus, setSwissStatus] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Phase 01: Pipeline & CSV Ingestion State
  const [csvFile, setCsvFile] = useState(null);
  const [csvText, setCsvText] = useState('');
  const [deadlineInput, setDeadlineInput] = useState('');
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const fileInputRef = useRef(null);

  // Phase 02: Students Roster & Filter State
  const [submissionFilter, setSubmissionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);

  // Phase 03: Swiss 13 Vòng & 4 Chunks State
  const [selectedSwissRound, setSelectedSwissRound] = useState(1);
  const [isPairingSwiss, setIsPairingSwiss] = useState(false);
  const [isPublishingSwiss, setIsPublishingSwiss] = useState(false);
  const [resultsStatus, setResultsStatus] = useState(null);
  const [isUploadingResult, setIsUploadingResult] = useState(false);

  // Phase 04: Top 32 Knockout & Obstacles State
  const [top32Obstacles, setTop32Obstacles] = useState(['d4', 'd6', 'f4', 'f6', 'e5']);
  const [top32Announcement, setTop32Announcement] = useState('');
  const [top32Seeds, setTop32Seeds] = useState([]);
  const [isSavingObstacles, setIsSavingObstacles] = useState(false);
  const [isFinalizingSeeds, setIsFinalizingSeeds] = useState(false);
  const [bracketData, setBracketData] = useState(null);
  const [isRunningRound, setIsRunningRound] = useState(false);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // ────────────────────────────────────────────────────────────
  // DATA FETCHING HOOKS
  // ────────────────────────────────────────────────────────────
  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [swissRes, usersRes] = await Promise.all([
        apiClient.get(`/admin/swiss/status?round_num=${selectedSwissRound}`).catch(() => null),
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

  const fetchTop32Bracket = async () => {
    try {
      const res = await apiClient.get('/admin/top32/bracket');
      if (res) setBracketData(res);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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

  // Tab-specific initial load
  useEffect(() => {
    if (activeAdminTab === 'tournament') {
      fetchChunksAndResults(selectedSwissRound);
    } else if (activeAdminTab === 'top32') {
      fetchTop32Config();
      fetchTop32Bracket();
    }
  }, [activeAdminTab, selectedSwissRound]);

  // Reset pagination on search / filter
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, submissionFilter]);

  // ────────────────────────────────────────────────────────────
  // MEMOIZED DERIVED VALUES (EXCLUDE ADMINS FROM PARTICIPANTS)
  // ────────────────────────────────────────────────────────────
  const studentList = useMemo(() => {
    return (usersList || []).filter((u) => !u.is_admin);
  }, [usersList]);

  const filteredUsers = useMemo(() => {
    return studentList.filter((u) => {
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
  }, [studentList, submissionFilter, searchQuery]);

  const totalRoundMatches = Math.floor(studentList.length / 2);
  const avgMatchesPerChunk = totalRoundMatches > 0 ? Math.ceil(totalRoundMatches / 4) : 0;

  const totalFilteredUsers = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredUsers / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // ────────────────────────────────────────────────────────────
  // PHASE 01 HANDLERS
  // ────────────────────────────────────────────────────────────
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
      const res = await apiClient.post('/admin/pipeline/start', formData);

      setIsPipelineRunning(true);
      showToast(res.message || 'Pipeline đang chạy bất đồng bộ trong nền!', 'success');
    } catch (err) {
      showToast(err.message || 'Lỗi khi khởi động Pipeline', 'error');
    }
  };

  const handleExportValidationReport = async () => {
    try {
      showToast('Đang tải báo cáo thẩm định CSV...', 'info');
      await apiClient.download('/admin/pipeline/export-report', 'bao_cao_tham_dinh.csv');
      showToast('Tải báo cáo thẩm định thành công!', 'success');
    } catch (err) {
      showToast(err.message || 'Lỗi khi tải báo cáo thẩm định', 'error');
    }
  };

  // ────────────────────────────────────────────────────────────
  // PHASE 03 HANDLERS
  // ────────────────────────────────────────────────────────────
  const handleTriggerSwissPair = async () => {
    if (usersList.length < 2) {
      showToast(
        'Chưa có dữ liệu thí sinh trong hệ thống! Vui lòng nạp danh sách thí sinh từ Google Form (CSV) tại Bước 01.',
        'error'
      );
      return;
    }

    setIsPairingSwiss(true);
    try {
      showToast(
        `Đang ghép cặp Vòng ${selectedSwissRound} (${usersList.length} thí sinh, ${totalRoundMatches} trận), chia đều 4 máy chấm...`,
        'info'
      );
      const res = await apiClient.post('/admin/swiss/pair', {
        round_num: Number(selectedSwissRound),
        num_chunks: 4,
        player_count: usersList.length,
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

  const handleDownloadAllChunksZip = async () => {
    try {
      showToast(`Đang tải file ZIP 4 chunks Vòng ${selectedSwissRound}...`, 'info');
      await apiClient.download(
        `/admin/swiss/chunks/${selectedSwissRound}/download-zip`,
        `swiss_round_${selectedSwissRound}_chunks.zip`
      );
      showToast(`Tải file ZIP Vòng ${selectedSwissRound} thành công!`, 'success');
    } catch (err) {
      showToast(err.message || `Lỗi khi tải gói ZIP Vòng ${selectedSwissRound}`, 'error');
    }
  };

  const handleDownloadSingleChunk = async (chunkId) => {
    try {
      const paddedId = String(chunkId).padStart(2, '0');
      showToast(`Đang tải file chunk_${paddedId}.json...`, 'info');
      await apiClient.download(
        `/admin/swiss/chunks/${selectedSwissRound}/${chunkId}/download`,
        `chunk_${paddedId}.json`
      );
      showToast(`Tải file chunk_${paddedId}.json thành công!`, 'success');
    } catch (err) {
      showToast(err.message || `Lỗi khi tải chunk_${chunkId}`, 'error');
    }
  };

  const handleUploadResultFile = async (file, chunkId = null) => {
    if (!file) return;
    setIsUploadingResult(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('round_num', selectedSwissRound);
      if (chunkId) {
        formData.append('chunk_id', chunkId);
      }

      const res = await apiClient.post('/admin/swiss/upload-result', formData);
      showToast(res.message || 'Tiếp nhận file kết quả thành công!', 'success');
      fetchChunksAndResults(selectedSwissRound);
      fetchDashboardData();
    } catch (err) {
      showToast(err.message || 'Lỗi khi nộp file kết quả', 'error');
    } finally {
      setIsUploadingResult(false);
    }
  };

  const handleResetRoundResults = async () => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn đặt lại toàn bộ kết quả đã nộp của Vòng ${selectedSwissRound}? Tất cả các máy chấm sẽ chuyển về trạng thái Chờ nộp.`
      )
    ) {
      return;
    }
    try {
      const res = await apiClient.delete(`/admin/swiss/results/${selectedSwissRound}`);
      showToast(res.message || 'Đã đặt lại trạng thái chờ nộp cho tất cả các máy chấm!', 'success');
      fetchChunksAndResults(selectedSwissRound);
      fetchDashboardData();
    } catch (err) {
      showToast(err.message || 'Lỗi khi đặt lại kết quả', 'error');
    }
  };

  const handleDeleteChunkResult = async (chunkId) => {
    try {
      const res = await apiClient.delete(`/admin/swiss/results/${selectedSwissRound}/${chunkId}`);
      showToast(res.message || `Đã hủy kết quả Máy #${chunkId}!`, 'success');
      fetchChunksAndResults(selectedSwissRound);
      fetchDashboardData();
    } catch (err) {
      showToast(err.message || 'Lỗi khi hủy kết quả máy chấm', 'error');
    }
  };

  // ────────────────────────────────────────────────────────────
  // PHASE 04 HANDLERS (TOP 32 & KNOCKOUT BRACKET)
  // ────────────────────────────────────────────────────────────
  const toggleObstacleCell = (sq) => {
    const cleanSq = sq.toLowerCase().trim();
    if (top32Obstacles.includes(cleanSq)) {
      setTop32Obstacles(top32Obstacles.filter((o) => o !== cleanSq));
    } else {
      setTop32Obstacles([...top32Obstacles, cleanSq]);
    }
  };

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

  const handleFinalizeTop32Seeds = async () => {
    setIsFinalizingSeeds(true);
    try {
      showToast('Đang chốt danh sách 32 hạt giống từ BXH Swiss (loại trừ Admin 100%)...', 'info');
      const res = await apiClient.post('/admin/top32/finalize-seeds');
      showToast(res.message || 'Đã chốt danh sách hạt giống Top 32!', 'success');
      if (res.seeds) setTop32Seeds(res.seeds);
      if (res.bracket) setBracketData(res.bracket);
      fetchDashboardData();
    } catch (err) {
      showToast(err.message || 'Lỗi khi chốt hạt giống Top 32', 'error');
    } finally {
      setIsFinalizingSeeds(false);
    }
  };

  const handleRunRound = async (roundType, forceRerun = false) => {
    setIsRunningRound(true);
    let pollTimer = null;
    try {
      showToast(
        forceRerun
          ? `Đang thiết lập lại và chạy thi đấu BO2 vòng '${roundType}'...`
          : `Đang chạy thi đấu BO2 vòng '${roundType}' trên bàn cờ có ô cản...`,
        'info'
      );

      // Định kỳ 1.2s thăm dò kết quả trận đấu live để cập nhật giao diện nhánh đấu theo thời gian thực
      pollTimer = setInterval(async () => {
        try {
          const liveBracket = await apiClient.get('/admin/top32/bracket');
          if (liveBracket) {
            setBracketData(liveBracket);
          }
        } catch {
          // Bỏ qua lỗi tạm thời khi polling
        }
      }, 1200);

      const res = await apiClient.post('/admin/top32/run-round', {
        round_type: roundType,
        force_rerun: forceRerun,
      });
      showToast(res.message || `Đã hoàn thành thi đấu vòng ${roundType}!`, 'success');
      if (res.bracket) setBracketData(res.bracket);
    } catch (err) {
      showToast(err.message || `Lỗi khi chạy vòng ${roundType}`, 'error');
    } finally {
      if (pollTimer) clearInterval(pollTimer);
      try {
        const finalBracket = await apiClient.get('/admin/top32/bracket');
        if (finalBracket) setBracketData(finalBracket);
      } catch {
        // ignore
      }
      setIsRunningRound(false);
    }
  };

  const handleResetBracket = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn thiết lập lại toàn bộ nhánh đấu Vòng Chung Kết?')) {
      return;
    }
    setIsRunningRound(true);
    try {
      const res = await apiClient.post('/admin/top32/reset-bracket');
      showToast(res.message || 'Đã reset nhánh đấu Top 32!', 'success');
      if (res.bracket) setBracketData(res.bracket);
    } catch (err) {
      showToast(err.message || 'Lỗi khi reset nhánh đấu', 'error');
    } finally {
      setIsRunningRound(false);
    }
  };

  return (
    <div className="admin-page animate-fade-in">
      {/* ADMIN HEADER & SYSTEM STATUS */}
      <header className="admin-hero-header">
        <div className="admin-hero-main">
          <div className="eyebrow-badge">
            <span className="eyebrow-dot" />
            <span>KHOA CNTT - TRƯỜNG ĐẠI HỌC CÔNG NGHỆ (VNU-UET)</span>
          </div>
          <h1 className="admin-hero-title">
            Quản Trị <span className="title-gradient-accent">Giải Đấu OTTv2</span>
          </h1>
          <p className="admin-hero-desc">
            Bảng điều hành và giám sát giải đấu cờ thuật toán OTTv2.
          </p>
        </div>

        <div className="admin-hero-actions">
          <button
            id="btn-admin-refresh"
            className="btn-island btn-island-secondary"
            onClick={() => {
              fetchDashboardData();
              if (activeAdminTab === 'tournament') fetchChunksAndResults(selectedSwissRound);
              if (activeAdminTab === 'top32') {
                fetchTop32Config();
                fetchTop32Bracket();
              }
            }}
            disabled={isLoading}
            title="Làm mới trạng thái"
          >
            <span className="btn-island-text">Làm mới dữ liệu</span>
            <span className="btn-island-badge">
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </span>
          </button>
        </div>
      </header>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* METRIC CARDS (DOUBLE-BEZEL ASYMMETRICAL BENTO) */}
      {/* ──────────────────────────────────────────────────────────── */}
      <section className="admin-metrics-bento" aria-label="Số liệu tổng quan">
        <div className="doppelrand-shell metric-shell">
          <div className="doppelrand-core metric-core">
            <div className="metric-header">
              <span className="metric-label">Tổng Thí Sinh CSDL</span>
              <div className="metric-icon-wrap primary">
                <Users size={16} />
              </div>
            </div>
            <div className="metric-value">{studentList.length.toLocaleString('vi-VN')}</div>
            <div className="metric-footer">
              <span className="status-live-indicator">● Cập nhật từ Google Form</span>
            </div>
          </div>
        </div>

        <div className="doppelrand-shell metric-shell">
          <div className="doppelrand-core metric-core">
            <div className="metric-header">
              <span className="metric-label">Thể Thức Thi Đấu</span>
              <div className="metric-icon-wrap gold">
                <Trophy size={16} />
              </div>
            </div>
            <div className="metric-value">Hệ Thống Thụy Sĩ</div>
            <div className="metric-footer">
              <span className="metric-highlight gold">Tiêu chuẩn FIDE</span>
            </div>
          </div>
        </div>

        <div className="doppelrand-shell metric-shell">
          <div className="doppelrand-core metric-core">
            <div className="metric-header">
              <span className="metric-label">Cụm Máy Chấm</span>
              <div className="metric-icon-wrap emerald">
                <Laptop size={16} />
              </div>
            </div>
            <div className="metric-value">Máy Chấm Phân Tán</div>
            <div className="metric-footer">
              <span className="metric-highlight emerald">
                {totalRoundMatches > 0
                  ? `${totalRoundMatches.toLocaleString('vi-VN')} trận đấu / vòng`
                  : 'Phân tải tự động'}
              </span>
            </div>
          </div>
        </div>

        <div className="doppelrand-shell metric-shell">
          <div className="doppelrand-core metric-core">
            <div className="metric-header">
              <span className="metric-label">Vòng Chung Kết</span>
              <div className="metric-icon-wrap cyan">
                <Award size={16} />
              </div>
            </div>
            <div className="metric-value">Top 32</div>
            <div className="metric-footer">
              <span className="metric-highlight cyan">
                {top32Seeds.length > 0 ? `${top32Seeds.length} Hạt giống đã chốt` : 'Đấu loại trực tiếp'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4-PHASE SEQUENTIAL STEPPER NAVIGATION */}
      <nav className="admin-step-nav" aria-label="Quy trình 4 giai đoạn giải đấu">
        <button
          type="button"
          className={`step-tab-btn ${activeAdminTab === 'import' ? 'active' : ''}`}
          onClick={() => setActiveAdminTab('import')}
        >
          <div className="step-tab-top">
            <span className="step-tab-indicator">01</span>
            <span className="step-status-chip">
              <RefreshCw size={12} className={isPipelineRunning ? 'animate-spin' : ''} />
              <span>{isPipelineRunning ? 'Đang chạy' : 'Sẵn sàng'}</span>
            </span>
          </div>
          <div className="step-tab-text">
            <div className="step-title">Thu thập bài thi</div>
            <div className="step-desc">Nhập dữ liệu bài thi</div>
          </div>
        </button>

        <button
          type="button"
          className={`step-tab-btn ${activeAdminTab === 'students' ? 'active' : ''}`}
          onClick={() => setActiveAdminTab('students')}
        >
          <div className="step-tab-top">
            <span className="step-tab-indicator">02</span>
            <span className="step-status-chip">
              <Users size={12} />
              <span>{studentList.length} thí sinh</span>
            </span>
          </div>
          <div className="step-tab-text">
            <div className="step-title">Danh sách thí sinh</div>
            <div className="step-desc">Hồ sơ thí sinh</div>
          </div>
        </button>

        <button
          type="button"
          className={`step-tab-btn ${activeAdminTab === 'tournament' ? 'active' : ''}`}
          onClick={() => setActiveAdminTab('tournament')}
        >
          <div className="step-tab-top">
            <span className="step-tab-indicator">03</span>
            <span className="step-status-chip">
              <Zap size={12} />
              <span>Vòng {selectedSwissRound}</span>
            </span>
          </div>
          <div className="step-tab-text">
            <div className="step-title">Vòng Thụy Sĩ</div>
            <div className="step-desc">Bốc thăm &amp; chấm điểm</div>
          </div>
        </button>

        <button
          type="button"
          className={`step-tab-btn ${activeAdminTab === 'top32' ? 'active' : ''}`}
          onClick={() => setActiveAdminTab('top32')}
        >
          <div className="step-tab-top">
            <span className="step-tab-indicator">04</span>
            <span className="step-status-chip">
              <Award size={12} />
              <span>{top32Obstacles.length} ô cản</span>
            </span>
          </div>
          <div className="step-tab-text">
            <div className="step-title">Chung kết Top 32</div>
            <div className="step-desc">Ô cản &amp; nhánh đấu</div>
          </div>
        </button>
      </nav>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* RENDER ACTIVE PHASE COMPONENT */}
      {/* ──────────────────────────────────────────────────────────── */}
      {activeAdminTab === 'import' && (
        <Phase01Import
          csvFile={csvFile}
          setCsvFile={setCsvFile}
          csvText={csvText}
          setCsvText={setCsvText}
          fileInputRef={fileInputRef}
          deadlineInput={deadlineInput}
          setDeadlineInput={setDeadlineInput}
          pipelineStatus={pipelineStatus}
          isPipelineRunning={isPipelineRunning}
          onStartPipeline={handleStartPipeline}
          onExportReport={handleExportValidationReport}
          onNavigateToStudents={() => {
            setActiveAdminTab('students');
            fetchDashboardData();
          }}
          formatFileSize={formatFileSize}
        />
      )}

      {activeAdminTab === 'students' && (
        <Phase02Students
          usersList={studentList}
          paginatedUsers={paginatedUsers}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          submissionFilter={submissionFilter}
          setSubmissionFilter={setSubmissionFilter}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          totalPages={totalPages}
          totalFilteredUsers={totalFilteredUsers}
          onEditUser={(u) => setSelectedUserForEdit(u)}
        />
      )}

      {activeAdminTab === 'tournament' && (
        <Phase03Swiss
          selectedSwissRound={selectedSwissRound}
          setSelectedSwissRound={setSelectedSwissRound}
          usersList={usersList}
          totalRoundMatches={totalRoundMatches}
          avgMatchesPerChunk={avgMatchesPerChunk}
          swissStatus={swissStatus}
          resultsStatus={resultsStatus}
          isPairingSwiss={isPairingSwiss}
          isPublishingSwiss={isPublishingSwiss}
          isUploadingResult={isUploadingResult}
          onTriggerSwissPair={handleTriggerSwissPair}
          onTriggerSwissPublish={handleTriggerSwissPublish}
          onDownloadAllChunksZip={handleDownloadAllChunksZip}
          onDownloadSingleChunk={handleDownloadSingleChunk}
          onUploadResultFile={handleUploadResultFile}
          onResetRoundResults={handleResetRoundResults}
          onDeleteChunkResult={handleDeleteChunkResult}
        />
      )}

      {activeAdminTab === 'top32' && (
        <Phase04Top32
          top32Obstacles={top32Obstacles}
          top32Announcement={top32Announcement}
          setTop32Announcement={setTop32Announcement}
          top32Seeds={top32Seeds}
          toggleObstacleCell={toggleObstacleCell}
          handleSaveTop32Config={handleSaveTop32Config}
          isSavingObstacles={isSavingObstacles}
          bracketData={bracketData}
          onRunRound={handleRunRound}
          isRunningRound={isRunningRound}
          onResetBracket={handleResetBracket}
          onFinalizeSeeds={handleFinalizeTop32Seeds}
          isFinalizingSeeds={isFinalizingSeeds}
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
