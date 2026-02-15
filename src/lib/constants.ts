export const CATEGORY_CONFIG = {
  tech: { bg: '#1a1a2e', border: '#e94560', badge: '#e94560', label: 'TECH COORD' },
  absolute: { bg: '#1a1a2e', border: '#f5a623', badge: '#f5a623', label: 'ABSOLUTE STR' },
  ss: { bg: '#16213e', border: '#4a6fa5', badge: '#4a6fa5', label: 'SUPERSET' },
  acc: { bg: '#1a1a2e', border: '#2d3436', badge: '#636e72', label: 'ACCESSORY' },
} as const

export const MAIN_LIFTS = [
  { id: 'bench', name: 'Bench Press', color: '#e94560' },
  { id: 'squat', name: 'Back Squat', color: '#f5a623' },
  { id: 'deadlift', name: 'Deadlift', color: '#2ea043' },
  { id: 'ohp', name: 'OHP', color: '#4a6fa5' },
] as const

export type MainLiftId = (typeof MAIN_LIFTS)[number]['id']
