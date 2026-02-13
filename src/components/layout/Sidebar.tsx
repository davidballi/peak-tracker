import { useAppStore, type AppView } from '../../store/appStore'

const NAV_ITEMS: Array<{ view: AppView; icon: string; label: string }> = [
  { view: 'dashboard', icon: '🏠', label: 'Home' },
  { view: 'workout', icon: '🏋️', label: 'Workout' },
  { view: 'history', icon: '📊', label: 'History' },
  { view: 'programs', icon: '📋', label: 'Programs' },
  { view: 'goals', icon: '🎯', label: 'Goals' },
]

export function Sidebar() {
  const { currentView, setCurrentView, sidebarCollapsed } = useAppStore()

  return (
    <div
      className={`flex flex-col bg-card border-r border-border pt-2 pb-4 shrink-0 transition-all ${
        sidebarCollapsed ? 'w-[48px]' : 'w-[64px]'
      }`}
    >
      {NAV_ITEMS.map((item) => {
        const active = currentView === item.view
        return (
          <button
            key={item.view}
            onClick={() => setCurrentView(item.view)}
            className={`flex flex-col items-center gap-0.5 py-2.5 px-1 border-none cursor-pointer transition-colors ${
              active
                ? 'bg-[#f5a62315] text-accent'
                : 'bg-transparent text-muted hover:text-bright hover:bg-[#ffffff08]'
            }`}
          >
            <span className="text-[18px] leading-none">{item.icon}</span>
            <span className="text-[9px] font-mono">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
