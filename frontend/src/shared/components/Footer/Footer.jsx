import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.25rem' }}>
            <span>⚔️ OTTv2 Platform</span>
          </div>
          <p className="footer-desc">
            Hệ thống tổ chức thi đấu và kiểm thử bot trí tuệ nhân tạo OTTv2 dành cho sinh viên công nghệ UET. Khuyến khích lập trình sáng tạo và ứng dụng AI có trách nhiệm.
          </p>
        </div>

        <div className="footer-col">
          <h4>Giải Đấu</h4>
          <ul className="footer-links">
            <li><Link to="/rules">Luật chơi & Chuẩn giao thức</Link></li>
            <li><Link to="/leaderboard">Bảng xếp hạng A / B / C</Link></li>
            <li><Link to="/matches">Lịch đấu & Replay</Link></li>
            <li><Link to="/submit">Cổng nộp bài dự thi</Link></li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Tài Nguyên</h4>
          <ul className="footer-links">
            <li><a href="/api/rules" target="_blank" rel="noreferrer">Machine-readable rules.json</a></li>
            <li><a href="/docs" target="_blank" rel="noreferrer">OpenAPI / Swagger Docs</a></li>
            <li><a href="/health" target="_blank" rel="noreferrer">System Health Check</a></li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2026 OTTv2 Tournament Platform — Đại học Công Nghệ (VNU-UET).</span>
        <span>Version 2.0.0 • AI Tournament & Live Spectator System</span>
      </div>
    </footer>
  );
}
