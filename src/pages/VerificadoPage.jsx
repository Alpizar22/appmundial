import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useLang } from '../context/LangContext'

export default function VerificadoPage() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const errorParam = searchParams.get('error') || searchParams.get('error_description')
  const [hasError] = useState(Boolean(errorParam))

  useEffect(() => {
    const timer = setTimeout(() => navigate('/', { replace: true }), 5000)
    return () => clearTimeout(timer)
  }, [navigate])

  return (
    <div className="verified-page">
      <Helmet>
        <title>{hasError ? t('verified_error_title') : t('verified_title')} — whatif.lat</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="verified-card">
        <div className="verified-card__icon">{hasError ? '⚠️' : '✅'}</div>
        <h1 className="verified-card__title">{hasError ? t('verified_error_title') : t('verified_title')}</h1>
        <p className="verified-card__body">{hasError ? t('verified_error_body') : t('verified_body')}</p>
        <button type="button" className="btn btn--primary" onClick={() => navigate('/', { replace: true })}>
          {t('verified_btn')}
        </button>
      </div>
    </div>
  )
}
