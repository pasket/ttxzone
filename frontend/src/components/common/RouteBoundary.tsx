import { Component, type ErrorInfo, type ReactNode, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'

import { btnSecondary } from '../../lib/buttonStyles'

function RouteLoading() {
  const { t } = useTranslation()
  return (
    <p role="status" className="p-6 text-sm text-paper-ink/70 dark:text-fg-muted">
      {t('common.loading')}
    </p>
  )
}

function RouteFailed() {
  const { t } = useTranslation()
  return (
    <div role="alert" className="space-y-3 p-6">
      <p className="text-sm">{t('common.pageLoadFailed')}</p>
      <button type="button" className={btnSecondary} onClick={() => window.location.reload()}>
        {t('common.reloadPage')}
      </button>
    </div>
  )
}

interface CatcherProps {
  pathname: string
  children: ReactNode
}

class RouteErrorCatcher extends Component<CatcherProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  componentDidUpdate(previous: CatcherProps) {
    // Another page may well load; this one keeps failing until a reload.
    if (this.state.failed && previous.pathname !== this.props.pathname) {
      this.setState({ failed: false })
    }
  }

  render() {
    return this.state.failed ? <RouteFailed /> : this.props.children
  }
}

/** Around what a route renders from a chunk of its own: says it's loading
 * while the chunk arrives, and what to do if it never does, leaving the
 * layout around it in place. */
export function RouteBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <RouteErrorCatcher pathname={pathname}>
      <Suspense fallback={<RouteLoading />}>{children}</Suspense>
    </RouteErrorCatcher>
  )
}
