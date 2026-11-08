import analyst1 from '../assets/avatars/analyst-1.svg'
import analyst2 from '../assets/avatars/analyst-2.svg'
import audit1 from '../assets/avatars/audit-1.svg'
import audit2 from '../assets/avatars/audit-2.svg'
import executive1 from '../assets/avatars/executive-1.svg'
import executive2 from '../assets/avatars/executive-2.svg'
import finance1 from '../assets/avatars/finance-1.svg'
import finance2 from '../assets/avatars/finance-2.svg'
import hr1 from '../assets/avatars/hr-1.svg'
import hr2 from '../assets/avatars/hr-2.svg'
import itSecurity1 from '../assets/avatars/it-security-1.svg'
import itSecurity2 from '../assets/avatars/it-security-2.svg'
import legal1 from '../assets/avatars/legal-1.svg'
import legal2 from '../assets/avatars/legal-2.svg'
import operations1 from '../assets/avatars/operations-1.svg'
import operations2 from '../assets/avatars/operations-2.svg'
import pr1 from '../assets/avatars/pr-1.svg'
import pr2 from '../assets/avatars/pr-2.svg'
import support1 from '../assets/avatars/support-1.svg'
import support2 from '../assets/avatars/support-2.svg'
import beard from '../assets/avatars/beard-1.svg'
import bun from '../assets/avatars/bun-1.svg'
import cap from '../assets/avatars/cap-1.svg'
import glasses from '../assets/avatars/glasses-1.svg'
import headscarf from '../assets/avatars/headscarf-1.svg'
import mustache from '../assets/avatars/mustache-1.svg'
import ponytail from '../assets/avatars/ponytail-1.svg'
import sunglasses from '../assets/avatars/sunglasses-1.svg'
import tie from '../assets/avatars/tie-1.svg'
import turtleneck from '../assets/avatars/turtleneck-1.svg'

export type AvatarRoleLabelKey =
  | 'account.settings.avatar.roles.executive'
  | 'account.settings.avatar.roles.legal'
  | 'account.settings.avatar.roles.hr'
  | 'account.settings.avatar.roles.pr'
  | 'account.settings.avatar.roles.itSecurity'
  | 'account.settings.avatar.roles.finance'
  | 'account.settings.avatar.roles.operations'
  | 'account.settings.avatar.roles.audit'
  | 'account.settings.avatar.roles.support'
  | 'account.settings.avatar.roles.analyst'
  | 'account.settings.avatar.roles.beard'
  | 'account.settings.avatar.roles.mustache'
  | 'account.settings.avatar.roles.glasses'
  | 'account.settings.avatar.roles.tie'
  | 'account.settings.avatar.roles.cap'
  | 'account.settings.avatar.roles.headscarf'
  | 'account.settings.avatar.roles.bun'
  | 'account.settings.avatar.roles.sunglasses'
  | 'account.settings.avatar.roles.turtleneck'
  | 'account.settings.avatar.roles.ponytail'

export interface AvatarPreset {
  key: string
  src: string
  labelKey: AvatarRoleLabelKey
}

/** Keys here are the single source of truth the backend's
 * `avatar_service.PRESET_KEYS` must match exactly. */
export const AVATAR_PRESETS: AvatarPreset[] = [
  { key: 'executive-1', src: executive1, labelKey: 'account.settings.avatar.roles.executive' },
  { key: 'executive-2', src: executive2, labelKey: 'account.settings.avatar.roles.executive' },
  { key: 'legal-1', src: legal1, labelKey: 'account.settings.avatar.roles.legal' },
  { key: 'legal-2', src: legal2, labelKey: 'account.settings.avatar.roles.legal' },
  { key: 'hr-1', src: hr1, labelKey: 'account.settings.avatar.roles.hr' },
  { key: 'hr-2', src: hr2, labelKey: 'account.settings.avatar.roles.hr' },
  { key: 'pr-1', src: pr1, labelKey: 'account.settings.avatar.roles.pr' },
  { key: 'pr-2', src: pr2, labelKey: 'account.settings.avatar.roles.pr' },
  {
    key: 'it-security-1',
    src: itSecurity1,
    labelKey: 'account.settings.avatar.roles.itSecurity',
  },
  {
    key: 'it-security-2',
    src: itSecurity2,
    labelKey: 'account.settings.avatar.roles.itSecurity',
  },
  { key: 'finance-1', src: finance1, labelKey: 'account.settings.avatar.roles.finance' },
  { key: 'finance-2', src: finance2, labelKey: 'account.settings.avatar.roles.finance' },
  {
    key: 'operations-1',
    src: operations1,
    labelKey: 'account.settings.avatar.roles.operations',
  },
  {
    key: 'operations-2',
    src: operations2,
    labelKey: 'account.settings.avatar.roles.operations',
  },
  { key: 'audit-1', src: audit1, labelKey: 'account.settings.avatar.roles.audit' },
  { key: 'audit-2', src: audit2, labelKey: 'account.settings.avatar.roles.audit' },
  { key: 'support-1', src: support1, labelKey: 'account.settings.avatar.roles.support' },
  { key: 'support-2', src: support2, labelKey: 'account.settings.avatar.roles.support' },
  { key: 'analyst-1', src: analyst1, labelKey: 'account.settings.avatar.roles.analyst' },
  { key: 'analyst-2', src: analyst2, labelKey: 'account.settings.avatar.roles.analyst' },
  { key: 'beard-1', src: beard, labelKey: 'account.settings.avatar.roles.beard' },
  { key: 'mustache-1', src: mustache, labelKey: 'account.settings.avatar.roles.mustache' },
  { key: 'glasses-1', src: glasses, labelKey: 'account.settings.avatar.roles.glasses' },
  { key: 'tie-1', src: tie, labelKey: 'account.settings.avatar.roles.tie' },
  { key: 'cap-1', src: cap, labelKey: 'account.settings.avatar.roles.cap' },
  { key: 'headscarf-1', src: headscarf, labelKey: 'account.settings.avatar.roles.headscarf' },
  { key: 'bun-1', src: bun, labelKey: 'account.settings.avatar.roles.bun' },
  { key: 'sunglasses-1', src: sunglasses, labelKey: 'account.settings.avatar.roles.sunglasses' },
  { key: 'turtleneck-1', src: turtleneck, labelKey: 'account.settings.avatar.roles.turtleneck' },
  { key: 'ponytail-1', src: ponytail, labelKey: 'account.settings.avatar.roles.ponytail' },
]

export function findAvatarPreset(key: string): AvatarPreset | undefined {
  return AVATAR_PRESETS.find((preset) => preset.key === key)
}
