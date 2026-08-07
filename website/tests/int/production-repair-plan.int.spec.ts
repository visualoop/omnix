import { describe, expect, it } from 'vitest'
import { buildLicenseKeyRepairPlan } from '@/lib/license-key-repair'

// The five real rows read off the live admin licences dashboard.
const LIVE = [
  { id: 'l1', variant: 'retail',      licenseKey: 'OMNIX-RETAIL-MK32-63EB-5DQN' },
  { id: 'l2', variant: 'hospitality', licenseKey: 'OMNIX-HOSP-Y4DC-BUAA-9KD8' },
  { id: 'l3', variant: 'dawa',        licenseKey: 'OMX-DAWA-CD28-4CAB-52D4' },
  { id: 'l4', variant: 'hardware',    licenseKey: 'OMX-HARDWARE-822A-B882-4B60' },
  { id: 'l5', variant: 'salon',       licenseKey: 'OMNIX-SALON-ZEAL-AP83-QU9W' },
]

describe('production repair plan', () => {
  it('changes only the two broken keys and leaves the canonical three alone', () => {
    const plan = buildLicenseKeyRepairPlan(LIVE)
    expect(plan.map((c) => c.oldKey)).toEqual([
      'OMX-DAWA-CD28-4CAB-52D4',
      'OMX-HARDWARE-822A-B882-4B60',
    ])
    expect(plan.map((c) => c.newKey)).toEqual([
      'OMNIX-DAWA-CD28-4CAB-52D4',
      'OMNIX-HW-822A-B882-4B60',
    ])
    expect(plan.filter((c) => c.issue)).toEqual([])
  })

  it('is idempotent once repaired', () => {
    const repaired = LIVE.map((r) => {
      const c = buildLicenseKeyRepairPlan(LIVE).find((x) => x.id === r.id)
      return c?.newKey ? { ...r, licenseKey: c.newKey } : r
    })
    expect(buildLicenseKeyRepairPlan(repaired)).toEqual([])
  })
})
