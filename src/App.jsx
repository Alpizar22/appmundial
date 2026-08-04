import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LangProvider } from './context/LangContext'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import MomentoPage from './pages/MomentoPage'
import HistoriaPage from './pages/HistoriaPage'
import ExplorarPage from './pages/ExplorarPage'
import AuthPage from './pages/AuthPage'
import VerificadoPage from './pages/VerificadoPage'

export default function App() {
  return (
    <BrowserRouter>
      <LangProvider>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/verificado" element={<VerificadoPage />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="momento/:slug" element={<MomentoPage />} />
              <Route path="historia/:id" element={<HistoriaPage />} />
              <Route path="explorar" element={<ExplorarPage />} />
              <Route path="*" element={<HomePage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </LangProvider>
    </BrowserRouter>
  )
}
