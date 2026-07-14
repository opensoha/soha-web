export const memoryKeys = {
  all: ['ai', 'memory'] as const,
  records: () => ['ai', 'memory', 'records'] as const,
  policies: () => ['ai', 'memory', 'policies'] as const,
}
export const memoryMutationKeys = {
  deleteRecord: ['ai', 'memory', 'records', 'delete'] as const,
  createPolicy: ['ai', 'memory', 'policies', 'create'] as const,
}
