'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Question {
  id: string
  text: string
  esrs?: string
  dimension?: 'impact' | 'financial'
  category?: string
}

interface SurveyData {
  tokenType: 'invite' | 'share'
  token: string
  trackingId?: string
  sessionId: string
  surveyId: string
  surveyName: string
  surveyDescription: string | null
  surveyType: 'simple' | 'double'
  isAnonymous: boolean
  sessionOrganisation: string | null
  sessionName: string
  prefillEmail: string | null
  prefillName: string | null
  prefillStakeholderId: string | null
  questions: Question[]
}

// ─── Composants utilitaires ───────────────────────────────────────────────────

function ScaleButton({
  value,
  selected,
  onClick,
}: {
  value: number
  selected: boolean
  onClick: () => void
}) {
  const labels: Record<number, string> = {
    1: 'Pas important',
    2: 'Peu important',
    3: 'Moyennement',
    4: 'Important',
    5: 'Très important',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      title={labels[value]}
      className={`w-9 h-9 rounded-full text-sm font-semibold transition-all border-2 ${
        selected
          ? 'bg-emerald-600 border-emerald-600 text-white shadow-md scale-110'
          : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:border-emerald-500 dark:hover:text-emerald-400'
      }`}
    >
      {value}
    </button>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function EnquetePage() {
  const { token } = useParams<{ token: string }>()
  const searchParams = useSearchParams()
  const trackingId = searchParams.get('tid') ?? undefined

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [survey, setSurvey] = useState<SurveyData | null>(null)

  // Formulaire
  const [respondentName, setRespondentName] = useState('')
  const [respondentEmail, setRespondentEmail] = useState('')
  const [respondentStakeholderId, setRespondentStakeholderId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Charger le questionnaire ─────────────────────────────────────────────────

  useEffect(() => {
    if (!token) return
    // Route publique identique à app.sensetho.fr
    fetch(`/api/pp-survey/${token}`)
      .then(r => r.json())
      .then(json => {
        if (json.error) {
          setError(json.error)
        } else {
          setSurvey(json.data)
          if (json.data.prefillEmail) setRespondentEmail(json.data.prefillEmail)
          if (json.data.prefillName) setRespondentName(json.data.prefillName)
          if (json.data.prefillStakeholderId) setRespondentStakeholderId(json.data.prefillStakeholderId)
        }
      })
      .catch(err => setError(String(err)))
      .finally(() => setLoading(false))
  }, [token])

  // ── Soumission ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!survey) return
    if (!respondentName.trim()) { setSubmitError('Votre nom est requis'); return }

    const unanswered = survey.questions.filter(q => answers[q.id] == null)
    if (unanswered.length > 0) {
      setSubmitError(`Veuillez répondre à toutes les questions (${unanswered.length} sans réponse)`)
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch(`/api/pp-survey/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: survey.sessionId,
          surveyId: survey.surveyId,
          respondentName: respondentName.trim(),
          respondentEmail: respondentEmail.trim() || undefined,
          stakeholderId: respondentStakeholderId ?? undefined,
          trackingId: trackingId ?? undefined,
          answers,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erreur lors de la soumission')
      setSubmitted(true)
    } catch (err) {
      setSubmitError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Grouper les questions par thème ESRS ─────────────────────────────────────

  function groupByEsrs(questions: Question[]) {
    const grouped: Record<string, Question[]> = {}
    questions.forEach(q => {
      const key = q.esrs ?? 'Général'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(q)
    })
    return Object.entries(grouped)
  }

  // ─── Rendu ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600 text-sm">Chargement du questionnaire…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Lien invalide</h1>
          <p className="text-gray-600 text-sm">{error}</p>
          <p className="text-gray-400 text-xs mt-4">
            Ce lien a peut-être expiré ou a déjà été utilisé.
            Contactez l&apos;émetteur pour obtenir un nouveau lien.
          </p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-5xl mb-4">✅</p>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Merci pour votre participation !</h1>
          <p className="text-gray-600 text-sm mb-4">
            Vos réponses ont été enregistrées et seront prises en compte dans l&apos;analyse de matérialité.
          </p>
          {survey?.sessionOrganisation && (
            <p className="text-gray-400 text-xs">
              Pour <strong>{survey.sessionOrganisation}</strong>
            </p>
          )}
          <div className="mt-6 p-4 bg-emerald-50 rounded-xl">
            <p className="text-emerald-700 text-xs font-medium">
              Questionnaire : {survey?.surveyName}
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!survey) return null

  const grouped = groupByEsrs(survey.questions)
  const answeredCount = Object.keys(answers).length
  const totalCount = survey.questions.length
  const progress = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-emerald-700 text-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <p className="text-emerald-200 text-sm mb-1">Enquête de matérialité ESG</p>
          <h1 className="text-2xl font-bold">{survey.surveyName}</h1>
          {survey.sessionOrganisation && (
            <p className="text-emerald-200 text-sm mt-1">pour {survey.sessionOrganisation}</p>
          )}
          {survey.surveyDescription && (
            <p className="text-emerald-100 text-sm mt-3 leading-relaxed">{survey.surveyDescription}</p>
          )}
        </div>
      </div>

      {/* Barre de progression */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-sm font-medium text-gray-600 flex-shrink-0">
            {answeredCount}/{totalCount}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Infos répondant */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 text-base">Votre identification</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom complet <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={respondentName}
              onChange={e => setRespondentName(e.target.value)}
              placeholder="Ex : Marie Dupont"
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              required
            />
          </div>
          {!survey.isAnonymous && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email <span className="text-gray-400">(optionnel)</span>
              </label>
              <input
                type="email"
                value={respondentEmail}
                onChange={e => setRespondentEmail(e.target.value)}
                placeholder="votre@email.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
              />
            </div>
          )}
          {survey.isAnonymous && (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
              🔒 Ce questionnaire est anonyme. Votre nom ne sera pas associé à vos réponses dans les résultats.
            </p>
          )}
        </div>

        {/* Légende de l'échelle */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-sm font-medium text-blue-800 mb-2">Échelle de notation</p>
          <div className="grid grid-cols-5 gap-1 text-center">
            {[
              { v: 1, label: 'Pas\nimportant' },
              { v: 2, label: 'Peu\nimportant' },
              { v: 3, label: 'Moyen\nnement' },
              { v: 4, label: 'Impor\ntant' },
              { v: 5, label: 'Très\nimportant' },
            ].map(({ v, label }) => (
              <div key={v} className="flex flex-col items-center gap-1">
                <div className="w-8 h-8 rounded-full border-2 border-blue-300 flex items-center justify-center text-sm font-bold text-blue-700 bg-white">
                  {v}
                </div>
                <span className="text-xs text-blue-600 leading-tight whitespace-pre-line">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Questions par thème */}
        {grouped.map(([esrs, questions]) => (
          <div key={esrs} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
              <h3 className="font-semibold text-gray-800 text-sm">{esrs}</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {questions.map((q, qIdx) => {
                const dimLabel = q.dimension === 'financial'
                  ? '💰 Financière'
                  : q.dimension === 'impact'
                    ? '🌍 Impact'
                    : null
                return (
                  <div key={q.id} className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <span className="flex-shrink-0 w-6 h-6 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center justify-center mt-0.5">
                        {qIdx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-800 leading-relaxed">{q.text}</p>
                        {dimLabel && (
                          <span className="inline-block mt-1 text-xs text-gray-400">{dimLabel}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-center mt-2">
                      {[1, 2, 3, 4, 5].map(v => (
                        <ScaleButton
                          key={v}
                          value={v}
                          selected={answers[q.id] === v}
                          onClick={() => setAnswers(prev => ({ ...prev, [q.id]: v }))}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Erreur et bouton de soumission */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm text-red-700">{submitError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || answeredCount < totalCount || !respondentName.trim()}
          className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors text-base"
        >
          {submitting
            ? 'Envoi en cours…'
            : answeredCount < totalCount
              ? `Répondez à toutes les questions (${totalCount - answeredCount} restante${totalCount - answeredCount !== 1 ? 's' : ''})`
              : 'Soumettre mes réponses'}
        </button>

        {/* Footer */}
        <div className="text-center pb-8">
          <p className="text-xs text-gray-400">
            Powered by{' '}
            <span className="font-semibold text-emerald-600">Sens&apos;ethO Apps</span>
            {' '}· Vos réponses sont confidentielles et sécurisées
          </p>
        </div>
      </form>
    </div>
  )
}
