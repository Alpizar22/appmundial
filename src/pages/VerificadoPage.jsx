import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../context/LangContext'

export default function VerificadoPage() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Supabase may append ?error=... on failure
  const errorParam = searchParams.get('error') || searchParams.get('error_description')
  const [hasError] = useState(Boolean(errorParam))

  // Auto-redirect to /auth after 6 seconds
  useEffect(() => {
    const timer = setTimeout(() => navigate('/auth', { replace: true }), 6000)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="verified-page">
      <div className="verified-card">
        <div className="verified-card__icon">{hasError ? '⚠️' : '✅'}</div>
        <h1 className="verified-card__title">
          {hasError ? t('verified_error_title') : t('verified_title')}
        </h1>
        <p className="verified-card__body">
          {hasError ? t('verified_error_body') : t('verified_body')}
        </p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => navigate('/auth', { replace: true })}
        >
          {hasError ? t('verified_error_btn') : t('verified_btn')}
        </button>
        <p className="verified-card__auto">
          {/* pequeño indicador de auto-redirect */}
        </p>
      </div>
    </div>
  )
}
