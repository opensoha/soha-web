import { useEffect, useState } from 'react'
import type { MouseEvent } from 'react'
import { App, Button, Form, Input, Spin } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import type { BrandingSettings } from '@/types'
import { defaultBrandingSettings } from '@/utils/branding'
import { settingsMutations } from '../mutations'
import { settingsQueries } from '../queries'
import { SettingsCard, WIDE_FORM_LAYOUT } from '../shared/components'
import type { SettingsPageProps } from '../types'
import './styles.css'

export function BrandingSettingsPage({ embedded = false }: SettingsPageProps = {}) {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canViewBrandingSettings = hasPermission(
    permissionSnapshotQuery.data?.data,
    'settings.branding.view',
  )
  const permissionSnapshot = permissionSnapshotQuery.data?.data
  const canCreateBrandingSettings = hasPermission(permissionSnapshot, 'settings.branding.create')
  const canUpdateBrandingSettings = hasPermission(permissionSnapshot, 'settings.branding.update')

  const brandingQuery = useQuery(settingsQueries.branding(canViewBrandingSettings))
  const { data, isLoading } = brandingQuery
  const saveMutation = useMutation(settingsMutations.branding.save(queryClient))

  if (permissionSnapshotQuery.isLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
      </div>
    )
  }

  if (permissionSnapshotQuery.isError || brandingQuery.isError) {
    return (
      <div className="soha-page">
        <ManagementState
          kind="error"
          actions={
            <Button
              onClick={() => {
                void permissionSnapshotQuery.refetch()
                if (canViewBrandingSettings) {
                  void brandingQuery.refetch()
                }
              }}
            >
              重试
            </Button>
          }
        />
      </div>
    )
  }

  if (!canViewBrandingSettings) {
    return (
      <div className="soha-page">
        <ManagementState kind="no-permission" description="当前账号没有查看品牌设置的权限。" />
      </div>
    )
  }

  const settings = data
  const canManageBrandingSettings = settings ? canUpdateBrandingSettings : canCreateBrandingSettings
  const content = (
    <SettingsCard>
      <Form
        {...WIDE_FORM_LAYOUT}
        onFinish={(values) => {
          if (!canManageBrandingSettings) return
          saveMutation.mutate(values as BrandingSettings, {
            onSuccess: () => void message.success('品牌设置已保存'),
            onError: (err) => void message.error(err.message),
          })
        }}
        initialValues={{ ...defaultBrandingSettings, ...settings }}
      >
        <BrandingFormSync settings={settings} />
        <Form.Item name="appTitle" label="网页标题">
          <Input placeholder="浏览器标签页标题" />
        </Form.Item>
        <Form.Item name="sidebarTitle" label="侧边栏标题">
          <Input placeholder="左侧品牌栏文字" />
        </Form.Item>
        <Form.Item name="slogan" label="标语">
          <Input placeholder="登录页主标题" />
        </Form.Item>

        <div className="soha-branding-section-title">企业 Logo</div>
        <Form.Item name="loginLogoUrl" hidden>
          <Input />
        </Form.Item>
        <div className="soha-branding-upload-grid">
          <BrandingUploadField
            field="expandedLogoUrl"
            label="登录页主视觉与展开侧边栏 Logo"
            hint="用于登录页左侧主视觉和展开侧边栏；支持 JPG、PNG、SVG、ICO、WebP；建议尺寸 200 × 60 px；单个文件不超过 2 MB"
            previewWidth={200}
            previewHeight={60}
            disabled={!canManageBrandingSettings}
          />
          <BrandingUploadField
            field="collapsedLogoUrl"
            label="登录卡片与收起侧边栏图标"
            hint="用于登录卡片和收起侧边栏；支持 JPG、PNG、SVG、ICO、WebP；建议尺寸 60 × 60 px；单个文件不超过 2 MB"
            previewWidth={60}
            previewHeight={60}
            disabled={!canManageBrandingSettings}
          />
          <BrandingUploadField
            field="faviconUrl"
            label="Favicon 图标"
            hint="支持 JPG、PNG、SVG、ICO、WebP；建议尺寸 16 × 16、32 × 32 或 64 × 64 px；单个文件不超过 2 MB"
            previewWidth={64}
            previewHeight={64}
            disabled={!canManageBrandingSettings}
          />
        </div>

        <div className="soha-form-actions">
          {canManageBrandingSettings ? (
            <Button htmlType="submit" type="primary" loading={saveMutation.isPending}>
              保存设置
            </Button>
          ) : null}
        </div>
      </Form>
    </SettingsCard>
  )

  if (embedded) {
    return content
  }

  return <div className="soha-page">{content}</div>
}

function BrandingFormSync({ settings }: { settings?: BrandingSettings }) {
  const form = Form.useFormInstance<BrandingSettings>()

  useEffect(() => {
    if (settings && !form.isFieldsTouched()) {
      form.setFieldsValue(settings)
    }
  }, [form, settings])

  return null
}

interface BrandingUploadFieldProps {
  field: string
  label: string
  hint: string
  previewWidth: number
  previewHeight: number
  disabled?: boolean
}

function BrandingUploadField({
  field,
  label,
  hint,
  previewWidth,
  previewHeight,
  disabled,
}: BrandingUploadFieldProps) {
  const { message } = App.useApp()
  const [uploading, setUploading] = useState(false)
  const uploadMutation = useMutation(settingsMutations.branding.upload())
  const form = Form.useFormInstance()
  const currentValue = Form.useWatch(field, form) as string | undefined

  const handleUploadClick = () => {
    if (disabled || uploading) return
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.jpg,.jpeg,.png,.svg,.ico,.webp'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 2 * 1024 * 1024) {
        void message.error('文件大小不能超过 2MB')
        return
      }
      setUploading(true)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const result = await uploadMutation.mutateAsync(formData)
        form.setFieldValue(field, result.url)
        void message.success('图片上传成功')
      } catch (err: any) {
        void message.error(err?.message ?? '上传失败')
      } finally {
        setUploading(false)
      }
    }
    input.click()
  }

  const handleRemove = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    form.setFieldValue(field, '')
  }

  return (
    <div className="soha-branding-upload-zone">
      <div className="soha-branding-upload-label">{label}</div>
      <Form.Item name={field} hidden>
        <Input />
      </Form.Item>
      <div className="soha-branding-upload-area-wrap">
        <button
          type="button"
          className="soha-branding-upload-area"
          aria-label={`${currentValue ? '替换' : '上传'}${label}`}
          disabled={disabled || uploading}
          onClick={handleUploadClick}
        >
          {currentValue ? (
            <img
              src={currentValue}
              alt={label}
              className="soha-branding-upload-preview"
              style={{ maxWidth: previewWidth, maxHeight: previewHeight }}
            />
          ) : (
            <div className="soha-branding-upload-placeholder">
              {uploading ? (
                <Spin size="small" />
              ) : (
                <span className="soha-branding-upload-plus">+</span>
              )}
            </div>
          )}
        </button>
        {currentValue && !disabled ? (
          <Button
            size="small"
            danger
            variant="outlined"
            className="soha-branding-upload-remove"
            onClick={handleRemove}
          >
            移除
          </Button>
        ) : null}
      </div>
      <div className="soha-branding-upload-hint">{hint}</div>
    </div>
  )
}
