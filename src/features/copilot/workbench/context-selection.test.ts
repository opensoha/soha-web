import { describe, expect, it } from 'vitest'
import { contextSnapshotSummary, readTextAttachment } from './context-selection'

function textFile(name: string, bytes: Uint8Array) {
  const file = new File([new Uint8Array(bytes).buffer], name)
  Object.defineProperty(file, 'arrayBuffer', { value: async () => bytes.buffer })
  return file
}

describe('chat context selection', () => {
  it('reads UTF-8 text and rejects binary, malformed UTF-8 and oversized files', async () => {
    const file = await readTextAttachment(
      textFile('incident.log', new TextEncoder().encode('维护窗口 03:00')),
    )
    expect(file).toMatchObject({ name: 'incident.log', content: '维护窗口 03:00' })
    expect(file.id).toBeTruthy()
    await expect(readTextAttachment(textFile('x.log', new Uint8Array([0])))).rejects.toThrow()
    await expect(readTextAttachment(textFile('x.log', new Uint8Array([255])))).rejects.toThrow()
    await expect(readTextAttachment(textFile('x.log', new Uint8Array(65_537)))).rejects.toThrow()
    await expect(readTextAttachment(textFile('x.pdf', new Uint8Array([65])))).rejects.toThrow()
  })

  it('reports evidence estimates separately from unknown model input usage', () => {
    expect(contextSnapshotSummary(undefined)).toEqual([])
    const summary = contextSnapshotSummary({
      id: 'snapshot-1',
      budgetUsage: { evidenceItems: 1, evidenceTokens: 100 },
      usageProvenance: 'estimated_characters',
      citations: [{ documentTitle: 'incident.log' }],
      truncations: ['attachment:file-1:maxEvidenceTokens'],
    })
    expect(summary.map((item) => item.value).join(' ')).toContain('模型完整输入用量未知')
    expect(summary.map((item) => item.value).join(' ')).toContain(
      'attachment:file-1:maxEvidenceTokens',
    )
  })
})
