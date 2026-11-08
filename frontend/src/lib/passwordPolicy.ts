export const PASSWORD_MIN_LENGTH = 8

export type PasswordRequirementKey = 'length' | 'lowercase' | 'uppercase' | 'number' | 'symbol'

export interface PasswordRequirement {
  key: PasswordRequirementKey
  met: boolean
}

/** Matches the backend's StrongPassword validator (app/core/password_policy.py):
 * 8+ chars, at least one lowercase/uppercase letter, one number, one symbol.
 * `minLength`: the deployment's own minimum (usePasswordMinLength), never
 * below that floor. Other deployment rules (personal data, reuse) are
 * checked by the server only. */
export function passwordRequirements(
  password: string,
  minLength: number = PASSWORD_MIN_LENGTH,
): PasswordRequirement[] {
  return [
    { key: 'length', met: password.length >= Math.max(minLength, PASSWORD_MIN_LENGTH) },
    { key: 'lowercase', met: /[a-z]/.test(password) },
    { key: 'uppercase', met: /[A-Z]/.test(password) },
    { key: 'number', met: /[0-9]/.test(password) },
    { key: 'symbol', met: /[^A-Za-z0-9]/.test(password) },
  ]
}

export function isPasswordValid(
  password: string,
  minLength: number = PASSWORD_MIN_LENGTH,
): boolean {
  return passwordRequirements(password, minLength).every((r) => r.met)
}
