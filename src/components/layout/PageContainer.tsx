interface PageContainerProps {
  title: string
  description?: string
  actions?: React.ReactNode
  children?: React.ReactNode
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
}

const maxWidthClass = {
  sm:   'max-w-xl',
  md:   'max-w-2xl',
  lg:   'max-w-4xl',
  xl:   'max-w-5xl',
  '2xl':'max-w-7xl',
  full: 'max-w-full',
}

export default function PageContainer({ title, description, actions, children, maxWidth = 'lg' }: PageContainerProps) {
  return (
    <div className={`${maxWidthClass[maxWidth]} mx-auto`}>
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{title}</h1>
          {description && (
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{description}</p>
          )}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>

      {/* Contenu */}
      {children}
    </div>
  )
}
