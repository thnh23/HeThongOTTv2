import React from "react";
import { Link } from "react-router-dom";
import { Compass, Home, ArrowLeft } from "lucide-react";
import "./NotFoundPage.css";

export function NotFoundPage() {
  return (
    <div className="notfound-container">
      <div className="notfound-card">
        <div className="notfound-code">404</div>
        <div className="notfound-icon">
          <Compass size={44} />
        </div>
        <h1 className="notfound-title">Không Tìm Thấy Trang</h1>
        <p className="notfound-desc">
          Đường dẫn bạn yêu cầu không tồn tại hoặc đã được di chuyển trong hệ thống giải đấu OTTv2.
        </p>

        <div className="notfound-actions">
          <Link to="/" className="btn-notfound-home">
            <Home size={18} />
            Trang Chủ Giải Đấu
          </Link>
          <button onClick={() => window.history.back()} className="btn-notfound-back">
            <ArrowLeft size={18} />
            Quay Lại
          </button>
        </div>
      </div>
    </div>
  );
}
