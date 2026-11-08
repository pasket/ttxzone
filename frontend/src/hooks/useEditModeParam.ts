import { useSearchParams } from 'react-router-dom'

const PARAM = 'edit'

/** A page's edit mode kept in the URL (`?edit=1`), so a reload stays in
 * it, it can be linked to, and Back leaves it (opening pushes a history
 * entry). Closing drops the param in place (replace), synchronously, so
 * nothing can reopen the form in between; the entry left behind is the
 * same view page, so Back from there is harmless. */
export function useEditModeParam() {
  const [searchParams, setSearchParams] = useSearchParams()
  const editing = searchParams.get(PARAM) === '1'

  function setParam(on: boolean) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (on) next.set(PARAM, '1')
        else next.delete(PARAM)
        return next
      },
      { replace: !on },
    )
  }

  return {
    editing,
    openEditing: () => setParam(true),
    closeEditing: () => setParam(false),
  }
}
