import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LangProvider } from './context/LangContext'
import ProtectedRoute from './components/ProtectedRoute'
import PWAInstallBanner from './components/PWAInstallBanner'
import Layout from './components/Layout'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import CollectionPage from './pages/CollectionPage'
import DuplicatesPage from './pages/DuplicatesPage'
import TradesPage from './pages/TradesPage'
import ChatPage from './pages/ChatPage'
import PremiumPage from './pages/PremiumPage'
import VerificadoPage from './pages/VerificadoPage'

export default function App() {
  return (
    <BrowserRouter>
      <LangProvider>
      <PWAInstallBanner />
      <AuthProvider>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/verificado" element={<VerificadoPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="coleccion" element={<CollectionPage />} />
            <Route path="duplicados" element={<DuplicatesPage />} />
            <Route path="intercambios" element={<TradesPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="chat/:conversationId" element={<ChatPage />} />
            <Route path="premium" element={<PremiumPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  )
}
