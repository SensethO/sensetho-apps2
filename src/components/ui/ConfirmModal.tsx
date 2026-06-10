'use client'

interface ConfirmModalProps {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Modale de confirmation harmonisée plateforme — remplace les confirm() natifs.
 * Style identique aux modales d'édition (GestionTempsApp, etc.).
 */
export default function ConfirmModal({
  open, title, message, confirmLabel = 'Supprimer', onConfirm, onCancel,
}: ConfirmModalProps) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
          {message && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{message}</p>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
