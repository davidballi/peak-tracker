import { useAppStore, type AppView } from '../../store/appStore'

const NAV_ITEMS: Array<{ view: AppView; icon: string; label: string }> = [
  { view: 'dashboard', icon: '🏠', label: 'Home' },
  { view: 'workout', icon: '🏋️', label: 'Workout' },
  { view: 'history', icon: '📊', label: 'History' },
  { view: 'programs', icon: '📋', label: 'Programs' },
  { view: 'goals', icon: '🎯', label: 'Goals' },
]

export function BottomNav() {
  const { currentView, setCurrentView } = useAppStore()

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-card border-t border-border">
      <div className="flex h-[52px]">
        {NAV_ITEMS.map((item) => {
          const active = currentView === item.view
          return (
            <button
              key={item.view}
              onClick={() => setCurrentView(item.view)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] border-none cursor-pointer transition-colors active:opacity-70 ${
                active
                  ? 'bg-[#f5a62315] text-accent'
                  : 'bg-transparent text-muted'
              }`}
            >
              <span className="text-[18px] leading-none">{item.icon}</span>
              <span className="text-[9px] font-mono">{item.label}</span>
            </button>
          )
        })}
      </div>
      <div className="pb-[env(safe-area-inset-bottom)]" />
    </div>
  )
}
