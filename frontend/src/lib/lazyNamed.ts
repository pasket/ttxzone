import { type ComponentType, lazy } from 'react'

// `lazy` itself asks for this type; each use keeps its component's own props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>

/** `React.lazy` for a named export: several routes share one module's chunk
 * by naming their component in it. */
export function lazyNamed<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await load())[name] as Extract<M[K], AnyComponent> }))
}
