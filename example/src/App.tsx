import './App.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

const DEMO_OBJECTIVES: Record<
  string,
  Array<{
    description: string
    indicators: string[]
  }>
> = {
  'https://demo.page-feedback.app/contenuti/primo': [
    {
      description:
        'La pagina deve chiarire immediatamente il tema principale e il valore del contenuto.',
      indicators: [
        'Il titolo rende chiaro l argomento appena si apre la pagina.',
        'Le prime righe fanno capire a chi e` utile questo contenuto.',
      ],
    },
    {
      description:
        'La pagina deve dare una buona ragione per scorrere e approfondire.',
      indicators: [
        'L introduzione promette un beneficio concreto per chi legge.',
        'La struttura visiva fa intuire cosa si trovera` piu` sotto.',
      ],
    },
  ],
  'https://demo.page-feedback.app/contenuti/secondo': [
    {
      description:
        'La pagina deve aiutare l utente a capire cosa puo` fare subito dopo.',
      indicators: [
        'Esiste una call to action principale facile da riconoscere.',
        'Il passo successivo sembra coerente con il contenuto appena letto.',
      ],
    },
  ],
  'https://demo.page-feedback.app/contenuti/terzo': [
    {
      description:
        'La pagina deve far percepire che le informazioni sono credibili e ben curate.',
      indicators: [
        'Ci sono segnali che spiegano da dove arrivano le informazioni.',
        'Il tono e la struttura fanno percepire ordine e chiarezza.',
      ],
    },
  ],
}

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

