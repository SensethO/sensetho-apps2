'use client'

import { useState, useRef, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import type { Organisation } from '@/types/organisation'

interface RseHeaderProps {
  organisation: Organisation | null
  years: number[]
  selectedYear: number
  onSelectYear: (year: number) => void
  onAddYear: (year: number) => void
  /** Slot pour le bouton Enregistrer fourni par l'app */
  actions?: React.ReactNode
}

export default function RseHeader({
  organisation, years, selectedYear, onSelectYear, onAddYear, actions
}: RseHeaderProps) {
  const [showYearPicker, setShowYearPicker] = useState(false)
  const [yearInput, setYearInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const currentYear = new Date().getFullYear()

  useEffect(() => {
    if (showYearPicker) {
      setYearInput(String(currentYear + 1))
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [showYearPicker, currentYear])

  function handleAddYear() {
    const y = parseInt(yearInput)
    if (!isNaN(y) && y >= 2000 && y <= 2100) {
      onAddYear(y)
      setShowYearPicker(false)
      setYearInput('')
    }
  }

  if (!organisation) {
    return (
      <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Sélectionnez une organisation dans le panneau de gauche
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0 flex-wrap"
      style={{ borderColor: 'var(--border)' }}>

      {/* Nom organisation */}
      <h2 className="text-base font-semibold mr-2 flex-shrink-0" style={{ color: 'var(--text)' }}>
        {organisation.denomination}
      </h2>

      {/* Sélecteur d'années */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {years.map(y => (
          <button
            key={y}
            onClick={() => onSelectYear(y)}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
            style={y === selectedYear
              ? { backgroundColor: 'var(--accent, #6366f1)', color: '#fff' }
              : { backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }
            }>
            {y}
          </button>
        ))}

        {/* Bouton + Année */}
        <div className="relative">
          <button
            onClick={() => setShowYearPicker(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <Icon name="plus" size={11} />
            Année
          </button>

          {/* Popover saisie année */}
          {showYearPicker && (
            <div className="absolute top-8 left-0 z-20 rounded-lg border shadow-lg p-3 flex gap-2 items-center"
              style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', minWidth: '160px' }}>
              <input
                ref={inputRef}
                type="number"
                value={yearInput}
                onChange={e => setYearInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddYear(); if (e.key === 'Escape') setShowYearPicker(false) }}
                className="w-20 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                min={2000} max={2100}
              />
              <button
                onClick={handleAddYear}
                className="px-2 py-1 text-xs rounded font-medium text-white"
                style={{ backgroundColor: 'var(--accent, #6366f1)' }}>
                Ajouter
              </button>
              <button
                onClick={() => setShowYearPicker(false)}
                className="p-0.5 rounded hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}>
                <Icon name="x" size={12} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Slot actions (ex: bouton Enregistrer) */}
      {actions && <div className="ml-auto flex-shrink-0">{actions}</div>}
    </div>
  )
}
