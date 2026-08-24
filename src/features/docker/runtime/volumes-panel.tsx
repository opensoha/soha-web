import { useEffect, useState } from 'react'
import { DownloadOutlined, FileOutlined, FolderOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Card, Input, Select, Space, Spin, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import { MetadataTag } from '@/components/status-tag'
import '@/components/resource-operation-panels.css'
import { downloadText } from '@/utils/download'
import { dockerQueries } from '../queries'
import { localeText, useI18n } from '@/i18n'
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
  const { localeCode } = useI18n()
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
      <Card className="soha-detail-card" size="small">
        <ManagementState
          compact
          kind="no-permission"
          title={localeText(localeCode, '卷文件不可用', 'Volume files unavailable')}
          description={localeText(
            localeCode,
            'Docker 模块或当前权限不允许浏览运行时卷文件。',
            'The Docker module or your permissions do not allow browsing runtime volume files.',
          )}
        />
      </Card>
    )
  }

  return (
    <Card
      className="soha-detail-card"
      size="small"
      title={localeText(localeCode, '卷文件', 'Volume files')}
      extra={
        <Space size={8} wrap>
          {runtimeServiceSelector({
            disabled: !enabled,
            loading: servicesLoading,
            options: serviceOptions,
            serviceName,
            localeCode,
            onChange: onServiceChange,
          })}
          <Select
            disabled={!enabled || volumes.length === 0}
            loading={volumesQuery.isFetching}
            options={volumes.map((volume) => ({ label: volume.target, value: volume.target }))}
            placeholder={localeText(localeCode, '选择卷', 'Select volume')}
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
            {localeText(localeCode, '刷新', 'Refresh')}
          </Button>
        </Space>
      }
    >
      {volumes.length === 0 && !volumesQuery.isFetching ? (
        <ManagementState
          compact
          kind="empty"
          title={localeText(localeCode, '没有可浏览的卷', 'No browsable volumes')}
          description={localeText(
            localeCode,
            '该服务没有声明可从容器内浏览的卷挂载。',
            'This service does not expose a volume mount that can be browsed from the container.',
          )}
        />
      ) : (
        <>
          <div className="soha-docker-volume-toolbar">
            <Button disabled={currentPath === '/'} size="small" onClick={goParent}>
              {localeText(localeCode, '上级', 'Parent')}
            </Button>
            <Input
              size="small"
              value={currentPath}
              onChange={(event) => setCurrentPath(event.target.value || '/')}
            />
            {selectedVolume ? (
              <Space size={6} wrap>
                {selectedVolume.readOnly ? (
                  <MetadataTag label={localeText(localeCode, '只读', 'Read-only')} />
                ) : null}
                {selectedVolume.source ? (
                  <Text type="secondary">{selectedVolume.source}</Text>
                ) : null}
              </Space>
            ) : null}
          </div>
          <div className="soha-docker-volume-browser">
            <div className="soha-docker-volume-list">
              {filesQuery.isFetching ? (
                <div className="soha-docker-volume-list-state">
                  <Spin size="small" />
                </div>
              ) : entries.length === 0 ? (
                <div className="soha-docker-volume-list-state">
                  <Text type="secondary">{localeText(localeCode, '暂无文件', 'No files')}</Text>
                </div>
              ) : (
                entries.map((entry) => (
                  <button
                    className="soha-docker-volume-file-row"
                    key={entry.path}
                    type="button"
                    onClick={() => openEntry(entry)}
                  >
                    <Space size={8}>
                      {entry.kind === 'directory' ? <FolderOutlined /> : <FileOutlined />}
                      <Text>{entry.name}</Text>
                    </Space>
                    <Text type="secondary">
                      {entry.kind === 'directory' ? '-' : `${entry.sizeBytes ?? 0} B`}
                    </Text>
                  </button>
                ))
              )}
            </div>
            <div className="soha-docker-volume-preview">
              <div className="soha-docker-volume-preview-toolbar">
                <Text type="secondary">
                  {fileQuery.isFetching
                    ? localeText(localeCode, '正在读取文件...', 'Reading file...')
                    : previewPath ||
                      localeText(localeCode, '选择文件预览', 'Select a file to preview')}
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
                  {localeText(localeCode, '下载', 'Download')}
                </Button>
              </div>
              <TextArea
                readOnly
                rows={18}
                spellCheck={false}
                value={
                  preview
                    ? `${preview.truncated ? localeText(localeCode, '[内容已截断]\n', '[Content truncated]\n') : ''}${preview.content}`
                    : ''
                }
              />
            </div>
          </div>
        </>
      )}
    </Card>
  )
}
