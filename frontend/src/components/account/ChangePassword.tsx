import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, inputBase } from '../../lib/buttonStyles'
import { useToast } from '../../hooks/useToast'
import { isPasswordValid, PASSWORD_MIN_LENGTH } from '../../lib/passwordPolicy'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { PasswordRequirementsList } from '../common/PasswordRequirementsList'

/** Preferences -> Security's password change, and the screen after
 * signing in with a temporary password (RequiredPasswordChange), which
 * names the current one differently and moves on once it's changed. An
 * account without a password (single sign-on only) sets its first one:
 * no current password to ask for (the step-up went through the provider). */
export function ChangePassword({
  currentLabel,
  firstPassword = false,
  minLength = PASSWORD_MIN_LENGTH,
  onChanged,
}: {
  currentLabel?: string
  /** The deployment's minimum (AuthMeResponse.password_min_length). */
  minLength?: number
  /** The account has no password yet: no current one to ask for. */
  firstPassword?: boolean
  onChanged?: () => void | Promise<void>
} = {}) {
  const { t } = useTranslation()
  const { showToast } = useToast()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const passwordValid = isPasswordValid(newPassword, minLength)
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword
  const canSubmit = !submitting && passwordValid && !mismatch

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!passwordValid) {
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.changePassword.mismatchError'))
      return
    }

    setSubmitting(true)
    try {
      await apiFetch('/auth/password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: firstPassword ? null : currentPassword,
          new_password: newPassword,
        }),
      })
      showToast(t('common.toast.savedSuccess'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      await onChanged?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-2">
      {!firstPassword && (
        <>
          <label className="block text-sm" htmlFor="change-password-current">
            {currentLabel ?? t('auth.changePassword.currentLabel')}
          </label>
          <input
            id="change-password-current"
            name="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputBase}
            required
          />
        </>
      )}
      <label className="block text-sm" htmlFor="change-password-new">
        {t('auth.changePassword.newLabel')}
      </label>
      <input
        id="change-password-new"
        name="new-password"
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className={inputBase}
        required
      />
      <PasswordRequirementsList password={newPassword} minLength={minLength} />
      <label className="block text-sm" htmlFor="change-password-confirm">
        {t('auth.changePassword.confirmLabel')}
      </label>
      <input
        id="change-password-confirm"
        name="confirm-password"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        className={inputBase}
        required
      />
      {mismatch && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {t('auth.changePassword.mismatchError')}
        </p>
      )}
      {error && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}
      <button type="submit" disabled={!canSubmit} className={`w-full ${btnPrimary}`}>
        {submitting ? <ButtonSpinner /> : t('auth.changePassword.submit')}
      </button>
    </form>
  )
}
