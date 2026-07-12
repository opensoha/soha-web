export const ACCESS_ACTION_OPTIONS = [
  { value: 'view', label: '查看 (view)' },
  { value: 'list', label: '列表 (list)' },
  { value: 'watch', label: '监听 (watch)' },
  { value: 'update', label: '修改 (update)' },
  { value: 'delete', label: '删除 (delete)' },
  { value: 'restart', label: '重启 (restart)' },
  { value: 'scale', label: '伸缩 (scale)' },
  { value: 'logs', label: '日志 (logs)' },
  { value: 'exec', label: 'Exec (exec)' },
]

export const ACCESS_ACTION_LABEL_MAP = Object.fromEntries(
  ACCESS_ACTION_OPTIONS.map((option) => [option.value, option.label]),
) as Record<string, string>
