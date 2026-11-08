import { useTranslation } from 'react-i18next'

import { btnNeutralIconGhost, linkAccent } from '../../../lib/buttonStyles'
import { MAX_METERS, newMeterKey, mselFieldId } from '../../../lib/msel'
import type { MselDraft } from '../../../lib/msel'
import { FieldGroup } from '../../common/FieldGroup'
import { TextInput } from '../needs/fields'

/** Mirrors the backend's limit on a meter's name. */
const NAME_MAX = 40

/** The exercise's impact meters: what its polls' decisions add up on. Each
 * poll's options say how much (the inject dialog). */
export function MetersField({
  meters,
  invalid,
  onChange,
}: {
  meters: MselDraft['meters']
  invalid: boolean
  onChange: (meters: MselDraft['meters']) => void
}) {
  const { t } = useTranslation()
  return (
    <FieldGroup
      id="msel-group-meters"
      title={t('creator.msel.meters.title')}
      hint={t('creator.msel.meters.hint')}
    >
      <div id={mselFieldId('meters')} tabIndex={-1} className="space-y-2">
        <ol className="space-y-2">
          {meters.map((meter, index) => {
            const label = t('creator.msel.meters.name', { number: index + 1 })
            return (
              <li key={meter.key} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <TextInput
                    id={`${mselFieldId('meters')}-${index}`}
                    aria-label={label}
                    value={meter.name}
                    invalid={invalid && !meter.name.trim()}
                    maxLength={NAME_MAX}
                    onChange={(name) =>
                      onChange(meters.map((m, i) => (i === index ? { ...m, name } : m)))
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onChange(meters.filter((_, i) => i !== index))}
                  aria-label={t('creator.msel.meters.remove', { number: index + 1 })}
                  title={t('creator.msel.meters.remove', { number: index + 1 })}
                  className={btnNeutralIconGhost}
                >
                  <span aria-hidden="true" className="text-lg leading-none">
                    ×
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
        {meters.length < MAX_METERS && (
          <button
            type="button"
            onClick={() => onChange([...meters, { key: newMeterKey(), name: '' }])}
            className={`${linkAccent} text-sm font-medium`}
          >
            <span aria-hidden="true">+ </span>
            {t('creator.msel.meters.add')}
          </button>
        )}
      </div>
    </FieldGroup>
  )
}
