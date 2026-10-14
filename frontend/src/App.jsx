import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/shared/context/AuthContext.jsx';
import { ToastProvider } from '@/shared/context/ToastContext.jsx';
import { Navbar } from '@/shared/components/Navbar/Navbar.jsx';
import { Footer } from '@/shared/components/Footer/Footer.jsx';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary/ErrorBoundary.jsx';
import { AppRouter } from '@/app/Router.jsx';
import '@/shared/styles/global.css';

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <div className="app-container">
              <Navbar />
              <main className="main-content">
                <AppRouter />
              </main>
              <Footer />
            </div>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}


export default App;
