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
      return <svg {...props}><path d="M3 12h1m16 0h1M5.5 8.5l.5-.5m12 .5l-.5-.5M12 3v1m0 16v1M7 12a5 5 0 015-5m0 0a5 5 0 015 5M9 17l-1.5 2M15 17l1.5 2M8 12h8M8 12a1.5 1.5 0 01-1.5-1.5M16 12a1.5 1.5 0 001.5-1.5" /><rect x="6" y="10" width="2" height="4" rx="1" /><rect x="16" y="10" width="2" height="4" rx="1" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
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
              <span className="text-[10px]">{item.label}</span>
            </button>
          )
        })}
      </div>
      <div className="pb-[env(safe-area-inset-bottom)]" />
    </div>
  )
}
