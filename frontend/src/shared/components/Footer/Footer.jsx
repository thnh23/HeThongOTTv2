import React from 'react';
import { Link } from 'react-router-dom';
import {
  Swords,
  BookOpen,
  Trophy,
  Upload,
  Radio,
  FileCode,
  ShieldCheck,
  GraduationCap,
  MapPin,
  Mail,
  ExternalLink,
  Laptop,
  CheckCircle2,
} from 'lucide-react';
import './Footer.css';

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        {/* Column 1: Brand & Academic Organizer */}
        <div className="footer-brand-col">
          <div className="footer-brand-title">
            <div className="footer-logo-badge">
              <Swords size={20} color="var(--primary-700)" />
            </div>
            <div>
              <span className="footer-brand-name">Đấu Trường OTTv2</span>
              <span className="footer-brand-tagline">Khoa Công nghệ Thông tin — VNU-UET</span>
            </div>
          </div>

          <p className="footer-desc">
            Nền tảng thi đấu cờ chiến thuật và trí tuệ nhân tạo đối kháng 9×9 phục vụ học phần chuyên ngành.
            Khuyến khích sinh viên tự tay lập trình giải thuật, tối ưu cấu trúc dữ liệu và rèn luyện tư duy kỹ sư phần mềm chuẩn mực.
          </p>

          <div className="footer-contact-info">
            <div className="contact-item">
              <MapPin size={15} className="contact-icon" />
              <span>Nhà E3, 144 Xuân Thủy, Cầu Giấy, Hà Nội</span>
            </div>
            <div className="contact-item">
              <GraduationCap size={15} className="contact-icon" />
              <span>Trường Đại học Công nghệ, ĐHQGHN</span>
            </div>
            <div className="contact-item">
              <Mail size={15} className="contact-icon" />
              <span>fit@vnu.edu.vn • UET Network Lab</span>
            </div>
          </div>
        </div>

        {/* Column 2: Tournament Navigation */}
        <div className="footer-col">
          <h4 className="footer-col-title">
            <Trophy size={16} color="var(--primary-700)" />
            <span>Giải Đấu</span>
          </h4>
          <ul className="footer-links">
            <li>
              <Link to="/">Trang Chủ Giải Đấu</Link>
            </li>
            <li>
              <Link to="/leaderboard">Bảng Xếp Hạng 13 Vòng</Link>
            </li>
            <li>
              <Link to="/live">Xem Trực Tiếp (Live Hub)</Link>
            </li>
            <li>
              <Link to="/matches">Lịch Sử Đấu &amp; Replay</Link>
            </li>
            <li>
              <Link to="/submit">Cổng Nộp Bot &amp; Kiểm Thử</Link>
            </li>
            <li>
              <Link to="/lookup">Tra Cứu Gói Bài Thi (MSSV)</Link>
            </li>
          </ul>
        </div>

        {/* Column 3: Academic Rules & Integrity */}
        <div className="footer-col">
          <h4 className="footer-col-title">
            <ShieldCheck size={16} color="var(--emerald-600)" />
            <span>Quy Chuẩn &amp; Học Thuật</span>
          </h4>
          <ul className="footer-links">
            <li>
              <Link to="/rules">Luật Cờ 9×9 &amp; Điều Lệ</Link>
            </li>
            <li>
              <Link to="/rules#integrity">Chính Sách Liêm Chính &amp; AI</Link>
            </li>
            <li>
              <Link to="/rules#grading">Thang Điểm Lũy Tiến Học Phần</Link>
            </li>
            <li>
              <Link to="/rules#git">Lịch Sử Git &amp; Tiến Trình Code</Link>
            </li>
            <li>
              <Link to="/admin">Cổng Quản Trị BTC (Admin)</Link>
            </li>
          </ul>
        </div>

        {/* Column 4: Developer & API */}
        <div className="footer-col">
          <h4 className="footer-col-title">
            <FileCode size={16} color="var(--amber-600)" />
            <span>Tài Liệu Kỹ Thuật</span>
          </h4>
          <ul className="footer-links">
            <li>
              <a href="/api/rules" target="_blank" rel="noreferrer" className="external-link">
                <span>Đặc tả máy đọc (rules.json)</span>
                <ExternalLink size={12} />
              </a>
            </li>
            <li>
              <a href="/docs" target="_blank" rel="noreferrer" className="external-link">
                <span>OpenAPI / Swagger Docs</span>
                <ExternalLink size={12} />
              </a>
            </li>
            <li>
              <a href="/health" target="_blank" rel="noreferrer" className="external-link">
                <span>Kiểm Tra Server (Health)</span>
                <ExternalLink size={12} />
              </a>
            </li>
            <li>
              <a href="https://github.com/thnh23/HeThongOTTv2" target="_blank" rel="noreferrer" className="external-link">
                <span>Mã Nguồn Mở GitHub</span>
                <ExternalLink size={12} />
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Footer Bottom Bar */}
      <div className="footer-bottom">
        <div className="footer-bottom-container">
          <div className="footer-copyright">
            © 2026 Khoa Công nghệ Thông tin — Trường Đại học Công nghệ, ĐHQGHN (VNU-UET). All rights reserved.
          </div>
          <div className="footer-version-tag">
            <span>Phiên bản 2.1.0</span>
            <span>•</span>
            <span>Swiss Tournament Arena</span>
            <span>•</span>
            <span style={{ color: 'var(--emerald-600)', fontWeight: 700 }}>Clean Light Theme</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
