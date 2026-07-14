import { api } from '@/services/api-client'
import type { ApiResponse } from '@/types'
import type { CreateMemoryPolicyInput, MemoryPolicy, MemoryRecord } from './types'
export const memoryApi = {
  records: {
    list: () => api.get<ApiResponse<MemoryRecord[]>>('/ai/memory'),
    delete: (id: string) => api.delete<void>(`/ai/memory/${encodeURIComponent(id)}`),
  },
  policies: {
    list: () => api.get<ApiResponse<MemoryPolicy[]>>('/ai/memory/policies'),
    create: (input: CreateMemoryPolicyInput) =>
      api.post<ApiResponse<MemoryPolicy>>('/ai/memory/policies', input),
  },
}
