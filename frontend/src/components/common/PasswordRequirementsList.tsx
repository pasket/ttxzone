import { useTranslation } from 'react-i18next'

import {
  PASSWORD_MIN_LENGTH,
  passwordRequirements,
  type PasswordRequirementKey,
} from '../../lib/passwordPolicy'

const REQUIREMENT_LABEL_KEYS: Record<
  PasswordRequirementKey,
  `auth.common.passwordRequirements.${PasswordRequirementKey}`
> = {
  length: 'auth.common.passwordRequirements.length',
  lowercase: 'auth.common.passwordRequirements.lowercase',
  uppercase: 'auth.common.passwordRequirements.uppercase',
  number: 'auth.common.passwordRequirements.number',
  symbol: 'auth.common.passwordRequirements.symbol',
}

export function PasswordRequirementsList({
  password,
  minLength = PASSWORD_MIN_LENGTH,
}: {
  password: string
  minLength?: number
}) {
  const { t } = useTranslation()
  if (password.length === 0) return null

  return (
    <ul className="space-y-0.5 text-sm" aria-live="polite">
      {passwordRequirements(password, minLength).map((r) => (
        <li
          key={r.key}
          className={r.met ? 'text-accent-fg' : 'text-paper-ink/60 dark:text-fg-muted'}
        >
          {r.met ? '✓' : '○'} {t(REQUIREMENT_LABEL_KEYS[r.key], { count: minLength })}
        </li>
      ))}
    </ul>
  )
}
