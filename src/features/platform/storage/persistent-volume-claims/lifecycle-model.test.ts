import { describe, expect, it } from 'vitest'
import { assessPersistentVolumeClaim } from './lifecycle-model'

describe('assessPersistentVolumeClaim', () => {
  it('detects a ReadWriteOnce claim mounted across nodes', () => {
    const assessment = assessPersistentVolumeClaim({
      status: 'Bound',
      volumeName: 'pvc-1',
      accessModes: ['ReadWriteOnce'],
      pods: [
        { name: 'api-0', namespace: 'team-a', nodeName: 'node-a' },
        { name: 'api-1', namespace: 'team-a', nodeName: 'node-b' },
      ],
    })

    expect(assessment.currentStep).toBe(2)
    expect(assessment.risks).toContain('multi-node-rwo')
  })
})
