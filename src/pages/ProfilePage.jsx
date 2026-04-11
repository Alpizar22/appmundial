import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useProfile } from '../hooks/useProfile'
import { THEMES, useTheme } from '../hooks/useTheme'

const TITULOS_PREDEFINIDOS = [
  { emoji: '🐐', texto: 'El Goat' },
  { emoji: '⚽', texto: 'Pichichi' },
  { emoji: '🏆', texto: 'Leyenda' },
  { emoji: '🌟', texto: 'Mito' },
  { emoji: '🔥', texto: 'Crack' },
  { emoji: '👑', texto: 'Capitán' },
  { emoji: '🎯', texto: 'Goleador' },
  { emoji: '⚡', texto: 'Rayo' },
]

const AVATAR_EMOJIS = [
  '🐐', '🦅', '🦁', '🐺', '🦊', '🐯', '🦈', '🦋',
  '⚽', '🏆', '🥅', '🎯', '🔥', '💪', '👑', '⚡', '🌟',
  '🐢', '🦥', '🦔', '😎', '🤩', '🏃', '🧠',
]

export default function ProfilePage() {
  const { user } = useAuth()
  const { t } = useLang()
  const { isPro, titulo: savedTitulo, avatarEmoji: savedAvatar, loading } = useProfile()
  const { theme, setTheme, themes } = useTheme(isPro)

  const [titulo, setTitulo] = useState('')
  const [avatarEmoji, setAvatarEmoji] = useState('⚽')
  const [customTitulo, setCustomTitulo] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Initialize from profile once loaded
  useEffect(() => {
    if (loading) return
    setAvatarEmoji(savedAvatar || '⚽')
    const isPredefined = TITULOS_PREDEFINIDOS.some((t) => t.texto === savedTitulo)
    if (isPredefined || !savedTitulo) {
      setTitulo(savedTitulo || 'Coleccionista')
      setUseCustom(false)
    } else {
      setCustomTitulo(savedTitulo || '')
      setUseCustom(true)
    }
  }, [loading, savedTitulo, savedAvatar])

  const displayTitulo = useCustom ? customTitulo || 'Coleccionista' : titulo || 'Coleccionista'

  async function handleSave() {
    if (!isPro) return
    setSaving(true)
    setSaved(false)
    setSaveError('')
    const finalTitulo = (useCustom ? customTitulo.trim() : titulo) || 'Coleccionista'
    const { error } = await supabase
      .from('profiles')
      .upsert(
        { id: user.id, titulo: finalTitulo, avatar_emoji: avatarEmoji },
        { onConflict: 'id' }
      )
    setSaving(false)
    if (error) {
      setSaveError(t('profile_save_error'))
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  if (loading) {
    return (
      <div className="screen-loading">
        <div className="screen-loading__spinner" />
      </div>
    )
  }

  if (!isPro) {
    return (
      <div className="page profile">
        <header className="page-header">
          <h1>{t('profile_title')}</h1>
          <p>{t('profile_subtitle')}</p>
        </header>
        <div className="pro-gate profile-gate">
          <span className="pro-gate__icon">🔒</span>
          <div className="pro-gate__body">
            <strong className="pro-gate__title">{t('profile_pro_locked')}</strong>
          </div>
          <Link to="/premium" className="btn btn--primary">{t('profile_get_pro_btn')}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page profile">
      <header className="page-header">
        <h1>{t('profile_title')}</h1>
        <p>{t('profile_subtitle')}</p>
      </header>

      {/* ── Preview card ── */}
      <section className="player-card-wrap">
        <h2 className="profile-section__label">{t('profile_preview_title')}</h2>
        <div className="player-card">
          <span className="player-card__avatar" aria-hidden="true">{avatarEmoji}</span>
          <strong className="player-card__title">{displayTitulo}</strong>
          <span className="pro-badge player-card__badge">{t('pro_badge')}</span>
          <span className="player-card__email">{user?.email}</span>
        </div>
      </section>

      {/* ── Avatar picker ── */}
      <section className="profile-section">
        <h2 className="profile-section__label">{t('profile_avatar_section')}</h2>
        <div className="avatar-grid">
          {AVATAR_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              className={`avatar-btn${avatarEmoji === em ? ' avatar-btn--active' : ''}`}
              onClick={() => setAvatarEmoji(em)}
              aria-label={em}
              aria-pressed={avatarEmoji === em}
            >
              {em}
            </button>
          ))}
        </div>
      </section>

      {/* ── Title picker ── */}
      <section className="profile-section">
        <h2 className="profile-section__label">{t('profile_title_section')}</h2>
        <div className="titulo-grid">
          {TITULOS_PREDEFINIDOS.map(({ emoji, texto }) => {
            const active = !useCustom && titulo === texto
            return (
              <button
                key={texto}
                type="button"
                className={`titulo-chip${active ? ' titulo-chip--active' : ''}`}
                onClick={() => { setTitulo(texto); setUseCustom(false) }}
                aria-pressed={active}
              >
                <span>{emoji}</span>
                <span>{texto}</span>
              </button>
            )
          })}
        </div>
        <label className="profile-custom-label">
          <span className="profile-custom-label__text">{t('profile_title_custom_label')}</span>
          <input
            type="text"
            className={`profile-custom-input${useCustom ? ' profile-custom-input--active' : ''}`}
            value={customTitulo}
            maxLength={15}
            placeholder={t('profile_title_custom_placeholder')}
            onFocus={() => setUseCustom(true)}
            onChange={(e) => { setCustomTitulo(e.target.value); setUseCustom(true) }}
          />
        </label>
      </section>

      {/* ── Theme picker ── */}
      <section className="profile-section">
        <h2 className="profile-section__label">{t('profile_theme_section')}</h2>
        <div className="theme-picker__grid">
          {Object.entries(themes).map(([key, info]) => {
            const active = theme === key
            return (
              <button
                key={key}
                type="button"
                className={`theme-swatch${active ? ' theme-swatch--active' : ''}`}
                onClick={() => setTheme(key)}
                title={t(`theme_${key}`)}
              >
                <span className="theme-swatch__emoji">{info.emoji}</span>
                <span className="theme-swatch__label">{t(`theme_${key}`)}</span>
                {active && <span className="theme-swatch__check">✓</span>}
              </button>
            )
          })}
        </div>
      </section>

      {/* ── Save ── */}
      <div className="profile-save">
        {saveError && <p className="form-error">{saveError}</p>}
        {saved && <p className="form-success">{t('profile_saved')}</p>}
        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t('profile_saving') : t('profile_save_btn')}
        </button>
      </div>
    </div>
  )
}
