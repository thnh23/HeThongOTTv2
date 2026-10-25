import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Code,
  FileText,
  GitBranch,
  Copy,
  Check,
  FolderArchive,
  ExternalLink,
  Bot,
  FileCode,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import './ViewFilesModal.css';

export function ViewFilesModal({ isOpen, user, onClose }) {
  const [activeTab, setActiveTab] = useState('bot');
  const [filesData, setFilesData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const lastUserIdRef = useRef(null);

  const userId = user?.id;

  // Đóng modal khi nhấn phím Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Tải dữ liệu tệp (chỉ tải khi mở và đổi thí sinh, không re-trigger khi parent re-render)
  useEffect(() => {
    if (!isOpen || !userId) return;

    // Nếu đã tải dữ liệu cho thí sinh này rồi thì không cần fetch lại
    if (lastUserIdRef.current === userId && filesData) {
      return;
    }

    lastUserIdRef.current = userId;
    setActiveTab('bot');
    setCopied(false);
    setIsLoading(true);

    let isMounted = true;
    apiClient
      .get(`/admin/users/${userId}/submission-files`)
      .then((res) => {
        if (isMounted) {
          setFilesData(res?.files || null);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Lỗi khi tải tệp nộp bài:', err);
          setFilesData(null);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId, filesData]);

  if (!isOpen || !user) return null;

  const currentContent = (() => {
    if (!filesData) return '';
    if (activeTab === 'bot') return filesData.bot_py || '# Chưa có nội dung mã nguồn bot.py';
    if (activeTab === 'report') return filesData.report_md || '# Chưa có báo cáo REPORT.md';
    if (activeTab === 'git') return filesData.git_log || 'Chưa có lịch sử commit git_log.txt';
    if (activeTab === 'prompts') return filesData.prompts_md || 'Chưa có tệp PROMPTS.md';
    return '';
  })();

  const handleCopy = () => {
    if (!currentContent) return;
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const modalElement = (
    <div className="view-files-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="view-files-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="view-files-header">
          <div className="view-files-title-wrap">
            <div className="view-files-icon-box">
              <FileCode size={20} />
            </div>
            <div>
              <h3 className="view-files-heading">Tệp Đính Kèm — {user.name}</h3>
              <div className="view-files-subheading">
                <code>MSSV: {user.student_id || 'Chưa có'}</code>
                {user.class_name && <span> • {user.class_name}</span>}
                <span> • Bot: <strong>{user.bot_name || 'Chưa đặt tên'}</strong></span>
              </div>
            </div>
          </div>

          <div className="view-files-top-actions">
            <button
              type="button"
              className="view-files-action-btn copy"
              onClick={handleCopy}
              title="Sao chép nội dung tệp hiện tại"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              <span>{copied ? 'Đã Chép!' : 'Sao Chép'}</span>
            </button>

            <a
              href={`/api/admin/users/${user.id}/download-zip`}
              target="_blank"
              rel="noopener noreferrer"
              className="view-files-action-btn zip"
              title="Tải toàn bộ bài nộp dưới dạng file .ZIP"
            >
              <FolderArchive size={13} />
              <span>Tải ZIP</span>
            </a>

            {user.github_repo_url && (
              <a
                href={user.github_repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="view-files-action-btn github"
                title="Mở kho lưu trữ GitHub trong tab mới"
              >
                <GitBranch size={13} />
                <span>GitHub</span>
                <ExternalLink size={11} />
              </a>
            )}

            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              title="Đóng cửa sổ (Esc)"
              style={{ marginLeft: '0.5rem' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="view-files-nav-bar">
          <button
            type="button"
            className={`view-files-tab-btn ${activeTab === 'bot' ? 'active' : ''}`}
            onClick={() => setActiveTab('bot')}
          >
            <Code size={14} />
            <span>bot.py</span>
          </button>

          <button
            type="button"
            className={`view-files-tab-btn ${activeTab === 'report' ? 'active' : ''}`}
            onClick={() => setActiveTab('report')}
          >
            <FileText size={14} />
            <span>REPORT.md</span>
          </button>

          <button
            type="button"
            className={`view-files-tab-btn ${activeTab === 'git' ? 'active' : ''}`}
            onClick={() => setActiveTab('git')}
          >
            <GitBranch size={14} />
            <span>git_log.txt</span>
          </button>

          {filesData?.prompts_md && (
            <button
              type="button"
              className={`view-files-tab-btn ${activeTab === 'prompts' ? 'active' : ''}`}
              onClick={() => setActiveTab('prompts')}
            >
              <FileText size={14} />
              <span>PROMPTS.md</span>
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="view-files-content-body">
          {isLoading && (
            <div className="view-files-loading-bar">
              <Loader2 size={16} className="spin" />
              <span>Đang tải tệp bài nộp từ kho dữ liệu...</span>
            </div>
          )}

          <div className="view-files-code-scroll">
            {currentContent ? (
              <pre className="view-files-code-pre">
                <code>{currentContent}</code>
              </pre>
            ) : !isLoading ? (
              <div className="view-files-empty-state">
                <Code size={32} />
                <span>Không tìm thấy nội dung tệp cho thí sinh này.</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="view-files-footer">
          <div className="view-files-status-tag">
            <Bot size={13} />
            <span>Đang xem: <code>{activeTab === 'bot' ? 'bot.py' : activeTab === 'report' ? 'REPORT.md' : 'git_log.txt'}</code></span>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalElement, document.body);
}

export default ViewFilesModal;
