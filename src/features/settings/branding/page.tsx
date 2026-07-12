import { useState } from 'react'
import type { MouseEvent } from 'react'
import { Button, Form, Input, Spin, message } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ManagementState } from '@/components/management-list'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import type { BrandingSettings } from '@/types'
import { settingsMutations } from '../mutations'
import { settingsQueries } from '../queries'
import { SettingsCard, WIDE_FORM_LAYOUT } from '../shared/components'
import type { SettingsPageProps } from '../types'
import './styles.css'

export function BrandingSettingsPage({ embedded = false }: SettingsPageProps = {}) {
  const queryClient = useQueryClient()
  const permissionSnapshotQuery = usePermissionSnapshot()
  const canViewBrandingSettings = hasPermission(
    permissionSnapshotQuery.data?.data,
    'settings.branding.view',
  )
  const canManageBrandingSettings = hasPermission(
    permissionSnapshotQuery.data?.data,
    'settings.branding.manage',
  )

  const { data, isLoading } = useQuery(settingsQueries.branding())
  const saveMutation = useMutation(settingsMutations.branding.save(queryClient))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spin size="large" />
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
        initialValues={settings ?? { appTitle: 'Soha', sidebarTitle: 'Soha' }}
      >
        <Form.Item name="appTitle" label="网页标题">
          <Input placeholder="浏览器标签页标题" />
        </Form.Item>
        <Form.Item name="sidebarTitle" label="侧边栏标题">
          <Input placeholder="左侧品牌栏文字" />
        </Form.Item>

        <div className="soha-branding-section-title">企业 Logo</div>
        <div className="soha-branding-upload-grid">
          <BrandingUploadField
            field="loginLogoUrl"
            label="登录页面使用的图标（浅色）"
            hint="格式: JPG/PNG/SVG，推荐大小: 200px * 60px"
            previewWidth={200}
            previewHeight={60}
            disabled={!canManageBrandingSettings}
          />
          <BrandingUploadField
            field="expandedLogoUrl"
            label="登录页左上角使用的图标（深色）以及侧边栏展开后左上角使用的图标（深色）"
            hint="格式: JPG/PNG/SVG，推荐大小: 200px * 60px"
            previewWidth={200}
            previewHeight={60}
            disabled={!canManageBrandingSettings}
          />
          <BrandingUploadField
            field="collapsedLogoUrl"
            label="侧边栏收缩后左上角使用的图标"
            hint="格式: JPG/PNG/SVG，推荐大小: 60px * 60px"
            previewWidth={60}
            previewHeight={60}
            disabled={!canManageBrandingSettings}
          />
          <BrandingUploadField
            field="faviconUrl"
            label="Favicon 图标"
            hint="格式: JPG/PNG/SVG/ICO，推荐大小: 16px*16px、32px*32px、64px*64px"
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
        <div
          className={`soha-branding-upload-area ${disabled ? 'is-disabled' : ''}`}
          style={{
            width: Math.max(previewWidth + 40, 160),
            height: Math.max(previewHeight + 40, 100),
          }}
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
        </div>
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
