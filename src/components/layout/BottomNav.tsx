import { useAppStore, type AppView } from '../../store/appStore'

const NAV_ITEMS: Array<{ view: AppView; label: string }> = [
  { view: 'dashboard', label: 'Home' },
  { view: 'workout', label: 'Workout' },
  { view: 'history', label: 'History' },
  { view: 'programs', label: 'Programs' },
  { view: 'goals', label: 'Goals' },
]

function NavIcon({ view }: { view: AppView; active: boolean }) {
  const props = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

  switch (view) {
    case 'dashboard':
      return <svg {...props}><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" /></svg>
    case 'workout':
      return <svg {...props}><rect x="2" y="11" width="20" height="2" rx="1" /><rect x="4" y="7" width="3.5" height="10" rx="1.5" /><rect x="16.5" y="7" width="3.5" height="10" rx="1.5" /></svg>
    case 'history':
      return <svg {...props}><path d="M3 3v18h18" /><path d="M7 16l4-6 4 4 5-8" /></svg>
    case 'programs':
      return <svg {...props}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
    case 'goals':
      return <svg {...props}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>
  }
}

export function BottomNav() {
  const { currentView, setCurrentView } = useAppStore()

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100] shadow-nav border-t border-white/[0.06]"
      style={{
        background: 'rgba(22, 27, 34, 0.8)',
        WebkitBackdropFilter: 'blur(20px)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex h-[56px]">
        {NAV_ITEMS.map((item) => {
          const active = currentView === item.view
          return (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] border-none cursor-pointer transition-all active:scale-95 relative ${
                active ? 'text-accent' : 'text-muted'
              }`}
              style={{ background: 'transparent' }}
            >
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[3px] bg-accent rounded-b-full" />
              )}
              <NavIcon view={item.view} active={active} />
              <span className="text-[14px]">{item.label}</span>
            </button>
          )
        })}
      </div>
      <div className="pb-[env(safe-area-inset-bottom)]" />
    </div>
  )
}
