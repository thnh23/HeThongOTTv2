import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  GraduationCap,
  Mail,
  GitBranch,
  Bot,
  Award,
  Shield,
  Save,
  Trash2,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useToast } from '@/shared/context/ToastContext.jsx';
import './EditUserModal.css';

export function EditUserModal({ isOpen, user, onClose, onUpdated, onDeleted }) {
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [email, setEmail] = useState('');
  const [className, setClassName] = useState('');
  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [botName, setBotName] = useState('');
  const [isTop32, setIsTop32] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      setName(user.name || '');
      setStudentId(user.student_id || '');
      setEmail(user.email || '');
      setClassName(user.class_name || 'QH-2022-I/CQ');
      setGithubRepoUrl(user.github_repo_url || '');
      setBotName(user.bot_name || '');
      setIsTop32(Boolean(user.is_top32));
      setIsAdmin(Boolean(user.is_admin));
      setIsActive(user.is_active !== undefined ? Boolean(user.is_active) : true);
      setNotes(user.notes || '');
      setConfirmDelete(false);
    }
  }, [user, isOpen]);

  if (!isOpen || !user) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Họ và tên thí sinh không được để trống!', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiClient.put(`/admin/users/${user.id}`, {
        name: name.trim(),
        student_id: studentId.trim() || null,
        email: email.trim(),
        class_name: className.trim() || null,
        github_repo_url: githubRepoUrl.trim() || null,
        bot_name: botName.trim() || null,
        is_top32: isTop32,
        is_admin: isAdmin,
        is_active: isActive,
        notes: notes.trim() || null,
      });

      showToast(res.message || 'Cập nhật thông tin thí sinh thành công!', 'success');
      if (onUpdated) onUpdated();
      onClose();
    } catch (err) {
      showToast(err.message || 'Lỗi khi cập nhật thông tin thí sinh', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setIsDeleting(true);
    try {
      await apiClient.delete(`/admin/users/${user.id}`);
      showToast(`Đã xóa thành công thí sinh ${user.name}!`, 'success');
      if (onDeleted) onDeleted();
      onClose();
    } catch (err) {
      showToast(err.message || 'Không thể xóa thí sinh', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card edit-user-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="modal-header-icon-wrap">
              <User size={20} color="var(--primary-700)" />
            </div>
            <div>
              <h3 className="modal-title">Chỉnh Sửa Thông Tin Thí Sinh</h3>
              <p className="modal-subtitle">
                ID: <code>{user.id}</code> • Đăng ký: {new Date(user.registered_at).toLocaleDateString('vi-VN')}
              </p>
            </div>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="edit-user-form">
          <div className="modal-body-scrollable">
            <div className="form-grid-2col">
              {/* Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-user-name">
                  <User size={14} /> Họ và Tên Thí Sinh <span className="req-star">*</span>
                </label>
                <input
                  id="edit-user-name"
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nhập họ và tên đầy đủ..."
                  required
                />
              </div>

              {/* Student ID */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-user-student-id">
                  <GraduationCap size={14} /> Mã Sinh Viên (MSSV)
                </label>
                <input
                  id="edit-user-student-id"
                  type="text"
                  className="form-control"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="Ví dụ: 21020001, 22020456..."
                />
              </div>

              {/* Email */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-user-email">
                  <Mail size={14} /> Địa Chỉ Email <span className="req-star">*</span>
                </label>
                <input
                  id="edit-user-email"
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@vnu.edu.vn"
                  required
                />
              </div>

              {/* Class Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-user-class">
                  <GraduationCap size={14} /> Lớp Khóa Học
                </label>
                <input
                  id="edit-user-class"
                  type="text"
                  className="form-control"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="Ví dụ: QH-2022-I/CQ-CLC1"
                />
              </div>

              {/* Bot Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-user-bot-name">
                  <Bot size={14} /> Tên Định Danh Bot
                </label>
                <input
                  id="edit-user-bot-name"
                  type="text"
                  className="form-control"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="Ví dụ: AlphaOtt_v3, MinimaxMaster..."
                />
              </div>

              {/* GitHub Repo URL */}
              <div className="form-group">
                <label className="form-label" htmlFor="edit-user-github">
                  <GitBranch size={14} /> Link GitHub Repository
                </label>
                <input
                  id="edit-user-github"
                  type="url"
                  className="form-control"
                  value={githubRepoUrl}
                  onChange={(e) => setGithubRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/ottv2-bot"
                />
              </div>
            </div>

            {/* Swiss Tournament Flags */}
            <div className="tournament-flags-section">
              <h4 className="flags-title">Trạng Thái &amp; Quyền Hạn Trong Giải Đấu</h4>
              <div className="flags-checkbox-grid">
                <label className={`flag-checkbox-card ${isTop32 ? 'active-gold' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isTop32}
                    onChange={(e) => setIsTop32(e.target.checked)}
                  />
                  <div>
                    <span className="flag-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Award size={15} color="var(--amber-700)" />
                      <strong>Hạt Giống Top 32 Vòng Chung Kết</strong>
                    </span>
                    <span className="flag-desc">Được cấp quyền nộp Bot v2 (thích ứng ô chướng ngại vật) và thi đấu Knockout.</span>
                  </div>
                </label>

                <label className="flag-checkbox-card">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <div>
                    <span className="flag-label">
                      <strong>Tài Khoản Hoạt Động (Active)</strong>
                    </span>
                    <span className="flag-desc">Cho phép đăng nhập, nộp bot và tham gia bốc thăm 13 vòng Swiss.</span>
                  </div>
                </label>

                <label className="flag-checkbox-card">
                  <input
                    type="checkbox"
                    checked={isAdmin}
                    onChange={(e) => setIsAdmin(e.target.checked)}
                  />
                  <div>
                    <span className="flag-label" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Shield size={14} color="var(--primary-700)" />
                      <strong>Quyền Quản Trị Viên (Admin)</strong>
                    </span>
                    <span className="flag-desc">Có quyền truy cập Dashboard điều hành giải đấu và chấm thi.</span>
                  </div>
                </label>
              </div>
            </div>

            {/* Admin Notes */}
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label" htmlFor="edit-user-notes">
                Ghi Chú Đánh Giá Của Giảng Viên / Ban Tổ Chức
              </label>
              <textarea
                id="edit-user-notes"
                className="form-control"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nhận xét về phong cách lập trình, lịch sử commit, vấn đáp hoặc kết quả quét MOSS..."
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="modal-footer">
            <button
              type="button"
              className={`btn ${confirmDelete ? 'btn-danger-confirm' : 'btn-outline-danger'} btn-sm`}
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
            >
              <Trash2 size={15} />
              <span>{confirmDelete ? 'Xác Nhận Xóa Vĩnh Viễn?' : 'Xóa Thí Sinh'}</span>
            </button>

            <div style={{ display: 'flex', gap: '0.65rem', marginLeft: 'auto' }}>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={onClose}
                disabled={isSaving || isDeleting}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isSaving || isDeleting}
              >
                <Save size={15} />
                <span>{isSaving ? 'Đang Lưu...' : 'Lưu Thay Đổi'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditUserModal;
