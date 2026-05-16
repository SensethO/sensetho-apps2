'use client'

import { useState, useRef, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import type { Organisation } from '@/types/organisation'

interface RseHeaderProps {
  organisation: Organisation | null
  years: number[]
  selectedYear: number
  onSelectYear: (year: number) => void
  /** Ajoute max+1 directement, sans saisie */
  onAddNextYear: () => void
  /** Modifie l'année de départ — toutes les années se décalent */
  onChangeStartYear: (newYear: number) => void
  /** Slot pour le bouton Enregistrer fourni par l'app */
  actions?: React.ReactNode
}

export default function RseHeader({
  organisation, years, selectedYear, onSelectYear,
  onAddNextYear, onChangeStartYear, actions,
}: RseHeaderProps) {
  const [editingStart, setEditingStart] = useState(false)
  const [startInput, setStartInput] = useState('')
  const [hoveredStart, setHoveredStart] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const startYear = years.length > 0 ? Math.min(...years) : null

  useEffect(() => {
    if (editingStart && startYear !== null) {
      setStartInput(String(startYear))
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [editingStart, startYear])

  function handleConfirmStart() {
    const y = parseInt(startInput)
    if (!isNaN(y) && y >= 2000 && y <= 2100) {
      onChangeStartYear(y)
    }
    setEditingStart(false)
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

        {years.length === 0 && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Cliquez + Année pour démarrer le suivi
          </span>
        )}

        {[...years].sort((a, b) => a - b).map((y, idx) => {
          const isStart = idx === 0
          const isSelected = y === selectedYear

          return (
            <div key={y} className="relative flex items-center">
              {/* Chip année */}
              <button
                onClick={() => onSelectYear(y)}
                onMouseEnter={() => { if (isStart) setHoveredStart(true) }}
                onMouseLeave={() => { if (isStart) setHoveredStart(false) }}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-colors"
                style={isSelected
                  ? { backgroundColor: 'var(--accent, #6366f1)', color: '#fff', paddingRight: isStart && hoveredStart ? '22px' : undefined }
                  : { backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)', paddingRight: isStart && hoveredStart ? '22px' : undefined }
                }>
                {y}
              </button>

              {/* ✏️ sur l'année de départ uniquement */}
              {isStart && hoveredStart && !editingStart && (
                <button
                  onMouseEnter={() => setHoveredStart(true)}
                  onMouseLeave={() => setHoveredStart(false)}
                  onClick={e => { e.stopPropagation(); setEditingStart(true) }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full w-3.5 h-3.5 flex items-center justify-center hover:opacity-80"
                  style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.3)' : 'var(--border)', color: isSelected ? '#fff' : 'var(--text-muted)' }}
                  title="Modifier l'année de départ"
                >
                  <Icon name="edit" size={8} />
                </button>
              )}

              {/* Popover édition année de départ */}
              {isStart && editingStart && (
                <div className="absolute top-8 left-0 z-20 rounded-lg border shadow-lg p-3 flex gap-2 items-center"
                  style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', minWidth: '200px' }}>
                  <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>Départ</span>
                  <input
                    ref={inputRef}
                    type="number"
                    value={startInput}
                    onChange={e => setStartInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleConfirmStart(); if (e.key === 'Escape') setEditingStart(false) }}
                    className="w-20 px-2 py-1 text-xs border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    style={{ backgroundColor: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                    min={2000} max={2100}
                  />
                  {years.length > 1 && (
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      → {years.length} années décalées
                    </span>
                  )}
                  <button
                    onClick={handleConfirmStart}
                    className="px-2 py-1 text-xs rounded font-medium text-white"
                    style={{ backgroundColor: 'var(--accent, #6366f1)' }}>
                    OK
                  </button>
                  <button
                    onClick={() => setEditingStart(false)}
                    className="p-0.5 rounded hover:opacity-70"
                    style={{ color: 'var(--text-muted)' }}>
                    <Icon name="x" size={12} />
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {/* Bouton + Année — ajoute max+1 directement */}
        <button
          onClick={onAddNextYear}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors hover:opacity-80"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          title={years.length > 0 ? `Ajouter ${Math.max(...years) + 1}` : 'Ajouter une première année'}>
          <Icon name="plus" size={11} />
          Année
        </button>
      </div>

      {/* Slot actions (ex: bouton Enregistrer) */}
      {actions && <div className="ml-auto flex-shrink-0">{actions}</div>}
    </div>
  )
}
