import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../context/LangContext'
import { useProfile } from '../hooks/useProfile'
import { useUserProfiles } from '../hooks/useUserProfiles'

const MAX_BODY = 2000

function shortUser(id) {
  if (!id) return '—'
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

function orderedParticipants(a, b) {
  return a < b ? { small: a, large: b } : { small: b, large: a }
}

/** Pares (user_id) con al menos un intercambio mutuo activo respecto a mis publicaciones. */
function compatiblePartnerIds(myPosts, allPosts, myUserId) {
  const partners = new Set()
  const mine = (myPosts || []).filter((p) => p.user_id === myUserId && p.active !== false)
  const rows = allPosts || []
  for (const m of mine) {
    for (const t of rows) {
      if (t.user_id === myUserId || t.active === false) continue
      if (m.offer_card === t.want_card && m.want_card === t.offer_card) {
        partners.add(t.user_id)
      }
    }
  }
  return partners
}

function otherParticipant(conv, myId) {
  return conv.participant_small === myId ? conv.participant_large : conv.participant_small
}

export default function ChatPage() {
  const { conversationId } = useParams()
  const { user } = useAuth()
  const { t, locale } = useLang()
  const { isPro } = useProfile()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const messagesEndRef = useRef(null)

  const [myTrades, setMyTrades] = useState([])
  const [allTrades, setAllTrades] = useState([])
  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(null)
  const [convPreviews, setConvPreviews] = useState({})

  const partners = useMemo(
    () => compatiblePartnerIds(myTrades, allTrades, user.id),
    [myTrades, allTrades, user.id]
  )

  const allPartnerIds = useMemo(() => {
    const ids = new Set()
    for (const c of conversations) {
      ids.add(c.participant_small === user.id ? c.participant_large : c.participant_small)
    }
    for (const pid of partners) ids.add(pid)
    return [...ids]
  }, [conversations, partners, user.id])
  const userProfiles = useUserProfiles(allPartnerIds)

  const convByPartner = useMemo(() => {
    const m = new Map()
    for (const c of conversations) {
      m.set(otherParticipant(c, user.id), c)
    }
    return m
  }, [conversations, user.id])

  const loadLists = useCallback(async () => {
    const [mineRes, allRes, convRes] = await Promise.all([
      supabase
        .from('trade_posts')
        .select('id, user_id, offer_card, want_card, active')
        .eq('user_id', user.id),
      supabase
        .from('trade_posts')
        .select('id, user_id, offer_card, want_card, active')
        .eq('active', true),
      supabase
        .from('conversations')
        .select('id, participant_small, participant_large, created_at')
        .or(`participant_small.eq.${user.id},participant_large.eq.${user.id}`)
        .order('created_at', { ascending: false }),
    ])
    if (mineRes.error) throw mineRes.error
    if (allRes.error) throw allRes.error
    if (convRes.error) throw convRes.error
    setMyTrades(mineRes.data || [])
    setAllTrades(allRes.data || [])
    setConversations(convRes.data || [])
  }, [user.id])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        await loadLists()
      } catch (e) {
        if (alive) setError(e.message || t('err_load_data'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [loadLists, t])

  useEffect(() => {
    const ids = conversations.map((c) => c.id)
    if (!ids.length) {
      setConvPreviews({})
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error: err } = await supabase
        .from('messages')
        .select('conversation_id, body, sender_id, created_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: false })
        .limit(400)
      if (cancelled || err) return
      const map = {}
      for (const row of data || []) {
        if (!map[row.conversation_id]) map[row.conversation_id] = row
      }
      setConvPreviews(map)
    })()
    return () => {
      cancelled = true
    }
  }, [conversations])

  const loadMessages = useCallback(async (cid) => {
    if (!cid) return
    setThreadLoading(true)
    const { data, error: err } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, body, created_at')
      .eq('conversation_id', cid)
      .order('created_at', { ascending: true })
    setThreadLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setMessages(data || [])
  }, [])

  useEffect(() => {
    setError('')
  }, [conversationId])

  useEffect(() => {
    if (!conversationId) {
      setMessages([])
      return
    }
    loadMessages(conversationId)
  }, [conversationId, loadMessages])

  useEffect(() => {
    if (!conversationId) return
    const cid = conversationId
    const channel = supabase
      .channel(`messages:${cid}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${cid}`,
        },
        (payload) => {
          const row = payload.new
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev
            return [...prev, row]
          })
          setConvPreviews((prev) => ({
            ...prev,
            [row.conversation_id]: {
              conversation_id: row.conversation_id,
              body: row.body,
              sender_id: row.sender_id,
              created_at: row.created_at,
            },
          }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, conversationId])

  useEffect(() => {
    if (loading || !conversationId) return
    const exists = conversations.some((c) => c.id === conversationId)
    if (!exists) navigate('/chat', { replace: true })
  }, [loading, conversationId, conversations, navigate])

  const openOrCreateChat = useCallback(
    async (partnerId) => {
      setStarting(partnerId)
      setError('')
      const { small, large } = orderedParticipants(user.id, partnerId)
      const { data: inserted, error: insErr } = await supabase
        .from('conversations')
        .insert({ participant_small: small, participant_large: large })
        .select('id')
        .maybeSingle()

      if (!insErr && inserted?.id) {
        await loadLists()
        setStarting(null)
        navigate(`/chat/${inserted.id}`)
        return
      }

      if (insErr?.code === '23505' || insErr?.message?.includes('duplicate')) {
        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .eq('participant_small', small)
          .eq('participant_large', large)
          .maybeSingle()
        if (existing?.id) {
          await loadLists()
          setStarting(null)
          navigate(`/chat/${existing.id}`)
          return
        }
      }

      setError(insErr?.message || t('err_open_chat'))
      setStarting(null)
    },
    [user.id, navigate, loadLists, t]
  )

  const partnerFromQuery = searchParams.get('partner')

  useEffect(() => {
    if (!partnerFromQuery || loading || conversationId) return
    let cancelled = false
    void (async () => {
      try {
        await openOrCreateChat(partnerFromQuery)
      } finally {
        if (!cancelled) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev)
              next.delete('partner')
              return next
            },
            { replace: true }
          )
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [partnerFromQuery, loading, conversationId, openOrCreateChat, setSearchParams])

  async function sendMessage(e) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || !conversationId || text.length > MAX_BODY) return
    setDraft('')
    const { error: err } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: text,
    })
    if (err) {
      setError(err.message)
      setDraft(text)
    } else {
      setConvPreviews((prev) => ({
        ...prev,
        [conversationId]: {
          conversation_id: conversationId,
          body: text,
          sender_id: user.id,
          created_at: new Date().toISOString(),
        },
      }))
    }
  }

  const activeConv = conversations.find((c) => c.id === conversationId)
  const threadPartner = activeConv ? otherParticipant(activeConv, user.id) : null

  const partnersWithoutRoom = useMemo(() => {
    return [...partners].filter((pid) => !convByPartner.has(pid))
  }, [partners, convByPartner])

  if (loading) {
    return (
      <div className="chat-page">
        <div className="screen-loading">
          <div className="screen-loading__spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="chat-page">
      <div className={`chat-shell${conversationId ? ' chat-shell--thread-open' : ''}`}>
        <aside className="chat-sidebar" aria-label={t('conversations_aria')}>
          <div className="chat-sidebar__header">
            <h1 className="chat-sidebar__title">{t('chats_title')}</h1>
            <p className="chat-sidebar__subtitle">{t('chats_subtitle')}</p>
          </div>

          {error && !conversationId && <p className="form-error chat-inline-error">{error}</p>}

          <div className="chat-list">
            {conversations.length === 0 && partnersWithoutRoom.length === 0 && (
              <p className="chat-list__empty">{t('chat_empty')}</p>
            )}

            {conversations.map((c) => {
              const other = otherParticipant(c, user.id)
              const last = convPreviews[c.id]
              const active = c.id === conversationId
              const otherProfile = userProfiles[other]
              const avatarChar = otherProfile?.isPro
                ? otherProfile.avatarEmoji
                : other.slice(0, 2).toUpperCase()
              if (!isPro) {
                return (
                  <div
                    key={c.id}
                    className="chat-row chat-row--locked"
                    aria-disabled="true"
                  >
                    <div className="chat-row__avatar" aria-hidden="true">{avatarChar}</div>
                    <div className="chat-row__body">
                      <span className="chat-row__name">
                        {otherProfile?.isPro ? (
                          <span className="user-identity">
                            <span>{otherProfile.titulo}</span>
                            <span className="pro-badge">{t('pro_badge')}</span>
                          </span>
                        ) : <>{t('user_prefix')} {shortUser(other)}</>}
                      </span>
                      <span className="chat-row__preview chat-row__preview--locked">🔒 Pro</span>
                    </div>
                  </div>
                )
              }
              return (
                <Link
                  key={c.id}
                  to={`/chat/${c.id}`}
                  className={`chat-row${active ? ' chat-row--active' : ''}`}
                >
                  <div className="chat-row__avatar" aria-hidden="true">{avatarChar}</div>
                  <div className="chat-row__body">
                    <span className="chat-row__name">
                      {otherProfile?.isPro ? (
                        <span className="user-identity">
                          <span>{otherProfile.titulo}</span>
                          <span className="pro-badge">{t('pro_badge')}</span>
                        </span>
                      ) : <>{t('user_prefix')} {shortUser(other)}</>}
                    </span>
                    <span className="chat-row__preview">
                      {last
                        ? last.sender_id === user.id
                          ? `${t('my_message_prefix')}: ${last.body}`
                          : last.body
                        : t('no_messages')}
                    </span>
                  </div>
                </Link>
              )
            })}

            {partnersWithoutRoom.length > 0 && (
              <>
                <p className="chat-list__section">{t('compatible_section')}</p>
                {isPro ? (
                  partnersWithoutRoom.map((pid) => {
                    const pp = userProfiles[pid]
                    const pAvatar = pp?.isPro ? pp.avatarEmoji : pid.slice(0, 2).toUpperCase()
                    return (
                      <button
                        key={pid}
                        type="button"
                        className="chat-row chat-row--action"
                        disabled={starting === pid}
                        onClick={() => openOrCreateChat(pid)}
                      >
                        <div className="chat-row__avatar chat-row__avatar--new" aria-hidden="true">
                          {starting === pid ? '…' : pAvatar}
                        </div>
                        <div className="chat-row__body">
                          <span className="chat-row__name">
                            {pp?.isPro ? (
                              <span className="user-identity">
                                <span>{pp.titulo}</span>
                                <span className="pro-badge">{t('pro_badge')}</span>
                              </span>
                            ) : <>{t('user_prefix')} {shortUser(pid)}</>}
                          </span>
                          <span className="chat-row__preview">
                            {starting === pid ? t('opening') : t('tap_to_chat')}
                          </span>
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <div className="pro-gate pro-gate--compact">
                    <span className="pro-gate__icon">🔒</span>
                    <div className="pro-gate__body">
                      <strong className="pro-gate__title">{t('chat_pro_title')}</strong>
                      <p className="pro-gate__desc">{t('chat_pro_desc')}</p>
                    </div>
                    <Link to="/premium" className="btn btn--primary btn--sm pro-gate__btn">
                      {t('chat_pro_btn')}
                    </Link>
                  </div>
                )}
              </>
            )}

            {!isPro && conversations.length === 0 && partnersWithoutRoom.length === 0 && (
              <div className="pro-gate pro-gate--compact">
                <span className="pro-gate__icon">🔒</span>
                <div className="pro-gate__body">
                  <strong className="pro-gate__title">{t('chat_pro_title')}</strong>
                  <p className="pro-gate__desc">{t('chat_pro_desc')}</p>
                </div>
                <Link to="/premium" className="btn btn--primary btn--sm pro-gate__btn">
                  {t('chat_pro_btn')}
                </Link>
              </div>
            )}
          </div>
        </aside>

        <section className="chat-main" aria-label={t('messages_aria')}>
          {!isPro && conversationId ? (
            <div className="chat-placeholder chat-placeholder--locked">
              <span className="chat-placeholder__lock">🔒</span>
              <p>{t('chat_pro_locked_view')}</p>
              <Link to="/premium" className="btn btn--primary btn--sm">
                {t('chat_pro_btn')}
              </Link>
            </div>
          ) : !conversationId ? (
            <div className="chat-placeholder">
              <p>{t('chat_placeholder')}</p>
            </div>
          ) : (
            <>
              <header className="chat-main__header">
                <Link to="/chat" className="chat-main__back" aria-label={t('back_aria')}>
                  ←
                </Link>
                <div className="chat-main__peer">
                  <div className="chat-row__avatar" aria-hidden="true">
                    {threadPartner && userProfiles[threadPartner]?.isPro
                      ? userProfiles[threadPartner].avatarEmoji
                      : (threadPartner || '').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <strong className="chat-main__peer-name">
                      {threadPartner && userProfiles[threadPartner]?.isPro ? (
                        <span className="user-identity">
                          <span>{userProfiles[threadPartner].titulo}</span>
                          <span className="pro-badge">{t('pro_badge')}</span>
                        </span>
                      ) : threadPartner ? (
                        `${t('user_prefix')} ${shortUser(threadPartner)}`
                      ) : 'Chat'}
                    </strong>
                    <span className="chat-main__peer-status">{t('chat_compatible')}</span>
                  </div>
                </div>
              </header>

              {error && conversationId && (
                <p className="form-error chat-thread-error">{error}</p>
              )}

              <div className="chat-messages">
                {threadLoading ? (
                  <div className="chat-messages__loading">
                    <div className="screen-loading__spinner" />
                  </div>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender_id === user.id
                    return (
                      <div
                        key={m.id}
                        className={`chat-bubble-wrap${mine ? ' chat-bubble-wrap--mine' : ''}`}
                      >
                        <div className={`chat-bubble${mine ? ' chat-bubble--mine' : ''}`}>
                          <p className="chat-bubble__text">{m.body}</p>
                          <time className="chat-bubble__time" dateTime={m.created_at}>
                            {new Date(m.created_at).toLocaleTimeString(locale, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </time>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form className="chat-composer" onSubmit={sendMessage}>
                <input
                  type="text"
                  className="chat-composer__input"
                  placeholder={t('msg_placeholder')}
                  value={draft}
                  maxLength={MAX_BODY}
                  onChange={(e) => setDraft(e.target.value)}
                  autoComplete="off"
                  aria-label={t('msg_aria')}
                />
                <button
                  type="submit"
                  className="btn btn--primary chat-composer__send"
                  disabled={!draft.trim()}
                >
                  {t('btn_send')}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
