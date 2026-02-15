import { create } from 'zustand'

export type AppView = 'dashboard' | 'workout' | 'history' | 'programs' | 'goals'

interface AppState {
  activeProgramId: string | null
  currentView: AppView
  dbReady: boolean
  setActiveProgramId: (id: string | null) => void
  setCurrentView: (view: AppView) => void
  setDbReady: (ready: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeProgramId: null,
  currentView: 'workout',
  dbReady: false,
  setActiveProgramId: (id) => set({ activeProgramId: id }),
  setCurrentView: (view) => set({ currentView: view }),
  setDbReady: (ready) => set({ dbReady: ready }),
}))
