import { AttackRelease } from './AttackSection'
import { ThreatActorsSection } from './ThreatActorsSection'
import type { TabProps } from './tabProps'

/** Tab 4 (second, after Scenario) -- the scenario's threat actors and the
 * MITRE ATT&CK release the MSEL is pinned to, with its upgrade. ATT&CK
 * labels the injects; the storyline's phases come from the objectives. */
export function ThreatActorsTab(props: TabProps) {
  const { msel, draft, update, removeRow, catalog, readOnly, upgradeAttack, attackUpgradeBlocked } =
    props
  return (
    <div className="space-y-6">
      <ThreatActorsSection
        {...{
          msel,
          draft,
          update,
          removeRow,
          catalog,
          readOnly,
          renumberButton: props.renumberButton,
        }}
      />
      <AttackRelease {...{ msel, catalog, readOnly, upgradeAttack, attackUpgradeBlocked }} />
    </div>
  )
}
