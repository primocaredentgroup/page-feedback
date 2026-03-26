import './App.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'

const LOREM = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer mauris eu nibh euismod gravida.`

const DEMO_PAGES = [
  {
    id: 'page-1',
    title: 'Pagina uno',
    url: 'https://demo.page-feedback.app/contenuti/primo?src=nav',
  },
  {
    id: 'page-2',
    title: 'Pagina due',
    url: 'https://demo.page-feedback.app/contenuti/secondo?src=nav',
  },
  {
    id: 'page-3',
    title: 'Pagina tre',
    url: 'https://demo.page-feedback.app/contenuti/terzo?src=nav',
  },
] as const

type RouteId = (typeof DEMO_PAGES)[number]['id'] | 'feedbacks'

const MOODS = [
  { rating: 1 as const, emoji: '😞', label: 'Scontento' },
  { rating: 2 as const, emoji: '😐', label: 'Così così' },
  { rating: 3 as const, emoji: '😊', label: 'Contento' },
]

function normalizeUrl (url: string) {
  return url.trim().split('?')[0]?.trim() ?? ''
}

function moodStars (rating: number) {
  const r = Math.min(Math.max(rating, 0), 3)
  return `${'★'.repeat(r)}${'☆'.repeat(3 - r)}`
}

function pageTitleForNormalizedUrl (normalizedUrl: string) {
  const page = DEMO_PAGES.find((p) => normalizeUrl(p.url) === normalizedUrl)
  return page?.title ?? normalizedUrl
}

type FeedbackDialogProps = {
  open: boolean
  pageUrl: string
  pageTitle: string
  startAt: 'form' | 'thread'
  presetRating: 1 | 2 | 3 | null
  onClose: () => void
}

function FeedbackDialog ({
  open,
  pageUrl,
  pageTitle,
  startAt,
  presetRating,
  onClose,
}: FeedbackDialogProps) {
  const myFeedback = useQuery(api.example.getMyFeedback, { url: pageUrl })
  const comments = useQuery(
    api.example.listComments,
    myFeedback
      ? { threadId: myFeedback.threadId, limit: 50 }
      : 'skip',
  )
  const upsertFeedback = useMutation(api.example.upsertFeedback)
  const addComment = useMutation(api.example.addComment)
  const toggleReaction = useMutation(api.example.toggleReaction)

  const [step, setStep] = useState<'form' | 'thread'>('form')
  const [selectedRating, setSelectedRating] = useState<1 | 2 | 3>(3)
  const [optionalNote, setOptionalNote] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [editRating, setEditRating] = useState<1 | 2 | 3>(3)
  const [editNote, setEditNote] = useState('')
  const [isUpdatingRating, setIsUpdatingRating] = useState(false)

  const resetFormState = useCallback(() => {
    setStep('form')
    setSelectedRating(3)
    setOptionalNote('')
    setReplyBody('')
    setEditRating(3)
    setEditNote('')
  }, [])

  const handleClose = useCallback(() => {
    resetFormState()
    onClose()
  }, [onClose, resetFormState])

  useEffect(() => {
    if (!open) {
      resetFormState()
      return
    }

    setReplyBody('')
    if (startAt === 'thread') {
      setStep('thread')
    } else {
      setStep('form')
      if (presetRating !== null) {
        setSelectedRating(presetRating)
      } else {
        if (myFeedback) {
          setSelectedRating(myFeedback.rating)
        }
      }

      setOptionalNote(myFeedback?.note ?? '')
    }
  }, [open, startAt, presetRating, pageUrl, resetFormState, myFeedback])

  useEffect(() => {
    if (!open || !myFeedback) {
      return
    }

    setEditRating(myFeedback.rating)
    setEditNote(myFeedback.note)
  }, [
    open,
    myFeedback?.threadId,
    myFeedback?.version,
    myFeedback?.rating,
    myFeedback?.note,
    myFeedback,
  ])

  const visibleComments = useMemo(
    () => comments?.filter((row) => !row.comment.isDeleted) ?? [],
    [comments],
  )

  const feedbackLoading = myFeedback === undefined
  const hasFeedback = myFeedback !== null && myFeedback !== undefined

  const showForm =
    startAt === 'form' && step === 'form'

  const showThread =
    hasFeedback && step === 'thread'

  const savedMoodOnServer =
    myFeedback ? myFeedback.rating : null

  const ratingDirty = Boolean(
    showThread &&
    myFeedback &&
    (editRating !== savedMoodOnServer ||
      editNote.trim() !== myFeedback.note.trim()),
  )

  async function handleSubmitFeedback () {
    setIsSaving(true)
    try {
      await upsertFeedback({
        url: pageUrl,
        rating: selectedRating,
        note: optionalNote.trim(),
      })
      setStep('thread')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleAddReply () {
    if (!myFeedback || !replyBody.trim()) {
      return
    }

    await addComment({
      threadId: myFeedback.threadId,
      body: replyBody.trim(),
    })
    setReplyBody('')
  }

  async function handleUpdateRating () {
    if (!myFeedback) {
      return
    }

    setIsUpdatingRating(true)
    try {
      await upsertFeedback({
        url: pageUrl,
        rating: editRating,
        note: editNote.trim(),
      })
    } finally {
      setIsUpdatingRating(false)
    }
  }

  if (!open) {
    return null
  }

  return (
    <div
      className='dialogOverlay'
      role='presentation'
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div
        className='dialogPanel'
        role='dialog'
        aria-modal='true'
        aria-labelledby='feedback-dialog-title'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='dialogHeader'>
          <h2 id='feedback-dialog-title' className='dialogTitle'>
            Feedback · {pageTitle}
          </h2>
          <button
            type='button'
            className='dialogClose'
            onClick={handleClose}
            aria-label='Chiudi'
          >
            ×
          </button>
        </div>

        {showForm && (
          <div className='dialogSection'>
            <p className='dialogHint'>
              Hai scelto{' '}
              <strong>
                {MOODS.find((m) => m.rating === selectedRating)?.emoji}{' '}
                {moodStars(selectedRating)}
              </strong>{' '}
              ({selectedRating} stell{selectedRating === 1 ? 'a' : 'e'} su 3).
            </p>
            <div className='moodRowDialog' role='group' aria-label='Cambia valutazione'>
              {MOODS.map((m) => (
                <button
                  key={m.rating}
                  type='button'
                  className={`moodBtn ${selectedRating === m.rating ? 'moodBtnActive' : ''}`}
                  onClick={() => setSelectedRating(m.rating)}
                  title={m.label}
                >
                  <span className='moodEmoji'>{m.emoji}</span>
                  <span className='moodStarsSmall'>{moodStars(m.rating)}</span>
                </button>
              ))}
            </div>
            <label className='fieldLabel' htmlFor='optional-note'>
              Commento (facoltativo)
            </label>
            <textarea
              id='optional-note'
              className='dialogTextarea'
              rows={3}
              value={optionalNote}
              onChange={(e) => setOptionalNote(e.target.value)}
              placeholder='Aggiungi un commento alla tua valutazione…'
            />
            <button
              type='button'
              className='primaryBtn'
              disabled={isSaving}
              onClick={handleSubmitFeedback}
            >
              {isSaving ? 'Salvataggio…' : 'Invia feedback'}
            </button>
          </div>
        )}

        {startAt === 'thread' && !feedbackLoading && !hasFeedback && (
          <p className='dialogEmpty'>
            Non hai ancora lasciato un feedback su questa pagina. Scegli un’emoji
            nella barra in basso.
          </p>
        )}

        {startAt === 'thread' && feedbackLoading && (
          <p className='dialogEmpty muted'>Caricamento…</p>
        )}

        {showThread && (
          <div className='dialogSection threadSection'>
            <h3 className='sectionTitle'>La tua valutazione</h3>
            <p className='dialogHint' style={{ marginBottom: '0.65rem' }}>
              Quella salvata è evidenziata; puoi cambiare faccia o testo e
              salvare di nuovo (crea una nuova versione).
            </p>
            <div
              className='moodRowDialog'
              role='group'
              aria-label='Modifica valutazione'
            >
              {MOODS.map((m) => {
                const isSavedOnServer = savedMoodOnServer === m.rating
                const isSelected = editRating === m.rating

                return (
                  <button
                    key={m.rating}
                    type='button'
                    className={`moodBtn ${isSelected ? 'moodBtnActive' : ''} ${isSavedOnServer ? 'moodBtnSaved' : ''}`}
                    onClick={() => setEditRating(m.rating)}
                    title={m.label}
                    aria-pressed={isSelected}
                  >
                    <span className='moodEmoji'>{m.emoji}</span>
                    <span className='moodStarsSmall'>{moodStars(m.rating)}</span>
                  </button>
                )
              })}
            </div>
            <label className='fieldLabel' htmlFor='edit-note'>
              Commento iniziale (facoltativo)
            </label>
            <textarea
              id='edit-note'
              className='dialogTextarea'
              rows={3}
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              placeholder='Testo della nota collegata al feedback…'
            />
            <button
              type='button'
              className='primaryBtn small'
              disabled={isUpdatingRating || !ratingDirty}
              onClick={handleUpdateRating}
            >
              {isUpdatingRating ? 'Salvataggio…' : 'Aggiorna valutazione'}
            </button>
            {!ratingDirty && (
              <p className='muted' style={{ margin: '0.5rem 0 0', fontSize: '0.8rem' }}>
                Versione salvata: {myFeedback.version} ·{' '}
                <span className='noteStars'>{moodStars(savedMoodOnServer ?? editRating)}</span>
                {!myFeedback.note.trim() && (
                  <span> (nessun testo aggiunto)</span>
                )}
              </p>
            )}

            <h3 className='sectionTitle' style={{ marginTop: '1.25rem' }}>
              Thread
            </h3>
            <ul className='threadList'>
              {visibleComments.map(({ comment, reactions }) => (
                <li key={comment._id} className='threadItem'>
                  <div className='threadMeta'>{comment.authorId}</div>
                  <div>{comment.body}</div>
                  <div className='reactionRow'>
                    {['👍', '❤️', '👀'].map((emoji) => {
                      const r = reactions.find((x) => x.emoji === emoji)
                      return (
                        <button
                          key={emoji}
                          type='button'
                          className='reactionChip'
                          onClick={() =>
                            void toggleReaction({
                              commentId: comment._id,
                              emoji,
                            })}
                        >
                          {emoji} {r?.count ?? 0}
                        </button>
                      )
                    })}
                  </div>
                </li>
              ))}
              {visibleComments.length === 0 && (
                <li className='muted' style={{ fontStyle: 'italic' }}>
                  Nessun messaggio nel thread.
                </li>
              )}
            </ul>
            <label className='fieldLabel' htmlFor='thread-reply'>
              Rispondi nel thread
            </label>
            <textarea
              id='thread-reply'
              className='dialogTextarea'
              rows={2}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder='Scrivi un messaggio…'
            />
            <button type='button' className='secondaryBtn' onClick={handleAddReply}>
              Pubblica
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function FeedbackDock ({
  pageUrl,
  pageTitle,
  onOpenDialog,
}: {
  pageUrl: string
  pageTitle: string
  onOpenDialog: (opts: {
    startAt: 'form' | 'thread'
    presetRating: 1 | 2 | 3 | null
  }) => void
}) {
  const myFeedback = useQuery(api.example.getMyFeedback, { url: pageUrl })
  const comments = useQuery(
    api.example.listComments,
    myFeedback
      ? { threadId: myFeedback.threadId, limit: 50 }
      : 'skip',
  )

  const commentCount =
    comments?.filter((row) => !row.comment.isDeleted).length ?? 0

  const savedMood =
    myFeedback !== undefined && myFeedback !== null
      ? myFeedback.rating
      : null

  return (
    <footer className='feedbackDock'>
      <div className='dockInner'>
        <span className='dockLabel'>Lascia un feedback</span>
        <div className='moodRow' role='group' aria-label='Valutazione rapida'>
          {MOODS.map((m) => (
            <button
              key={m.rating}
              type='button'
              className={`moodBtn ${savedMood === m.rating ? 'moodBtnSaved' : ''}`}
              title={m.label}
              aria-pressed={savedMood === m.rating}
              onClick={() =>
                onOpenDialog({ startAt: 'form', presetRating: m.rating })}
            >
              <span className='moodEmoji'>{m.emoji}</span>
              <span className='moodStarsSmall'>{moodStars(m.rating)}</span>
            </button>
          ))}
        </div>
        <button
          type='button'
          className='commentBadge'
          title='Apri thread e commenti'
          onClick={() => onOpenDialog({ startAt: 'thread', presetRating: null })}
        >
          💬
          <span className='badgeCount'>{myFeedback ? commentCount : '—'}</span>
        </button>
      </div>
    </footer>
  )
}

function ContentPage ({
  page,
  onOpenFeedback,
}: {
  page: (typeof DEMO_PAGES)[number]
  onOpenFeedback: (opts: {
    startAt: 'form' | 'thread'
    presetRating: 1 | 2 | 3 | null
  }) => void
}) {
  return (
    <article className='contentPage'>
      <h1>{page.title}</h1>
      <p className='urlLine'>
        <code>{page.url}</code>
      </p>
      <div className='loremBody'>
        {LOREM.split('\n\n').map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
      <FeedbackDock
        pageUrl={page.url}
        pageTitle={page.title}
        onOpenDialog={onOpenFeedback}
      />
    </article>
  )
}

function FeedbacksPage ({
  onOpenThread,
}: {
  onOpenThread: (pageUrl: string, pageTitle: string) => void
}) {
  const threads = useQuery(api.example.listMyFeedbackThreads, { limit: 50 })
  const [expanded, setExpanded] = useState<string | null>(null)

  const avgSmile =
    threads && threads.length > 0
      ? threads.reduce((acc, t) => acc + t.rating, 0) / threads.length
      : null

  return (
    <div className='feedbacksPage'>
      <h1>Feedbacks</h1>
      <p className='lead'>
        Tutti i feedback che hai lasciato sulle pagine demo. La media è calcolata
        sulle stelle del sorriso (1–3).
      </p>

      <div className='avgCard'>
        <span className='avgLabel'>Media sorrisi</span>
        <span className='avgValue'>
          {avgSmile === null ? '—' : avgSmile.toFixed(2)}
        </span>
        <span className='avgMax'>/ 3</span>
      </div>

      {!threads?.length && (
        <p className='muted'>Nessun feedback ancora. Visita una pagina e scegli un’emoji.</p>
      )}

      <ul className='feedbackCards'>
        {threads?.map((row) => {
          const title = pageTitleForNormalizedUrl(row.normalizedUrl)
          const isOpen = expanded === row.threadId
          return (
            <li key={row.threadId} className='feedbackCard'>
              <div className='cardRow'>
                <div>
                  <div className='cardTitle'>{title}</div>
                  <div className='cardUrl'>
                    <code>{row.normalizedUrl}</code>
                  </div>
                </div>
                <div className='cardStars'>{moodStars(row.rating)}</div>
              </div>
              <div className='cardNote'>
                <strong>Nota iniziale:</strong>{' '}
                {row.note.trim() ? row.note : (
                  <span className='muted'>(vuota)</span>
                )}
              </div>
              <div className='cardActions'>
                <button
                  type='button'
                  className='textLinkBtn'
                  onClick={() =>
                    setExpanded(isOpen ? null : row.threadId)}
                >
                  {isOpen ? 'Nascondi dettagli' : 'Vedi nota e pagina'}
                </button>
                <button
                  type='button'
                  className='primaryBtn small'
                  onClick={() => {
                    const page = DEMO_PAGES.find(
                      (p) => normalizeUrl(p.url) === row.normalizedUrl,
                    )
                    const url = page?.url ?? row.normalizedUrl
                    onOpenThread(url, title)
                  }}
                >
                  Apri thread
                </button>
              </div>
              {isOpen && (
                <p className='cardMeta muted'>
                  Versione {row.version} · aggiornato{' '}
                  {new Date(row.updatedAt).toLocaleString('it-IT')}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function App () {
  const [route, setRoute] = useState<RouteId>('page-1')
  const [dialog, setDialog] = useState<{
    open: boolean
    pageUrl: string
    pageTitle: string
    startAt: 'form' | 'thread'
    presetRating: 1 | 2 | 3 | null
  }>({
    open: false,
    pageUrl: DEMO_PAGES[0].url,
    pageTitle: DEMO_PAGES[0].title,
    startAt: 'form',
    presetRating: null,
  })

  const activePage = DEMO_PAGES.find((p) => p.id === route)

  const openFeedbackDialog = useCallback(
    (
      pageUrl: string,
      pageTitle: string,
      opts: { startAt: 'form' | 'thread'; presetRating: 1 | 2 | 3 | null },
    ) => {
      setDialog({
        open: true,
        pageUrl,
        pageTitle,
        startAt: opts.startAt,
        presetRating: opts.presetRating,
      })
    },
    [],
  )

  const closeDialog = useCallback(() => {
    setDialog((d) => ({ ...d, open: false }))
  }, [])

  return (
    <div className='appRoot'>
      <nav className='topNav' aria-label='Pagine demo'>
        {DEMO_PAGES.map((p) => (
          <button
            key={p.id}
            type='button'
            className={`navTab ${route === p.id ? 'navTabActive' : ''}`}
            onClick={() => setRoute(p.id)}
          >
            {p.title}
          </button>
        ))}
        <button
          type='button'
          className={`navTab ${route === 'feedbacks' ? 'navTabActive' : ''}`}
          onClick={() => setRoute('feedbacks')}
        >
          Feedbacks
        </button>
      </nav>

      <main className={`appMain ${activePage ? 'appMainWithDock' : ''}`}>
        {activePage && (
          <ContentPage
            page={activePage}
            onOpenFeedback={(opts) =>
              openFeedbackDialog(activePage.url, activePage.title, opts)}
          />
        )}
        {route === 'feedbacks' && (
          <FeedbacksPage
            onOpenThread={(pageUrl, pageTitle) => {
              openFeedbackDialog(pageUrl, pageTitle, {
                startAt: 'thread',
                presetRating: null,
              })
            }}
          />
        )}
      </main>

      <FeedbackDialog
        open={dialog.open}
        pageUrl={dialog.pageUrl}
        pageTitle={dialog.pageTitle}
        startAt={dialog.startAt}
        presetRating={dialog.presetRating}
        onClose={closeDialog}
      />
    </div>
  )
}

export default App
