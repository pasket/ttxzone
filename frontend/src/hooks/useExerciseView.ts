import { useAuth } from './useAuth'

/** How the caller stands before an exercise's design: its planning team
 * works on it in Creator; an Exercise Program Manager with no seat on it
 * oversees it -- reads every document, changes none -- from Admin
 * (`/admin/exercises/:ttxId/…`, App.tsx's `AdminExerciseView`). `base` is
 * where that exercise's pages live for them, so a link from one document
 * to another stays in the same view. */
export function useExerciseView(ttxId: string | undefined | null): {
  oversight: boolean
  base: string
} {
  const { ttxList } = useAuth()
  const oversight = (ttxList ?? []).some(
    (ttx) => ttx.id === ttxId && ttx.role === 'program_manager',
  )
  return { oversight, base: `${oversight ? '/admin/exercises' : '/creator'}/${ttxId ?? ''}` }
}
