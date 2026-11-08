import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { btnSecondary } from '../../lib/buttonStyles'
import { ChangePassword } from '../account/ChangePassword'

/** Shown after signing in with a temporary password (an instance
 * administrator reset it from Platform), or with one past the deployment's
 * maximum age (Platform -> Sign-in security): until the person chooses a new one,
 * the API answers only the account itself (PASSWORD_CHANGE_REQUIRED
 * elsewhere), so the way out is changing it or signing out. */
export function RequiredPasswordChange() {
  const { t } = useTranslation()
  const { refresh, logout, user } = useAuth()
  const expired = user?.password_change_reason === 'expired'
  const navigate = useNavigate()

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">
          {t(
            expired
              ? 'auth.requiredPasswordChange.expiredTitle'
              : 'auth.requiredPasswordChange.title',
          )}
        </h1>
        <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          {t(
            expired
              ? 'auth.requiredPasswordChange.expiredIntro'
              : 'auth.requiredPasswordChange.intro',
          )}
        </p>
      </div>
      <ChangePassword
        minLength={user?.password_min_length}
        currentLabel={t(
          expired
            ? 'auth.requiredPasswordChange.expiredCurrentLabel'
            : 'auth.requiredPasswordChange.currentLabel',
        )}
        onChanged={async () => {
          await refresh()
          navigate('/', { replace: true })
        }}
      />
      <button type="button" onClick={() => void logout()} className={btnSecondary}>
        {t('nav.logout')}
      </button>
    </div>
  )
}
