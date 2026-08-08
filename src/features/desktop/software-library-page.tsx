import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircleFilled,
  CloudDownloadOutlined,
  DownloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Alert, App, Button, Empty, Input, Progress, Skeleton, Tag } from 'antd'
import { useMutation, useQuery } from '@tanstack/react-query'
import { desktopKeys } from './keys'
import {
  getSoftwareCatalog,
  getSoftwareInstallTask,
  installSoftware,
  type DesktopSoftwarePackage,
  type SoftwareInstallTask,
} from './software-library-api'

const activeStates = new Set(['queued', 'downloading', 'verifying', 'opening'])

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / 1024 / 1024)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function SoftwareCard({
  item,
  task,
  busy,
  onInstall,
}: {
  item: DesktopSoftwarePackage
  task?: SoftwareInstallTask
  busy: boolean
  onInstall: (item: DesktopSoftwarePackage) => void
}) {
  const active = Boolean(task && activeStates.has(task.state))
  return (
    <article className="soha-desktop-software-card">
      <div className="soha-desktop-software-icon" aria-hidden="true">
        {item.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="soha-desktop-software-copy">
        <div className="soha-desktop-software-title">
          <h2>{item.name}</h2>
          {item.category ? <Tag>{item.category}</Tag> : null}
        </div>
        <p>{item.description || `${item.publisher} 提供的软件`}</p>
        <small>
          {item.publisher} · {item.version} · {formatSize(item.size)}
        </small>
      </div>
      <Button
        aria-label={`${
          task?.state === 'failed' ? '重试安装' : task?.state === 'completed' ? '再次下载' : '安装'
        } ${item.name}`}
        disabled={busy && !active}
        icon={task?.state === 'completed' ? <CheckCircleFilled /> : <DownloadOutlined />}
        loading={active}
        onClick={() => onInstall(item)}
        type={task?.state === 'completed' ? 'default' : 'primary'}
      >
        {task?.state === 'failed' ? '重试' : task?.state === 'completed' ? '再次下载' : '安装'}
      </Button>
      {task ? (
        <div className="soha-desktop-software-progress" aria-live="polite">
          <Progress
            percent={task.progress}
            size="small"
            status={
              task.state === 'failed'
                ? 'exception'
                : task.state === 'completed'
                  ? 'success'
                  : undefined
            }
          />
          <span>{task.message}</span>
        </div>
      ) : null}
    </article>
  )
}

export function SoftwareLibraryPage() {
  const { message, modal } = App.useApp()
  const [query, setQuery] = useState('')
  const [task, setTask] = useState<SoftwareInstallTask>()
  const catalogQuery = useQuery({
    queryKey: desktopKeys.software(),
    queryFn: getSoftwareCatalog,
  })
  const installMutation = useMutation({
    mutationFn: installSoftware,
    onSuccess: setTask,
    onError: (error) => message.error(error instanceof Error ? error.message : '安装任务启动失败'),
  })

  useEffect(() => {
    if (!task || !activeStates.has(task.state)) return
    const timeout = window.setTimeout(() => {
      void getSoftwareInstallTask(task.id)
        .then(setTask)
        .catch((error) => {
          const detail = error instanceof Error ? error.message : '读取安装进度失败'
          setTask((current) =>
            current ? { ...current, state: 'failed', message: detail } : current,
          )
          message.error(detail)
        })
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [message, task])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    return (catalogQuery.data ?? []).filter((item) => {
      const searchText = [item.name, item.description, item.publisher, item.category, item.version]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return !keyword || searchText.includes(keyword)
    })
  }, [catalogQuery.data, query])

  const confirmInstall = (item: DesktopSoftwarePackage) => {
    modal.confirm({
      title: `安装 ${item.name}`,
      content: `Soha 将下载并校验 ${item.version} 安装包，然后交给系统安装器。`,
      okText: '下载并打开',
      cancelText: '取消',
      icon: <SafetyCertificateOutlined />,
      onOk: () => installMutation.mutate(item.id),
    })
  }

  const busy = installMutation.isPending || Boolean(task && activeStates.has(task.state))

  return (
    <div className="soha-desktop-page">
      <header className="soha-desktop-page-heading">
        <span>SOFTWARE LIBRARY</span>
        <h1>软件库</h1>
        <p>下载组织批准的软件，并由系统安装器完成安装。</p>
      </header>

      <section className="soha-desktop-software-status" aria-label="软件安装安全">
        <CloudDownloadOutlined />
        <span>
          <strong>受控软件下载</strong>
          <small>安装包将在本机完成完整性校验</small>
        </span>
      </section>

      <div className="soha-desktop-toolbar">
        <Input
          allowClear
          aria-label="搜索软件"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索名称、厂商或分类"
          prefix={<SearchOutlined />}
          value={query}
        />
        <span>{filtered.length} 个软件</span>
      </div>

      {catalogQuery.isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : null}
      {catalogQuery.isError ? <Alert title="软件目录暂不可用" type="error" showIcon /> : null}
      {catalogQuery.data && !catalogQuery.data.length ? (
        <Empty description="软件目录尚未配置" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : null}
      {Boolean(catalogQuery.data?.length) && !filtered.length ? (
        <Empty description="没有匹配的软件" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : null}
      {filtered.length ? (
        <div className="soha-desktop-software-grid">
          {filtered.map((item) => (
            <SoftwareCard
              busy={busy}
              item={item}
              key={item.id}
              onInstall={confirmInstall}
              task={task?.softwareId === item.id ? task : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
