import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ARTIFACT_KINDS, ARTIFACT_LABEL_KEYS, newArtifact } from '../../../lib/artifacts'
import { btnSecondary } from '../../../lib/buttonStyles'
import type { ArtifactKind, InjectArtifact } from '../../../lib/types'
import { InjectArtifactView } from '../../common/InjectArtifactView'
import { Field, Select, TextInput } from '../needs/fields'

type FieldName = Exclude<keyof InjectArtifact, 'kind'>

/** Which template fields each kind uses, in form order, with their label
 * key: the same stored field reads differently per kind (an email's
 * subject is a press release's headline). */
const KIND_FIELDS: Record<ArtifactKind, { name: FieldName; label: LabelKey }[]> = {
  email: [
    { name: 'sender', label: 'creator.msel.artifact.fields.from' },
    { name: 'sender_address', label: 'creator.msel.artifact.fields.fromAddress' },
    { name: 'recipient', label: 'creator.msel.artifact.fields.to' },
    { name: 'subject', label: 'creator.msel.artifact.fields.subject' },
    { name: 'timestamp', label: 'creator.msel.artifact.fields.date' },
  ],
  press_release: [
    { name: 'sender', label: 'creator.msel.artifact.fields.outlet' },
    { name: 'subject', label: 'creator.msel.artifact.fields.headline' },
    { name: 'location', label: 'creator.msel.artifact.fields.dateline' },
    { name: 'timestamp', label: 'creator.msel.artifact.fields.date' },
    { name: 'sender_address', label: 'creator.msel.artifact.fields.pressContact' },
  ],
  social_post: [
    { name: 'sender', label: 'creator.msel.artifact.fields.author' },
    { name: 'sender_address', label: 'creator.msel.artifact.fields.handle' },
    { name: 'timestamp', label: 'creator.msel.artifact.fields.date' },
  ],
  chat_message: [
    { name: 'sender', label: 'creator.msel.artifact.fields.sender' },
    { name: 'location', label: 'creator.msel.artifact.fields.channel' },
    { name: 'timestamp', label: 'creator.msel.artifact.fields.date' },
  ],
}

type LabelKey =
  | 'creator.msel.artifact.fields.from'
  | 'creator.msel.artifact.fields.fromAddress'
  | 'creator.msel.artifact.fields.to'
  | 'creator.msel.artifact.fields.subject'
  | 'creator.msel.artifact.fields.date'
  | 'creator.msel.artifact.fields.outlet'
  | 'creator.msel.artifact.fields.headline'
  | 'creator.msel.artifact.fields.dateline'
  | 'creator.msel.artifact.fields.pressContact'
  | 'creator.msel.artifact.fields.author'
  | 'creator.msel.artifact.fields.handle'
  | 'creator.msel.artifact.fields.sender'
  | 'creator.msel.artifact.fields.channel'

const MAX_LENGTH: Record<FieldName, number> = {
  sender: 255,
  sender_address: 255,
  recipient: 255,
  subject: 255,
  timestamp: 64,
  location: 255,
}

/** "Shown to the table as": plain text, or the content drawn as a
 * simulated email, press release, social post or chat message, with the
 * template's header fields and a preview of what the table will see. */
export function InjectArtifactField({
  id,
  artifact,
  content,
  senderName,
  onChange,
}: {
  id: (field: string) => string
  artifact: InjectArtifact | null
  content: string
  /** The inject's sender (its simulated actor), prefilled as the
   * artifact's sender. */
  senderName: string
  onChange: (artifact: InjectArtifact | null) => void
}) {
  const { t } = useTranslation()
  const [previewing, setPreviewing] = useState(false)
  return (
    <div className="space-y-3">
      <Field
        id={id('artifact_kind')}
        label={t('creator.msel.artifact.label')}
        hint={t('creator.msel.artifact.hint')}
      >
        <Select<'' | ArtifactKind>
          id={id('artifact_kind')}
          hint
          value={artifact?.kind ?? ''}
          onChange={(kind) => onChange(kind ? newArtifact(kind, artifact, senderName) : null)}
          options={[
            { value: '', label: t('creator.msel.artifact.plain') },
            ...ARTIFACT_KINDS.map((kind) => ({ value: kind, label: t(ARTIFACT_LABEL_KEYS[kind]) })),
          ]}
        />
      </Field>
      {artifact && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {KIND_FIELDS[artifact.kind].map((field) => (
              <Field
                key={field.name}
                id={id(`artifact_${field.name}`)}
                label={t(field.label)}
                optional
              >
                <TextInput
                  id={id(`artifact_${field.name}`)}
                  value={artifact[field.name]}
                  maxLength={MAX_LENGTH[field.name]}
                  onChange={(value) => onChange({ ...artifact, [field.name]: value })}
                />
              </Field>
            ))}
          </div>
          <div className="space-y-3">
            <button
              type="button"
              aria-expanded={previewing}
              onClick={() => setPreviewing(!previewing)}
              className={btnSecondary}
            >
              {previewing
                ? t('creator.msel.artifact.hidePreview')
                : t('creator.msel.artifact.showPreview')}
            </button>
            {previewing && (
              <InjectArtifactView
                artifact={artifact}
                content={content || t('creator.msel.artifact.emptyBody')}
                textSize="text-sm"
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
