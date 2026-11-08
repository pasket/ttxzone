import { PASSWORD_MIN_LENGTH } from '../lib/passwordPolicy'
import type { InstancePolicy } from '../lib/types'
import { useApiResource } from './useApiResource'

/** The deployment's minimum password length (Platform -> Sign-in security, read
 * from the public GET /instance/policy), never below the fixed floor. The
 * floor stands in while it loads or if it fails: the server checks again. */
export function usePasswordMinLength(): number {
  const policy = useApiResource<InstancePolicy>('/instance/policy')
  return Math.max(policy.data?.password_min_length ?? PASSWORD_MIN_LENGTH, PASSWORD_MIN_LENGTH)
}