function ObjectiveIndicatorsEditor ({
  objectiveId,
  editable,
}: {
  objectiveId: string
  editable: boolean
}) {
  const indicators = useQuery(api.example.listIndicatorsForObjective, { objectiveId })
  const upsertIndicator = useMutation(api.example.upsertIndicator)
  const [indicatorFormMode, setIndicatorFormMode] = useState<'none' | 'add' | 'edit'>('none')
  const [editingIndicatorId, setEditingIndicatorId] = useState<string | null>(null)
  const [indicatorFormDescription, setIndicatorFormDescription] = useState('')
  const [isSavingIndicator, setIsSavingIndicator] = useState(false)

  const nextIndicatorOrder = useMemo(() => {
    if (!indicators?.length) {
      return 0
    }
    return indicators.reduce((max, row) => Math.max(max, row.order), -1) + 1
  }, [indicators])

  useEffect(() => {
    setIndicatorFormMode('none')
    setEditingIndicatorId(null)
    setIndicatorFormDescription('')
  }, [objectiveId])

  function openAddIndicatorForm () {
    setIndicatorFormMode('add')
    setEditingIndicatorId(null)
    setIndicatorFormDescription('')
  }

  function openEditIndicatorForm (indicatorId: string, description: string) {
    setIndicatorFormMode('edit')
    setEditingIndicatorId(indicatorId)
    setIndicatorFormDescription(description)
  }

  function closeIndicatorForm () {
    setIndicatorFormMode('none')
    setEditingIndicatorId(null)
    setIndicatorFormDescription('')
  }

  async function handleSaveIndicatorForm () {
    const description = indicatorFormDescription.trim()
    if (!description) {
      return
    }
    setIsSavingIndicator(true)
    try {
      if (indicatorFormMode === 'add') {
        await upsertIndicator({
          objectiveId,
          description,
          order: nextIndicatorOrder,
        })
      } else if (
        indicatorFormMode === 'edit' &&
        editingIndicatorId !== null
      ) {
        const row = indicators?.find((i) => i._id === editingIndicatorId)
        await upsertIndicator({
          indicatorId: editingIndicatorId,
          objectiveId,
          description,
          order: row?.order ?? 0,
        })
      }
      closeIndicatorForm()
    } finally {
      setIsSavingIndicator(false)
    }
  }

  if (indicators === undefined) {
    return <p className='muted'>Caricamento indicatori…</p>
  }

  if (!editable) {
    if (indicators.length === 0) {
      return <p className='muted objectiveEmptyState'>Nessun indicatore ancora definito.</p>
    }
    return (
      <div className='objectiveIndicatorList'>
        {indicators.map((indicator, index) => (
          <article key={indicator._id} className='objectiveIndicatorCard'>
            <div className='objectiveIndicatorIndex'>{index + 1}</div>
            <div className='objectiveIndicatorBody'>
              <div className='objectiveIndicatorLabel'>Indicatore {index + 1}</div>
              <div className='objectiveIndicatorText'>{indicator.description}</div>
            </div>
          </article>
        ))}
      </div>
    )
  }

  return (
    <div className='indicatorEditor'>
      <div className='indicatorEditorToolbar'>
        <button
          type='button'
          className='textLinkBtn objectiveHeaderBtn'
          onClick={openAddIndicatorForm}
        >
          + Aggiungi indicatore
        </button>
      </div>

      {indicatorFormMode !== 'none' && (
        <div className='indicatorFormCard'>
          <h4 className='indicatorFormTitle'>
            {indicatorFormMode === 'add' ? 'Nuovo indicatore' : 'Modifica indicatore'}
          </h4>
          <label className='fieldLabel' htmlFor={`indicator-form-${objectiveId}`}>
            Descrizione
          </label>
          <textarea
            id={`indicator-form-${objectiveId}`}
            className='dialogTextarea'
            rows={3}
            value={indicatorFormDescription}
            onChange={(e) => setIndicatorFormDescription(e.target.value)}
            placeholder='Come capire se la pagina rispetta questo criterio…'
          />
          <div className='objectiveFormActions'>
            <button
              type='button'
              className='secondaryBtn'
              disabled={isSavingIndicator}
              onClick={closeIndicatorForm}
            >
              Annulla
            </button>
            <button
              type='button'
              className='primaryBtn primaryBtnInline'
              disabled={isSavingIndicator || !indicatorFormDescription.trim()}
              onClick={handleSaveIndicatorForm}
            >
              {isSavingIndicator ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </div>
      )}

      {indicators.length === 0 && indicatorFormMode === 'none' && (
        <p className='muted objectiveEmptyState'>Nessun indicatore ancora definito.</p>
      )}

      <div className='objectiveIndicatorList'>
        {indicators.map((indicator, index) => (
          <article key={indicator._id} className='objectiveIndicatorCard'>
            <div className='objectiveIndicatorIndex'>{index + 1}</div>
            <div className='objectiveIndicatorBody'>
              <div className='objectiveIndicatorRowHead'>
                <div className='objectiveIndicatorLabel'>Indicatore {index + 1}</div>
                <button
                  type='button'
                  className='textLinkBtn objectiveHeaderBtn'
                  onClick={() =>
                    openEditIndicatorForm(indicator._id, indicator.description)}
                >
                  Modifica
                </button>
              </div>
              <div className='objectiveIndicatorText'>{indicator.description}</div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function PageObjectivesContent ({
  pageUrl,
  pageTitle,
  inDialog = false,
}: {
  pageUrl: string
  pageTitle: string
  inDialog?: boolean
}) {
  const objectives = useQuery(api.example.listObjectivesForUrl, { url: pageUrl })
  const upsertObjective = useMutation(api.example.upsertObjective)
  const upsertIndicator = useMutation(api.example.upsertIndicator)
  const addObjectiveComment = useMutation(api.example.addObjectiveComment)
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null)
  const [detailSubTab, setDetailSubTab] = useState<'indicators' | 'thread'>('indicators')
  const [objectiveFormMode, setObjectiveFormMode] = useState<'none' | 'add' | 'edit'>('none')
  const [formDescription, setFormDescription] = useState('')
  const [isSavingObjective, setIsSavingObjective] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const seededUrlsRef = useRef<Set<string>>(new Set())
  const normalizedPageUrl = normalizeUrl(pageUrl)
  const objectiveSeed = useMemo(
    () => DEMO_OBJECTIVES[normalizedPageUrl] ?? [],
    [normalizedPageUrl],
  )

  const visibleObjectives = useMemo(
    () => objectives?.filter((objective) => objective.status === 'active') ?? [],
    [objectives],
  )

  const effectiveSelectedObjectiveId =
    selectedObjectiveId !== null &&
    visibleObjectives.some((objective) => objective._id === selectedObjectiveId)
      ? selectedObjectiveId
      : (visibleObjectives[0]?._id ?? null)

  const objectiveComments = useQuery(
    api.example.listObjectiveComments,
    effectiveSelectedObjectiveId
      ? { objectiveId: effectiveSelectedObjectiveId, limit: 50 }
      : 'skip',
  )

  const selectedObjective = visibleObjectives.find(
    (objective) => objective._id === effectiveSelectedObjectiveId,
  ) ?? null
  const visibleObjectiveComments = useMemo(
    () => objectiveComments?.filter((comment) => !comment.isDeleted) ?? [],
    [objectiveComments],
  )

  const nextObjectiveOrder = useMemo(() => {
    if (!objectives?.length) {
      return 0
    }
    return objectives.reduce((max, o) => Math.max(max, o.order), -1) + 1
  }, [objectives])

  useEffect(() => {
    setDetailSubTab('indicators')
  }, [effectiveSelectedObjectiveId])

  useEffect(() => {
    if (
      objectives === undefined ||
      objectives.length > 0 ||
      objectiveSeed.length === 0 ||
      seededUrlsRef.current.has(normalizedPageUrl)
    ) {
      return
    }

    seededUrlsRef.current.add(normalizedPageUrl)

    void (async () => {
      for (const [objectiveIndex, objectiveSeedRow] of objectiveSeed.entries()) {
        const objective = await upsertObjective({
          url: pageUrl,
          description: objectiveSeedRow.description,
          status: 'active',
          order: objectiveIndex,
        })

        for (const [indicatorIndex, indicatorDescription] of objectiveSeedRow.indicators.entries()) {
          await upsertIndicator({
            objectiveId: objective._id,
            description: indicatorDescription,
            order: indicatorIndex,
          })
        }
      }
    })()
  }, [
    normalizedPageUrl,
    objectiveSeed,
    objectives,
    pageUrl,
    upsertIndicator,
    upsertObjective,
  ])

  async function handleAddObjectiveComment () {
    if (!effectiveSelectedObjectiveId || !replyBody.trim()) {
      return
    }

    await addObjectiveComment({
      objectiveId: effectiveSelectedObjectiveId,
      body: replyBody.trim(),
    })
    setReplyBody('')
  }

  function openAddObjectiveForm () {
    setObjectiveFormMode('add')
    setFormDescription('')
  }

  function openEditObjectiveForm () {
    if (!selectedObjective) {
      return
    }
    setObjectiveFormMode('edit')
    setFormDescription(selectedObjective.description)
  }

  function closeObjectiveForm () {
    setObjectiveFormMode('none')
    setFormDescription('')
  }

  async function handleSaveObjectiveForm () {
    const description = formDescription.trim()
    if (!description) {
      return
    }
    setIsSavingObjective(true)
    try {
      if (objectiveFormMode === 'add') {
        const created = await upsertObjective({
          url: pageUrl,
          description,
          status: 'active',
          order: nextObjectiveOrder,
        })
        setSelectedObjectiveId(created._id)
      } else if (objectiveFormMode === 'edit' && selectedObjective) {
        await upsertObjective({
          objectiveId: selectedObjective._id,
          url: pageUrl,
          description,
          status: selectedObjective.status,
          order: selectedObjective.order,
        })
      }
      closeObjectiveForm()
    } finally {
      setIsSavingObjective(false)
    }
  }

  return (
    <section className={`objectivesPanel ${inDialog ? 'objectivesPanelInDialog' : ''}`}>
      <div className={`objectivesHeader ${inDialog ? 'objectivesHeaderWithActions' : ''}`}>
        <div>
          <h2 className='objectivesTitle'>Scopo della pagina</h2>
          <p className='objectivesLead'>
            Objectives e indicatori condivisi per discutere cosa dovrebbe ottenere
            <strong> {pageTitle}</strong>.
          </p>
        </div>
        {inDialog && (
          <div className='objectivesHeaderActions'>
            <button
              type='button'
              className='textLinkBtn objectiveHeaderBtn'
              onClick={openAddObjectiveForm}
            >
              + Aggiungi objective
            </button>
            <button
              type='button'
              className='textLinkBtn objectiveHeaderBtn'
              disabled={!selectedObjective}
              onClick={openEditObjectiveForm}
            >
              Modifica objective
            </button>
          </div>
        )}
      </div>

      {inDialog && objectiveFormMode !== 'none' && (
        <div className='objectiveFormCard'>
          <h3 className='sectionTitle'>
            {objectiveFormMode === 'add' ? 'Nuovo objective' : 'Modifica objective'}
          </h3>
          <label className='fieldLabel' htmlFor='objective-form-description'>
            Descrizione
          </label>
          <textarea
            id='objective-form-description'
            className='dialogTextarea'
            rows={3}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder='Cosa dovrebbe ottenere chi visita la pagina?'
          />
          <div className='objectiveFormActions'>
            <button
              type='button'
              className='secondaryBtn'
              disabled={isSavingObjective}
              onClick={closeObjectiveForm}
            >
              Annulla
            </button>
            <button
              type='button'
              className='primaryBtn primaryBtnInline'
              disabled={
                isSavingObjective ||
                !formDescription.trim()
              }
              onClick={handleSaveObjectiveForm}
            >
              {isSavingObjective ? 'Salvataggio…' : 'Salva'}
            </button>
          </div>
        </div>
      )}

      {objectives === undefined && (
        <p className='muted'>Caricamento objectives…</p>
      )}

      {objectives !== undefined && visibleObjectives.length === 0 && (
        <div className='objectiveEmptyPage'>
          <p className='muted'>
            Nessun objective definito ancora per questa pagina.
          </p>
          {inDialog && objectiveFormMode === 'none' && (
            <button type='button' className='primaryBtn' onClick={openAddObjectiveForm}>
              Crea il primo objective
            </button>
          )}
        </div>
      )}

      {visibleObjectives.length > 0 && (
        <div className='objectivesLayout'>
          <div
            className='objectiveTabs'
            role='tablist'
            aria-label='Objectives della pagina'
          >
            {visibleObjectives.map((objective, index) => {
              const isSelected = objective._id === effectiveSelectedObjectiveId
              return (
                <button
                  key={objective._id}
                  type='button'
                  role='tab'
                  aria-selected={isSelected}
                  className={`objectiveTab ${isSelected ? 'objectiveTabSelected' : ''}`}
                  onClick={() => setSelectedObjectiveId(objective._id)}
                >
                  <span className='objectiveTabIndex'>{index + 1}</span>
                  <span className='objectiveTabText'>
                    <span className='objectiveTabDescription objectiveTabDescriptionPrimary'>
                      {objective.description}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          <div className='objectiveDetailColumn'>
            {!selectedObjective && (
              <p className='muted'>Seleziona un objective per leggere il thread.</p>
            )}

            {selectedObjective && (
              <>
                <div
                  className='objectiveSubTabs'
                  role='tablist'
                  aria-label='Dettaglio objective'
                >
                  <button
                    type='button'
                    role='tab'
                    aria-selected={detailSubTab === 'indicators'}
                    className={`objectiveSubTab ${detailSubTab === 'indicators' ? 'objectiveSubTabSelected' : ''}`}
                    onClick={() => setDetailSubTab('indicators')}
                  >
                    Indicatori
                  </button>
                  <button
                    type='button'
                    role='tab'
                    aria-selected={detailSubTab === 'thread'}
                    className={`objectiveSubTab ${detailSubTab === 'thread' ? 'objectiveSubTabSelected' : ''}`}
                    onClick={() => setDetailSubTab('thread')}
                  >
                    Thread
                    <span className='objectiveSubTabBadge'>
                      {visibleObjectiveComments.length}
                    </span>
                  </button>
                </div>

                {detailSubTab === 'indicators' && (
                  <section className='objectiveSectionCard'>
                    <div className='objectiveSectionHeader'>
                      <div>
                        <p className='objectiveSectionLead'>
                          Parametri descrittivi per capire se la pagina sta centrando questo objective.
                        </p>
                      </div>
                    </div>
                    <ObjectiveIndicatorsEditor
                      objectiveId={selectedObjective._id}
                      editable={inDialog}
                    />
                  </section>
                )}

                {detailSubTab === 'thread' && (
                  <section className='objectiveSectionCard'>
                    <div className='objectiveSectionHeader'>
                      <div>
                        <p className='objectiveSectionLead'>
                          Thread condiviso per confrontarsi su chiarezza, limiti e possibili miglioramenti.
                        </p>
                      </div>
                    </div>

                    {objectiveComments === undefined && (
                      <p className='muted objectiveEmptyState'>Caricamento discussione…</p>
                    )}

                    {objectiveComments !== undefined && (
                      <>
                        <ul className='threadList objectiveThreadList'>
                          {visibleObjectiveComments.map((comment) => (
                            <li key={comment._id} className='threadItem objectiveThreadItem'>
                              <div className='threadMeta'>{comment.authorId}</div>
                              <div>{comment.body}</div>
                            </li>
                          ))}
                          {visibleObjectiveComments.length === 0 && (
                            <li className='muted objectiveEmptyState'>
                              Nessun messaggio ancora su questo objective.
                            </li>
                          )}
                        </ul>

                        <div className='objectiveComposer'>
                          <label
                            className='fieldLabel'
                            htmlFor={`objective-reply-${selectedObjective._id}`}
                          >
                            Aggiungi un contributo al thread
                          </label>
                          <textarea
                            id={`objective-reply-${selectedObjective._id}`}
                            className='dialogTextarea'
                            rows={3}
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            placeholder='Scrivi un feedback sullo scopo della pagina…'
                          />
                          <button
                            type='button'
                            className='secondaryBtn objectiveComposerBtn'
                            onClick={handleAddObjectiveComment}
                          >
                            Pubblica nel thread
                          </button>
                        </div>
                      </>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

type FeedbackDialogProps = {
  open: boolean
  pageUrl: string
  pageTitle: string
  startAt: 'form' | 'thread' | 'objective'
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
  const setFeedbackSolved = useMutation(api.example.setFeedbackSolved)

  const [step, setStep] = useState<'form' | 'thread' | 'objective'>('form')
  const [selectedRating, setSelectedRating] = useState<1 | 2 | 3>(3)
  const [optionalNote, setOptionalNote] = useState('')
  const [replyBody, setReplyBody] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [editRating, setEditRating] = useState<1 | 2 | 3>(3)
  const [editNote, setEditNote] = useState('')
  const [isUpdatingRating, setIsUpdatingRating] = useState(false)
  const [isUpdatingSolved, setIsUpdatingSolved] = useState(false)

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
    } else if (startAt === 'objective') {
      setStep('objective')
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

  const showObjective = step === 'objective'

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

  async function handleToggleSolved () {
    if (!myFeedback) {
      return
    }

    setIsUpdatingSolved(true)
    try {
      await setFeedbackSolved({
        threadId: myFeedback.threadId,
        isSolved: !myFeedback.isSolved,
      })
    } finally {
      setIsUpdatingSolved(false)
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
        className={`dialogPanel ${showObjective ? 'dialogPanelWide' : ''}`}
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

        {showObjective && (
          <div className='dialogSection'>
            <PageObjectivesContent
              pageUrl={pageUrl}
              pageTitle={pageTitle}
              inDialog
            />
          </div>
        )}

        {showThread && (
          <div className='dialogSection threadSection'>
            <h3 className='sectionTitle'>La tua valutazione</h3>
            <p className='dialogHint' style={{ marginBottom: '0.65rem' }}>
              Quella salvata è evidenziata; puoi cambiare faccia o testo e
              salvare di nuovo (crea una nuova versione).
            </p>
            <div className='feedbackStatusRow'>
              <span
                className={`feedbackStatusBadge ${myFeedback.isSolved ? 'feedbackStatusBadgeSolved' : 'feedbackStatusBadgeOpen'}`}
              >
                {myFeedback.isSolved ? 'Risolto' : 'Aperto'}
              </span>
              <button
                type='button'
                className='secondaryBtn'
                disabled={isUpdatingSolved}
                onClick={handleToggleSolved}
              >
                {isUpdatingSolved
                  ? 'Salvataggio…'
                  : myFeedback.isSolved
                    ? 'Segna come non risolto'
                    : 'Segna come risolto'}
              </button>
            </div>
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
  onOpenDialog,
}: {
  pageUrl: string
  onOpenDialog: (opts: {
    startAt: 'form' | 'thread' | 'objective'
    presetRating: 1 | 2 | 3 | null
  }) => void
}) {
  const myFeedback = useQuery(api.example.getMyFeedback, { url: pageUrl })
  const objectives = useQuery(api.example.listObjectivesForUrl, { url: pageUrl })
  const comments = useQuery(
    api.example.listComments,
    myFeedback
      ? { threadId: myFeedback.threadId, limit: 50 }
      : 'skip',
  )

  const commentCount =
    comments?.filter((row) => !row.comment.isDeleted).length ?? 0
  const objectiveCount =
    objectives?.filter((objective) => objective.status === 'active').length ?? 0

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
        <div className='dockActions'>
          <button
            type='button'
            className='commentBadge'
            title='Apri scopo della pagina'
            onClick={() => onOpenDialog({ startAt: 'objective', presetRating: null })}
          >
            🎯
            <span className='badgeCount'>{objectiveCount || '—'}</span>
          </button>
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
    startAt: 'form' | 'thread' | 'objective'
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
  const setFeedbackSolved = useMutation(api.example.setFeedbackSolved)
  const [updatingThreadId, setUpdatingThreadId] = useState<string | null>(null)

  const avgSmile =
    threads && threads.length > 0
      ? threads.reduce((acc, t) => acc + t.rating, 0) / threads.length
      : null

  async function handleToggleSolved (threadId: string, isSolved: boolean) {
    setUpdatingThreadId(threadId)
    try {
      await setFeedbackSolved({ threadId, isSolved })
    } finally {
      setUpdatingThreadId(null)
    }
  }

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
                <div className='cardRowAside'>
                  <span
                    className={`feedbackStatusBadge ${row.isSolved ? 'feedbackStatusBadgeSolved' : 'feedbackStatusBadgeOpen'}`}
                  >
                    {row.isSolved ? 'Risolto' : 'Aperto'}
                  </span>
                  <div className='cardStars'>{moodStars(row.rating)}</div>
                </div>
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
                  className='secondaryBtn'
                  disabled={updatingThreadId === row.threadId}
                  onClick={() => {
                    void handleToggleSolved(row.threadId, !row.isSolved)
                  }}
                >
                  {updatingThreadId === row.threadId
                    ? 'Salvataggio…'
                    : row.isSolved
                      ? 'Segna come non risolto'
                      : 'Segna come risolto'}
                </button>
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
    startAt: 'form' | 'thread' | 'objective'
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
      opts: { startAt: 'form' | 'thread' | 'objective'; presetRating: 1 | 2 | 3 | null },
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
