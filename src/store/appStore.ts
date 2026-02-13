import { create } from 'zustand'

export type AppView = 'dashboard' | 'workout' | 'history' | 'programs' | 'goals'

interface AppState {
  activeProgramId: string | null
  currentView: AppView
  sidebarCollapsed: boolean
  dbReady: boolean
  setActiveProgramId: (id: string | null) => void
  setCurrentView: (view: AppView) => void
  toggleSidebar: () => void
  setDbReady: (ready: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeProgramId: null,
  currentView: 'workout',
  sidebarCollapsed: false,
  dbReady: false,
  setActiveProgramId: (id) => set({ activeProgramId: id }),
  setCurrentView: (view) => set({ currentView: view }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setDbReady: (ready) => set({ dbReady: ready }),
}))
