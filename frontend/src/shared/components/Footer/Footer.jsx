import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)' }}>
            <span>⚔️ OTTv2 Tournament</span>
          </div>
          <p className="footer-desc">
            Hệ thống tổ chức thi đấu cờ chiến thuật OTTv2 dành cho sinh viên Khoa CNTT — Trường Đại học Công nghệ (VNU-UET). Khuyến khích tư duy thuật toán tự thân, cấu trúc dữ liệu và lập trình thực chiến.
          </p>
        </div>

        <div className="footer-col">
          <h4>Giải Đấu</h4>
          <ul className="footer-links">
            <li><Link to="/rules">Luật chơi & Chuẩn giao thức</Link></li>
            <li><Link to="/leaderboard">Bảng xếp hạng Swiss 13 Vòng</Link></li>
            <li><Link to="/matches">Lịch đấu & Replay bàn cờ</Link></li>
            <li><Link to="/submit">Cổng nộp bài dự thi</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Tài Nguyên</h4>
          <ul className="footer-links">
            <li><a href="/api/rules" target="_blank" rel="noreferrer">Đặc tả máy đọc rules.json</a></li>
            <li><a href="/docs" target="_blank" rel="noreferrer">OpenAPI / Swagger Docs</a></li>
            <li><a href="/health" target="_blank" rel="noreferrer">Kiểm tra trạng thái hệ thống</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 OTTv2 Tournament Platform — Đại học Công Nghệ (VNU-UET).</span>
        <span>Version 2.0.0 • Swiss Tournament & Strategic Game Arena</span>
      </div>
    </footer>
  );
}
