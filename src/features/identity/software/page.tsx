import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Typography,
  Upload,
} from 'antd'
import type { TableColumnsType, UploadFile } from 'antd'
import {
  CloudDownloadOutlined,
  DeleteOutlined,
  FileAddOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { ManagementDataPage } from '@/components/management-data-page'
import {
  ManagementIconButton,
  ManagementQueryActions,
  ManagementQueryField,
  ManagementRefreshButton,
  ManagementState,
  ManagementTableToolbar,
} from '@/components/management-list'
import { MetadataTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import { softwarePackageMutations } from './mutations'
import { softwarePackageQueries } from './queries'
import type { SoftwarePackage, SoftwarePackageFilters, SoftwarePackagePublishInput } from './types'
import './styles.css'

const { Text } = Typography

const platformOptions = [
  { label: 'macOS', value: 'darwin' },
  { label: 'Windows', value: 'windows' },
  { label: 'Linux', value: 'linux' },
]

const architectureOptions = [
  { label: 'ARM64', value: 'arm64' },
  { label: 'x86_64', value: 'amd64' },
]

const installerAccept: Record<string, string> = {
  darwin: '.dmg,.pkg',
  windows: '.exe,.msi',
  linux: '.AppImage,.appimage,.deb,.rpm',
}

interface SoftwareUploadFormValues {
  softwareId: string
  name: string
  description?: string
  publisher: string
  category?: string
  version: string
  platform: string
  arch: string
  fileList: UploadFile[]
  url?: string
  fileName?: string
}

interface SoftwareUploadModalProps {
  open: boolean
  saving: boolean
  onCancel: () => void
  onSubmit: (input: SoftwarePackagePublishInput) => void
}

function SoftwareUploadModal({ open, saving, onCancel, onSubmit }: SoftwareUploadModalProps) {
  const { t } = useI18n()
  const [form] = Form.useForm<SoftwareUploadFormValues>()
  const [source, setSource] = useState<'file' | 'url'>('file')
  const platform = Form.useWatch('platform', form) ?? 'darwin'

  useEffect(() => {
    if (open) {
      form.resetFields()
      setSource('file')
    }
  }, [form, open])

  const submit = (values: SoftwareUploadFormValues) => {
    const metadata = {
      softwareId: values.softwareId,
      name: values.name,
      description: values.description,
      publisher: values.publisher,
      category: values.category,
      version: values.version,
      platform: values.platform,
      arch: values.arch,
    }
    if (source === 'file') {
      const file = values.fileList[0]?.originFileObj
      if (file) onSubmit({ source, ...metadata, file })
      return
    }
    if (values.url) {
      onSubmit({ source, ...metadata, url: values.url, fileName: values.fileName })
    }
  }

  return (
    <Modal
      closable={!saving}
      destroyOnHidden
      footer={null}
      mask={{ closable: false }}
      open={open}
      title={t('software.upload.title', '发布软件版本')}
      width={760}
      onCancel={onCancel}
    >
      <Form
        className="soha-software-upload-form"
        form={form}
        initialValues={{ platform: 'darwin', arch: 'arm64', fileList: [] }}
        layout="vertical"
        onFinish={submit}
      >
        <div className="soha-software-form-grid">
          <Form.Item
            label={t('software.field.softwareId', '软件 ID')}
            name="softwareId"
            rules={[
              { required: true, message: '请输入软件 ID' },
              {
                pattern: /^[a-z0-9][a-z0-9._-]{0,63}$/,
                message: '仅支持小写字母、数字、点、下划线和短横线',
              },
            ]}
          >
            <Input placeholder="soha-desktop" />
          </Form.Item>
          <Form.Item
            label={t('software.field.name', '软件名称')}
            name="name"
            rules={[{ required: true, max: 100, message: '请输入软件名称' }]}
          >
            <Input placeholder="Soha Desktop" />
          </Form.Item>
          <Form.Item
            label={t('software.field.publisher', '发布者')}
            name="publisher"
            rules={[{ required: true, max: 100, message: '请输入发布者' }]}
          >
            <Input placeholder="OpenSoha" />
          </Form.Item>
          <Form.Item
            label={t('software.field.version', '版本')}
            name="version"
            rules={[{ required: true, max: 64, message: '请输入版本号' }]}
          >
            <Input placeholder="1.0.0" />
          </Form.Item>
          <Form.Item label={t('software.field.platform', '平台')} name="platform">
            <Select options={platformOptions} onChange={() => form.setFieldValue('fileList', [])} />
          </Form.Item>
          <Form.Item label={t('software.field.arch', '架构')} name="arch">
            <Select options={architectureOptions} />
          </Form.Item>
          <Form.Item label={t('software.field.category', '分类')} name="category">
            <Input maxLength={50} placeholder="Developer Tools" />
          </Form.Item>
        </div>
        <Form.Item label={t('software.field.description', '描述')} name="description">
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} maxLength={500} />
        </Form.Item>
        <Segmented<'file' | 'url'>
          block
          className="soha-software-source-segmented"
          options={[
            { icon: <FileAddOutlined />, label: '本地文件', value: 'file' },
            { icon: <CloudDownloadOutlined />, label: '下载地址', value: 'url' },
          ]}
          value={source}
          onChange={(value) => {
            setSource(value)
            form.setFieldsValue({ fileList: [], url: undefined, fileName: undefined })
          }}
        />
        {source === 'file' ? (
          <Form.Item
            getValueFromEvent={(event: { fileList: UploadFile[] }) => event.fileList}
            label={t('software.field.file', '安装包')}
            name="fileList"
            rules={[{ required: true, message: '请选择安装包' }]}
            valuePropName="fileList"
          >
            <Upload accept={installerAccept[platform]} beforeUpload={() => false} maxCount={1}>
              <Button icon={<FileAddOutlined />}>
                {t('software.upload.selectFile', '选择安装包')}
              </Button>
            </Upload>
          </Form.Item>
        ) : (
          <div className="soha-software-form-grid soha-software-url-fields">
            <Form.Item
              label="HTTPS 下载地址"
              name="url"
              rules={[
                { required: true, message: '请输入下载地址' },
                { pattern: /^https:\/\//, message: '仅支持 HTTPS 地址' },
              ]}
            >
              <Input placeholder="https://downloads.example.com/app.dmg" />
            </Form.Item>
            <Form.Item label="文件名（可选）" name="fileName">
              <Input maxLength={255} placeholder="app.dmg" />
            </Form.Item>
          </div>
        )}
        <div className="soha-software-form-actions">
          <Space>
            <Button disabled={saving} onClick={onCancel}>
              {t('common.cancel', '取消')}
            </Button>
            <Button
              autoInsertSpace={false}
              htmlType="submit"
              icon={<UploadOutlined />}
              loading={saving}
              type="primary"
            >
              {source === 'file'
                ? t('software.upload.submit', '上传并发布')
                : t('software.import.submit', '下载并发布')}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  )
}

function formatBytes(value: number) {
  const units = ['B', 'KiB', 'MiB', 'GiB']
  let size = value
  let index = 0
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index += 1
  }
  return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`
}

interface SoftwareManagementPageProps {
  view: 'packages' | 'storage'
}

export function SoftwareLibraryPage() {
  return <SoftwareManagementPage view="packages" />
}

export function SoftwareManagementPage({ view }: SoftwareManagementPageProps) {
  const { message } = App.useApp()
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [queryForm] = Form.useForm<SoftwarePackageFilters>()
  const [filters, setFilters] = useState<SoftwarePackageFilters>({})
  const [uploadOpen, setUploadOpen] = useState(false)
  const snapshot = usePermissionSnapshot().data?.data
  const canUpload = hasPermission(snapshot, 'software.package.create')
  const canDelete = hasPermission(snapshot, 'software.package.delete')
  const packagesQuery = useQuery({
    ...softwarePackageQueries.list(filters),
    enabled: view === 'packages',
  })
  const storageQuery = useQuery({
    ...softwarePackageQueries.storage(),
    enabled: view === 'storage',
  })
  const publishMutation = useMutation(softwarePackageMutations.publish(queryClient))
  const deleteMutation = useMutation(softwarePackageMutations.remove(queryClient))

  const deleteAction = useCallback(
    (record: SoftwarePackage) => (
      <Popconfirm
        cancelText={t('common.cancel', '取消')}
        disabled={!canDelete}
        okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
        okText={t('common.delete', '删除')}
        title={`${t('software.delete.title', '删除软件版本')} ${record.name} ${record.version}`}
        onConfirm={() =>
          deleteMutation.mutate(record.id, {
            onSuccess: () => message.success(t('software.delete.success', '软件版本已删除')),
          })
        }
      >
        <ManagementIconButton
          aria-label={t('common.delete', '删除')}
          danger
          disabled={!canDelete}
          icon={<DeleteOutlined />}
          tooltip={t('common.delete', '删除')}
        />
      </Popconfirm>
    ),
    [canDelete, deleteMutation, message, t],
  )

  const columns = useMemo<TableColumnsType<SoftwarePackage>>(
    () => [
      {
        title: t('software.column.software', '软件'),
        dataIndex: 'name',
        width: 280,
        render: (_, record) => (
          <Space orientation="vertical" size={2}>
            <Text strong>{record.name}</Text>
            <Text type="secondary">{record.softwareId}</Text>
          </Space>
        ),
      },
      {
        title: t('software.column.version', '版本'),
        dataIndex: 'version',
        width: 140,
        render: (value: string) => <MetadataTag label={value} tone="blue" />,
      },
      {
        title: t('software.column.target', '平台 / 架构'),
        key: 'target',
        width: 190,
        render: (_, record) => (
          <Space size={4}>
            <MetadataTag label={record.platform} />
            <MetadataTag label={record.arch === 'amd64' ? 'x86_64' : record.arch} tone="cyan" />
          </Space>
        ),
      },
      {
        title: t('software.column.file', '安装包'),
        dataIndex: 'fileName',
        width: 260,
        render: (value: string, record) => (
          <Space orientation="vertical" size={2}>
            <Text ellipsis title={value}>
              {value}
            </Text>
            <Text type="secondary">{formatBytes(record.sizeBytes)}</Text>
          </Space>
        ),
      },
      {
        title: 'SHA-256',
        dataIndex: 'sha256',
        width: 180,
        render: (value: string) => (
          <Text code title={value}>
            {value.slice(0, 12)}...
          </Text>
        ),
      },
      {
        title: t('software.column.publisher', '发布者'),
        dataIndex: 'publisher',
        width: 160,
      },
      {
        title: t('software.column.createdAt', '上传时间'),
        dataIndex: 'createdAt',
        width: 170,
        render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: t('common.actions', '操作'),
        key: 'actions',
        fixed: 'right',
        width: 64,
        render: (_, record) => deleteAction(record),
      },
    ],
    [deleteAction, t],
  )

  const storageColumns = useMemo<TableColumnsType<SoftwarePackage>>(
    () => [
      {
        title: t('software.column.file', '存储文件'),
        dataIndex: 'fileName',
        key: 'storage-file',
        width: 300,
        render: (value: string, record) => (
          <Space orientation="vertical" size={2}>
            <Text strong ellipsis title={value}>
              {value}
            </Text>
            <Text type="secondary">{record.id}</Text>
          </Space>
        ),
      },
      {
        title: t('software.column.software', '所属软件'),
        dataIndex: 'name',
        key: 'storage-software',
        width: 240,
        render: (_, record) => (
          <Space orientation="vertical" size={2}>
            <Text>{record.name}</Text>
            <MetadataTag label={record.version} tone="blue" />
          </Space>
        ),
      },
      {
        title: t('software.column.target', '平台 / 架构'),
        key: 'storage-target',
        width: 190,
        render: (_, record) => (
          <Space size={4}>
            <MetadataTag label={record.platform} />
            <MetadataTag label={record.arch === 'amd64' ? 'x86_64' : record.arch} tone="cyan" />
          </Space>
        ),
      },
      {
        title: t('software.storage.size', '占用空间'),
        dataIndex: 'sizeBytes',
        key: 'storage-size',
        width: 140,
        render: (value: number) => formatBytes(value),
      },
      {
        title: 'SHA-256',
        dataIndex: 'sha256',
        key: 'storage-sha256',
        width: 180,
        render: (value: string) => (
          <Text code title={value}>
            {value.slice(0, 12)}...
          </Text>
        ),
      },
      {
        title: t('software.storage.createdAt', '存入时间'),
        dataIndex: 'createdAt',
        key: 'storage-created-at',
        width: 170,
        render: (value: string) => dayjs(value).format('YYYY-MM-DD HH:mm'),
      },
      {
        title: t('common.actions', '操作'),
        key: 'storage-actions',
        fixed: 'right',
        width: 64,
        render: (_, record) => deleteAction(record),
      },
    ],
    [deleteAction, t],
  )

  const resetFilters = () => {
    queryForm.resetFields()
    setFilters({})
  }

  return (
    <div className="soha-software-library-shell">
      {view === 'packages' ? (
        <ManagementDataPage
          key="software-packages"
          className="soha-software-library-page"
          query={{
            actions: (
              <ManagementQueryActions
                disabledReset={!filters.platform && !filters.arch}
                loading={packagesQuery.isFetching}
                onReset={resetFilters}
              />
            ),
            children: (
              <>
                <ManagementQueryField
                  label={t('software.field.platform', '平台')}
                  name="platform"
                  width={180}
                >
                  <Select
                    allowClear
                    options={platformOptions}
                    placeholder={t('software.filter.allPlatforms', '全部平台')}
                  />
                </ManagementQueryField>
                <ManagementQueryField
                  label={t('software.field.arch', '架构')}
                  name="arch"
                  width={180}
                >
                  <Select
                    allowClear
                    options={architectureOptions}
                    placeholder={t('software.filter.allArch', '全部架构')}
                  />
                </ManagementQueryField>
              </>
            ),
            form: queryForm,
            initialValues: {},
            onFinish: (values) => setFilters({ platform: values.platform, arch: values.arch }),
          }}
          table={{
            columnSettingIconOnly: true,
            columnSettingPlacement: 'header',
            columns,
            dataSource: packagesQuery.data?.items ?? [],
            empty: (
              <ManagementState
                description={t('software.empty.description', '尚未发布任何桌面安装包。')}
                kind="empty"
                title={t('software.empty.title', '暂无软件版本')}
              />
            ),
            headerExtra: (
              <ManagementTableToolbar>
                <Button
                  autoInsertSpace={false}
                  disabled={!canUpload}
                  icon={<UploadOutlined />}
                  size="small"
                  type="primary"
                  onClick={() => setUploadOpen(true)}
                >
                  {t('software.upload.action', '上传软件')}
                </Button>
                <ManagementRefreshButton
                  aria-label={t('common.refresh', '刷新')}
                  loading={packagesQuery.isFetching}
                  title={t('common.refresh', '刷新')}
                  tooltip={t('common.refresh', '刷新')}
                  onClick={() => void packagesQuery.refetch()}
                />
              </ManagementTableToolbar>
            ),
            loading: packagesQuery.isLoading || packagesQuery.isFetching,
            pagination: { pageSize: 20 },
            rowKey: 'id',
            scroll: { x: 'max-content' },
          }}
        />
      ) : (
        <ManagementDataPage
          key="software-storage"
          beforeQuery={
            <div className="soha-software-storage-summary">
              <div>
                <Text type="secondary">存储后端</Text>
                <Text strong>
                  {storageQuery.data?.backend === 'filesystem'
                    ? '本地文件系统'
                    : storageQuery.data?.backend || '-'}
                </Text>
              </div>
              <div>
                <Text type="secondary">文件数量</Text>
                <Text strong>{storageQuery.data?.objectCount ?? '-'}</Text>
              </div>
              <div>
                <Text type="secondary">已用空间</Text>
                <Text strong>
                  {storageQuery.data ? formatBytes(storageQuery.data.totalBytes) : '-'}
                </Text>
              </div>
            </div>
          }
          className="soha-software-library-page"
          table={{
            columnSettingIconOnly: true,
            columnSettingPlacement: 'header',
            columns: storageColumns,
            dataSource: storageQuery.data?.items ?? [],
            empty: storageQuery.isError ? (
              <ManagementState kind="error" title="存储信息加载失败" />
            ) : (
              <ManagementState
                description={t('software.storage.empty.description', '存储中暂无软件安装包。')}
                kind="empty"
                title={t('software.storage.empty.title', '暂无存储文件')}
              />
            ),
            headerExtra: (
              <ManagementTableToolbar>
                <ManagementRefreshButton
                  aria-label={t('common.refresh', '刷新')}
                  loading={storageQuery.isFetching}
                  title={t('common.refresh', '刷新')}
                  tooltip={t('common.refresh', '刷新')}
                  onClick={() => void storageQuery.refetch()}
                />
              </ManagementTableToolbar>
            ),
            loading: storageQuery.isLoading || storageQuery.isFetching,
            pagination: { pageSize: 20 },
            rowKey: 'id',
            scroll: { x: 'max-content' },
          }}
        />
      )}
      {view === 'packages' ? (
        <SoftwareUploadModal
          open={uploadOpen}
          saving={publishMutation.isPending}
          onCancel={() => setUploadOpen(false)}
          onSubmit={(input) =>
            publishMutation.mutate(input, {
              onSuccess: (item) => {
                message.success(
                  `${item.name} ${item.version} ${t('software.upload.success', '已发布')}`,
                )
                setUploadOpen(false)
              },
            })
          }
        />
      ) : null}
    </div>
  )
}
