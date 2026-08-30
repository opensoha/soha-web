export const APPLICATION_WORKSPACE_LABELS = {
  overview: '概览',
  delivery: '工作流',
  services: '服务',
  verification: '测试',
  resources: '扩展资源',
  application: '服务配置',
  permissions: '权限',
  capabilities: '交付能力',
} as const

export const APPLICATION_WORKSPACE_NAV_ITEMS = Object.entries(APPLICATION_WORKSPACE_LABELS).map(
  ([key, label]) => ({ key, label }),
)
