import { create } from 'zustand'

interface AppState {
  activeProgramId: string | null
  sidebarCollapsed: boolean
  dbReady: boolean
  setActiveProgramId: (id: string | null) => void
  toggleSidebar: () => void
  setDbReady: (ready: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeProgramId: null,
  sidebarCollapsed: false,
  dbReady: false,
  setActiveProgramId: (id) => set({ activeProgramId: id }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setDbReady: (ready) => set({ dbReady: ready }),
}))
