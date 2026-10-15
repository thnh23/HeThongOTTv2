import React, { useState, useEffect } from 'react';
import { Clock, AlertCircle } from 'lucide-react';
import './Countdown.css';

export function Countdown({ targetDate = '2026-11-20T23:59:59', title = 'Hạn Chót Nộp Gói Bot Vòng Bảng' }) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    const calculateTime = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((difference / 1000 / 60) % 60);
      const seconds = Math.floor((difference / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className="countdown-widget glass-card">
      <div className="countdown-header">
        <div className="countdown-title-wrap">
          <Clock size={16} color="var(--cyan-400)" />
          <span className="countdown-title">{title}</span>
        </div>
        <span className="countdown-deadline-tag">23:59 • 20/11/2026</span>
      </div>

      {timeLeft.isExpired ? (
        <div className="countdown-expired">
          <AlertCircle size={18} color="var(--amber-400)" />
          <span>Cổng nộp bài đợt 1 đã kết thúc. Vui lòng theo dõi lịch đấu vòng bảng!</span>
        </div>
      ) : (
        <div className="countdown-boxes-grid">
          <div className="countdown-box">
            <span className="countdown-num">{String(timeLeft.days).padStart(2, '0')}</span>
            <span className="countdown-label">Ngày</span>
          </div>
          <span className="countdown-separator">:</span>
          <div className="countdown-box">
            <span className="countdown-num">{String(timeLeft.hours).padStart(2, '0')}</span>
            <span className="countdown-label">Giờ</span>
          </div>
          <span className="countdown-separator">:</span>
          <div className="countdown-box">
            <span className="countdown-num">{String(timeLeft.minutes).padStart(2, '0')}</span>
            <span className="countdown-label">Phút</span>
          </div>
          <span className="countdown-separator">:</span>
          <div className="countdown-box">
            <span className="countdown-num highlight-sec">{String(timeLeft.seconds).padStart(2, '0')}</span>
            <span className="countdown-label">Giây</span>
          </div>
        </div>
      )}
    </div>
  );
}
