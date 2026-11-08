import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { runLabel } from '../../lib/aar'
import { badgeNeutral, btnPrimary, inputCompact, segmentedControl } from '../../lib/buttonStyles'
import { panelTableHeadRow, panelTh } from '../../lib/panelStyles'
import type { AarPreview as AarPreviewData, RatingLevel } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { CodeRef } from '../common/CodeRef'
import { Panel } from '../common/Panel'
import { SectionHeader } from '../common/SectionHeader'

const LEVELS: RatingLevel[] = ['P', 'S', 'M', 'U']
const muted = 'text-paper-ink/60 dark:text-fg-muted'

/** The after-action report before it exists: the same parts as the real
 * one, each saying whether the session fills it or the authors write it,
 * over the exercise's own objectives. Authors start it from here once the
 * session has started. */
export function AarPreview({
  preview,
  busy,
  error,
  onStart,
}: {
  preview: AarPreviewData
  busy: boolean
  error: string | null
  onStart: (runId: string | null) => void
}) {
  const { t, i18n } = useTranslation()
  const steps = ['session', 'start', 'write', 'final'] as const
  // Several sessions held (a restart archived one): which it's written from.
  const [runId, setRunId] = useState<string | null>(preview.runs[0]?.id ?? null)
  const dateFmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
  return (
    <div className="space-y-6">
      <SectionHeader
        title={t('aar.title')}
        action={
          preview.can_edit && (
            <div className="flex flex-wrap items-center gap-2">
              {preview.runs.length > 1 && (
                <select
                  value={runId ?? ''}
                  onChange={(e) => setRunId(e.target.value)}
                  aria-label={t('aar.preview.runLabel')}
                  className={inputCompact}
                >
                  {preview.runs.map((run) => (
                    <option key={run.id} value={run.id}>
                      {runLabel(t, dateFmt, run)}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => onStart(runId)}
                disabled={busy || !preview.session_started}
                aria-describedby={preview.session_started ? undefined : 'aar-start-waiting'}
                className={btnPrimary}
              >
                {busy ? <ButtonSpinner /> : t('aar.preview.start')}
              </button>
            </div>
          )
        }
      />
      <div className="space-y-1">
        <p className={`text-sm ${muted}`}>{t('aar.preview.intro')}</p>
        {preview.can_edit && !preview.session_started && (
          <p id="aar-start-waiting" className={`text-sm ${muted}`}>
            {t('aar.preview.waiting')}
          </p>
        )}
        {!preview.can_edit && <p className={`text-sm ${muted}`}>{t('aar.preview.readerNote')}</p>}
      </div>
      {error && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}

      <Panel title={t('aar.preview.howTitle')}>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm">
          {steps.map((step) => (
            <li key={step}>{t(`aar.preview.steps.${step}`)}</li>
          ))}
        </ol>
      </Panel>

      <Panel title={t('aar.summary')}>
        <div className="space-y-4">
          <Field label={t('aar.executiveSummary')} auto>
            {t('aar.preview.executiveSummary')}
          </Field>
          <Field label={t('aar.scenarioSummary')} auto>
            {t('aar.preview.scenarioSummary')}
          </Field>
        </div>
      </Panel>

      <Panel title={t('aar.objectives')} description={t('aar.preview.ratings')}>
        {preview.objectives.length === 0 ? (
          <p className={`text-sm ${muted}`}>{t('aar.preview.noObjectives')}</p>
        ) : (
          <div className="space-y-6">
            {preview.objectives.map((objective) => (
              <section
                key={objective.code}
                aria-label={objective.code}
                className="space-y-3 border-b border-panel-line pb-6 last:border-0 last:pb-0"
              >
                <h3 className="text-sm font-semibold">
                  <CodeRef code={objective.code} title={objective.title} wrap strong />
                </h3>
                <Field
                  label={t('aar.fields.overall')}
                  auto
                  control={
                    <div aria-hidden="true" className={`${segmentedControl} opacity-60`}>
                      {LEVELS.map((level) => (
                        <span key={level} className={`px-3 font-mono text-sm ${muted}`}>
                          {level}
                        </span>
                      ))}
                    </div>
                  }
                >
                  {t('aar.preview.overall')}
                </Field>
                <Field label={t('aar.fields.strengths')} auto>
                  {t('aar.preview.strengths')}
                </Field>
                <Field label={t('aar.fields.improvements')} auto>
                  {t('aar.preview.improvements')}
                </Field>
                <Field label={t('aar.fields.analysis')}>{t('aar.preview.analysis')}</Field>
              </section>
            ))}
          </div>
        )}
      </Panel>

      <Panel title={t('aar.plan')} aside={<Source auto={false} />} flush>
        <table className="w-full text-sm">
          <thead>
            <tr className={panelTableHeadRow}>
              <th className={panelTh}>{t('aar.columns.action')}</th>
              <th className={panelTh}>{t('aar.columns.owner')}</th>
              <th className={panelTh}>{t('aar.columns.due')}</th>
              <th className={panelTh}>{t('aar.columns.status')}</th>
            </tr>
          </thead>
        </table>
        <p className={`px-5 py-4 text-sm ${muted}`}>{t('aar.preview.plan')}</p>
      </Panel>

      <Panel title={t('aar.conclusions')} aside={<Source auto={false} />}>
        <Placeholder>{t('aar.preview.conclusions')}</Placeholder>
      </Panel>
    </div>
  )
}

function Source({ auto }: { auto: boolean }) {
  const { t } = useTranslation()
  return (
    <span className={badgeNeutral}>{auto ? t('aar.preview.auto') : t('aar.preview.manual')}</span>
  )
}

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <p
      className={`rounded-sm border border-dashed border-paper-line px-3 py-2.5 text-sm dark:border-line ${muted}`}
    >
      {children}
    </p>
  )
}

/** One part of the report: its label, who fills it, and what goes in it. */
function Field({
  label,
  auto = false,
  control,
  children,
}: {
  label: string
  auto?: boolean
  control?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Source auto={auto} />
      </div>
      {control}
      <Placeholder>{children}</Placeholder>
    </div>
  )
}
