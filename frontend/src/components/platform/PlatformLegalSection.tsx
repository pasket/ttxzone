import { useTranslation } from 'react-i18next'
import { SectionHeader } from '../common/SectionHeader'
import { PlatformLegalPanel } from './PlatformLegalPanel'

/** Platform -> Legal documents: the operator's terms and privacy policy. */
export function PlatformLegalSection() {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <SectionHeader title={t('platform.sections.legal')} />
      <PlatformLegalPanel />
    </div>
  )
}
