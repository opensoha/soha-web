import { useEffect, useState } from 'react'
import { DownloadOutlined, FileOutlined, FolderOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Card, Input, List, Select, Space, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import '@/components/resource-operation-panels.css'
import { downloadText } from '@/utils/download'
import { dockerQueries } from '../queries'
import type { DockerProjectVolumeFileEntry } from '../docker-types'
import { runtimeServiceSelector, type DockerRuntimePanelProps } from './shared'
import './styles.css'

const { Text } = Typography
const { TextArea } = Input

export function DockerProjectVolumesPanel({
  enabled,
  projectId,
  serviceName,
  serviceOptions,
  servicesLoading,
  onServiceChange,
}: DockerRuntimePanelProps) {
  const [target, setTarget] = useState('')
  const [currentPath, setCurrentPath] = useState('/')
  const [previewPath, setPreviewPath] = useState('')
  const canBrowseRuntime = enabled && Boolean(projectId && serviceName)
  const volumesQuery = useQuery(
    dockerQueries.projectVolumes(projectId, { serviceName }, canBrowseRuntime),
  )
  const volumes = volumesQuery.data ?? []
  const filesQuery = useQuery(
    dockerQueries.projectVolumeFiles(
      projectId,
      { serviceName, target, path: currentPath, limit: 300 },
      canBrowseRuntime && Boolean(target),
    ),
  )
  const fileQuery = useQuery(
    dockerQueries.projectVolumeFile(
      projectId,
      { serviceName, target, path: previewPath, limitBytes: 262144 },
      canBrowseRuntime && Boolean(target && previewPath),
    ),
  )

  useEffect(() => {
    const firstTarget = volumes[0]?.target || ''
    setTarget((current) => current || firstTarget)
  }, [volumes])

  useEffect(() => {
    setTarget('')
    setCurrentPath('/')
    setPreviewPath('')
  }, [serviceName])

  const selectedVolume = volumes.find((item) => item.target === target)
  const entries = filesQuery.data?.items ?? []
  const preview = fileQuery.data
  const goParent = () => {
    const clean = currentPath.replace(/\/+$/, '')
    const parent = clean.includes('/') ? clean.slice(0, clean.lastIndexOf('/')) || '/' : '/'
    setCurrentPath(parent)
    setPreviewPath('')
  }
  const openEntry = (entry: DockerProjectVolumeFileEntry) => {
    if (entry.kind === 'directory') {
      setCurrentPath(entry.path || '/')
      setPreviewPath('')
      return
    }
    setPreviewPath(entry.path)
  }

  if (!enabled) {
    return (
      <Card className="soha-docker-runtime-card" size="small">
        <ManagementState
          compact
          kind="no-permission"
          title="卷文件不可用"
          description="Docker 模块或当前权限不允许浏览运行时卷文件。"
        />
      </Card>
    )
  }

  return (
    <Card
      className="soha-docker-runtime-card"
      size="small"
      title="卷文件"
      extra={
        <Space size={8} wrap>
          {runtimeServiceSelector({
            disabled: !enabled,
            loading: servicesLoading,
            options: serviceOptions,
            serviceName,
            onChange: onServiceChange,
          })}
          <Select
            disabled={!enabled || volumes.length === 0}
            loading={volumesQuery.isFetching}
            options={volumes.map((volume) => ({ label: volume.target, value: volume.target }))}
            placeholder="选择卷"
            popupMatchSelectWidth={false}
            size="small"
            style={{ minWidth: 180 }}
            value={target || undefined}
            onChange={(value) => {
              setTarget(value)
              setCurrentPath('/')
              setPreviewPath('')
            }}
          />
          <Button
            disabled={!enabled}
            icon={<ReloadOutlined />}
            loading={filesQuery.isFetching || volumesQuery.isFetching}
            size="small"
            onClick={() => {
              volumesQuery.refetch()
              filesQuery.refetch()
            }}
          >
            刷新
          </Button>
        </Space>
      }
    >
      {volumes.length === 0 && !volumesQuery.isFetching ? (
        <ManagementState
          compact
          kind="empty"
          title="没有可浏览的卷"
          description="该服务没有声明可从容器内浏览的卷挂载。"
        />
      ) : (
        <>
          <div className="soha-docker-volume-toolbar">
            <Button disabled={currentPath === '/'} size="small" onClick={goParent}>
              上级
            </Button>
            <Input
              size="small"
              value={currentPath}
              onChange={(event) => setCurrentPath(event.target.value || '/')}
            />
            {selectedVolume ? (
              <Space size={6} wrap>
                {selectedVolume.readOnly ? <Tag>只读</Tag> : null}
                {selectedVolume.source ? (
                  <Text type="secondary">{selectedVolume.source}</Text>
                ) : null}
              </Space>
            ) : null}
          </div>
          <div className="soha-docker-volume-browser">
            <div className="soha-docker-volume-list">
              <List
                dataSource={entries}
                loading={filesQuery.isFetching}
                locale={{ emptyText: '暂无文件' }}
                renderItem={(entry) => (
                  <List.Item
                    className="soha-docker-volume-file-row"
                    onClick={() => openEntry(entry)}
                  >
                    <Space size={8}>
                      {entry.kind === 'directory' ? <FolderOutlined /> : <FileOutlined />}
                      <Text>{entry.name}</Text>
                    </Space>
                    <Text type="secondary">
                      {entry.kind === 'directory' ? '-' : `${entry.sizeBytes ?? 0} B`}
                    </Text>
                  </List.Item>
                )}
              />
            </div>
            <div className="soha-docker-volume-preview">
              <div className="soha-docker-volume-preview-toolbar">
                <Text type="secondary">
                  {fileQuery.isFetching ? '正在读取文件...' : previewPath || '选择文件预览'}
                </Text>
                <Button
                  disabled={!preview}
                  icon={<DownloadOutlined />}
                  size="small"
                  onClick={() =>
                    preview &&
                    downloadText(
                      preview.path.split('/').pop() || 'volume-file.txt',
                      preview.content,
                    )
                  }
                >
                  下载
                </Button>
              </div>
              <TextArea
                readOnly
                rows={18}
                spellCheck={false}
                value={
                  preview ? `${preview.truncated ? '[内容已截断]\n' : ''}${preview.content}` : ''
                }
              />
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
