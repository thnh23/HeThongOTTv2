import React, { useState } from 'react';
import {
  Search,
  Bot,
  GitBranch,
  ExternalLink,
  Edit2,
  FolderArchive,
  FileText,
  Code,
  FileCode,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { ViewFilesModal } from '../ViewFilesModal/ViewFilesModal.jsx';

export function Phase02Students({
  usersList,
  paginatedUsers,
  searchQuery,
  setSearchQuery,
  submissionFilter,
  setSubmissionFilter,
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  totalPages,
  totalFilteredUsers,
  onEditUser,
}) {
  const [selectedUserForFiles, setSelectedUserForFiles] = useState(null);

  return (
    <section className="doppelrand-shell phase-container animate-fade-in">
      <div className="doppelrand-core phase-core student-roster-core">
        {/* Header Bar */}
        <div className="phase-header-bar">
          <div>
            <div className="phase-eyebrow">
              <span className="eyebrow-number">GIAI ĐOẠN 02</span>
              <span>QUẢN LÝ THÍ SINH</span>
            </div>
            <h2 className="phase-title">Danh Sách Thí Sinh</h2>
            <p className="phase-subtitle">
              Danh sách thí sinh, trạng thái bài nộp và tiến trình thi đấu.
            </p>
          </div>

          {/* Search & Filter Controls */}
          <div className="students-toolbar-controls">
            <div className="search-pill-box">
              <Search size={15} className="text-muted-icon" />
              <input
                type="text"
                placeholder="Tìm theo MSSV, tên, email, bot..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-pill-input"
              />
            </div>

            <select
              className="filter-pill-select"
              value={submissionFilter}
              onChange={(e) => setSubmissionFilter(e.target.value)}
              aria-label="Lọc theo trạng thái nộp bài"
            >
              <option value="">Tất Cả Thí Sinh ({usersList.length})</option>
              <option value="submitted">Đã Nộp Bot Hợp Lệ</option>
              <option value="pending">Chưa Nộp Bot</option>
            </select>
          </div>
        </div>

        {/* Students Table */}
        <div className="table-responsive roster-table-wrap">
          <table className="styled-table roster-table" aria-label="Bảng quản lý thí sinh">
            <thead>
              <tr>
                <th>Thí Sinh / MSSV / Lớp</th>
                <th>Bot &amp; GitHub Repository</th>
                <th style={{ textAlign: 'center' }}>Trạng Thái Nộp</th>
                <th style={{ textAlign: 'center' }}>Thành Tích Swiss</th>
                <th style={{ textAlign: 'center' }}>Điểm HP Đề Xuất</th>
                <th style={{ textAlign: 'center' }}>Tệp Đính Kèm</th>
                <th style={{ textAlign: 'center' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-table-cell">
                    Không tìm thấy thí sinh nào khớp với tiêu chí tìm kiếm.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="student-profile-cell">
                        <div className="student-name-row">
                          <strong className="student-full-name">{u.name}</strong>
                          {u.is_top32 && (
                            <span className="top32-tag">TOP 32</span>
                          )}
                        </div>
                        <div className="student-sub-row">
                          {u.student_id ? (
                            <code>MSSV: {u.student_id}</code>
                          ) : (
                            <span className="text-muted">Chưa có MSSV</span>
                          )}
                          {u.class_name && <span> • {u.class_name}</span>}
                        </div>
                        <div className="student-email">{u.email}</div>
                      </div>
                    </td>

                    <td>
                      <div className="bot-meta-cell">
                        <div className="bot-title-line">
                          <Bot size={13} />
                          <span>{u.bot_name || 'Chưa đặt tên'}</span>
                        </div>
                        {u.github_repo_url ? (
                          <a
                            href={u.github_repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bot-github-link"
                          >
                            <GitBranch size={11} />
                            <span>GitHub Repo</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="bot-no-repo">Chưa nộp repo</span>
                        )}
                      </div>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className={`submission-pill ${u.has_submission ? 'valid' : 'none'}`}>
                        {u.has_submission ? 'Hợp lệ' : 'Chưa nộp'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <div className="swiss-score-val">
                        {u.swiss_wins || 0} <span className="swiss-score-sub">trận thắng</span>
                      </div>
                      <div className="swiss-points-sub">
                        {u.swiss_points || 0} pts
                      </div>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span
                        className="grade-pill-badge"
                        style={{
                          background:
                            u.projected_grade_10 >= 8.5
                              ? 'rgba(16, 185, 129, 0.12)'
                              : 'rgba(30, 58, 138, 0.08)',
                          borderColor:
                            u.projected_grade_10 >= 8.5
                              ? 'rgba(16, 185, 129, 0.35)'
                              : 'rgba(30, 58, 138, 0.25)',
                          color: u.projected_grade_10 >= 8.5 ? '#047857' : '#1e3a8a',
                        }}
                      >
                        {u.projected_grade_10 !== undefined && u.projected_grade_10 !== null
                          ? `${Number(u.projected_grade_10).toFixed(1)} / 10`
                          : '—'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <div className="file-pills-row" style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          type="button"
                          className="action-icon-pill view-files"
                          onClick={() => setSelectedUserForFiles(u)}
                          title="Xem tệp đính kèm (bot.py, REPORT.md, git_log)"
                        >
                          <FileCode size={12} />
                          <span>Xem Tệp</span>
                        </button>
                        <button
                          type="button"
                          className="action-icon-pill download-zip"
                          title="Tải toàn bộ tệp nộp bài .ZIP"
                          onClick={() => {
                            apiClient.download(
                              `/admin/users/${u.id}/download-zip`,
                              `${u.student_id || u.id}_submission.zip`
                            ).catch((err) => {
                              alert(err.message || 'Lỗi khi tải file ZIP');
                            });
                          }}
                        >
                          <FolderArchive size={12} />
                          <span>ZIP</span>
                        </button>
                      </div>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <div className="student-actions-cluster">
                        <button
                          type="button"
                          className="action-icon-pill edit"
                          onClick={() => onEditUser(u)}
                          title="Chỉnh sửa thông tin thí sinh"
                        >
                          <Edit2 size={12} />
                          <span>Sửa</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls & UI Load Balancing */}
        <div className="table-pagination-bar">
          <div className="pagination-info">
            <span>
              Hiển thị <strong>{totalFilteredUsers === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> –{' '}
              <strong>{Math.min(currentPage * pageSize, totalFilteredUsers)}</strong> trên tổng số{' '}
              <strong>{totalFilteredUsers.toLocaleString('vi-VN')}</strong> thí sinh
            </span>
            <div className="page-size-selector">
              <label htmlFor="select-page-size">Số dòng:</label>
              <select
                id="select-page-size"
                className="page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value={25}>25 / trang</option>
                <option value={50}>50 / trang</option>
                <option value={100}>100 / trang</option>
                <option value={200}>200 / trang</option>
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="pagination-nav">
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="Trang đầu"
              >
                «
              </button>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                title="Trang trước"
              >
                ‹
              </button>

              <div className="pagination-page-chips">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) {
                      acc.push(-idx);
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p < 0 ? (
                      <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        className={`pagination-num-btn ${currentPage === p ? 'active' : ''}`}
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </button>
                    )
                  )}
              </div>

              <button
                type="button"
                className="pagination-btn"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                title="Trang sau"
              >
                ›
              </button>
              <button
                type="button"
                className="pagination-btn"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                title="Trang cuối"
              >
                »
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modal Xem Tệp Đính Kèm */}
      {selectedUserForFiles && (
        <ViewFilesModal
          isOpen={!!selectedUserForFiles}
          user={selectedUserForFiles}
          onClose={() => setSelectedUserForFiles(null)}
        />
      )}
    </section>
  );
}

export default Phase02Students;
