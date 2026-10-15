import React from 'react';
import { Routes, Route } from 'react-router-dom';

// Public barrel imports per frontend-architecture skill
import { HomePage } from '@/modules/home';
import { RulesPage } from '@/modules/rules';
import { LeaderboardPage } from '@/modules/leaderboard';
import { MatchesListPage, MatchDetailPage, LiveMatchPage, LiveHubPage } from '@/modules/matches';
import { SubmitPage } from '@/modules/submit';
import { LoginPage, RegisterPage } from '@/modules/auth';
import { AdminDashboardPage } from '@/modules/admin';
import { ProfilePage } from '@/modules/profile';
import { NotFoundPage } from '@/shared/pages/NotFoundPage.jsx';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/rules" element={<RulesPage />} />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/matches" element={<MatchesListPage />} />
      <Route path="/matches/:id" element={<MatchDetailPage />} />
      <Route path="/matches/:id/live" element={<LiveMatchPage />} />
      <Route path="/live" element={<LiveHubPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/submit" element={<SubmitPage />} />
      <Route path="/admin" element={<AdminDashboardPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

