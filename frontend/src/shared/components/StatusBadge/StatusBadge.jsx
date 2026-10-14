import React from 'react';
import './StatusBadge.css';

const STATUS_LABELS = {
  pending: 'Chờ đấu',
  running: 'Đang diễn ra',
  done: 'Đã hoàn thành',
  error: 'Lỗi trận',
  valid: 'Hợp lệ',
  invalid: 'Không hợp lệ',
  win: 'Thắng',
  loss: 'Thua',
  draw: 'Hòa',
  W1: 'Thắng W1 (Ăn hết quân)',
  W2: 'Thắng W2 (Vào ô đích)',
  D1: 'Hòa D1 (Hết nước)',
  D2: 'Hòa D2 (Lặp thế/200 nước)',
  T1: 'Thua T1 (Lỗi bot/quá giờ)',
};

export function StatusBadge({ status, label }) {
  const normStatus = (status || 'pending').toLowerCase();
  const text = label || STATUS_LABELS[status] || status;

  return (
    <span className={`status-badge status-${normStatus}`}>
      <span className="status-dot"></span>
      <span>{text}</span>
    </span>
  );
}
