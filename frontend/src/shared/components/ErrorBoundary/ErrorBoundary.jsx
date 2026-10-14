import React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import "./ErrorBoundary.css";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("UI Uncaught Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-wrapper">
          <div className="error-boundary-card">
            <div className="error-boundary-icon-wrapper">
              <AlertTriangle size={48} className="error-boundary-icon" />
            </div>
            <h1 className="error-boundary-title">Đã xảy ra sự cố giao diện</h1>
            <p className="error-boundary-desc">
              Một thành phần giao diện gặp lỗi không mong muốn. Dữ liệu ván đấu và tài khoản của bạn vẫn an toàn trên máy chủ.
            </p>

            {this.state.error && (
              <details className="error-boundary-details">
                <summary>Chi tiết kỹ thuật</summary>
                <pre>{this.state.error.toString()}</pre>
              </details>
            )}

            <div className="error-boundary-actions">
              <button onClick={this.handleReload} className="btn-error-reload">
                <RefreshCw size={18} />
                Tải lại trang
              </button>
              <button onClick={this.handleGoHome} className="btn-error-home">
                <Home size={18} />
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
