import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Alert, App, Button, Drawer, Form, Modal, Popconfirm, Space, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  NetworkVPNProfileConfig,
  NetworkVPNSelectionPolicyConfig,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { ManagementDataPage } from '@/components/management-data-page'
import { AdminTable } from '@/components/admin-table'
import { StatusTag } from '@/components/status-tag'
import { hasPermission, usePermissionSnapshot } from '@/features/auth'
import { useI18n } from '@/i18n'
import { TablePane } from './table-pane'
import {
  deleteVPNDocument,
  publishVPNDocument,
  saveVPNDocument,
  vpnDocuments,
  vpnKeys,
  vpnRevisions,
  type VPNDocument,
  type VPNRevision,
} from './vpn-api'
import {
  VPNNameField,
  VPNPolicyFields,
  VPNProfileFields,
  vpnPolicyDefaults,
  vpnProfileDefaults,
} from './vpn-fields'

export default function VPNDocumentsPage() {
  const { pathname } = useLocation()
  const kind = pathname.endsWith('selection-policies') ? 'selection-policies' : 'profiles'
  const key = kind === 'profiles' ? 'vpn_profiles' : 'vpn_selection_policies'
  const { localeCode } = useI18n()
  const text = (zh: string, en: string) => (localeCode === 'zh_CN' ? zh : en)
  const permissions = usePermissionSnapshot()
  const can = (permission: string) => hasPermission(permissions.data?.data, permission)
  const allowed = (action: string) => can(`network_access.${key}.${action}`)
  const client = useQueryClient()
  const { message } = App.useApp()
  const [editing, setEditing] = useState<VPNDocument | null | undefined>()
  const [history, setHistory] = useState<VPNDocument | null>(null)
  const [form] = Form.useForm<NetworkVPNProfileConfig & NetworkVPNSelectionPolicyConfig>()
  const query = useQuery({
    queryKey: vpnKeys.documents(kind),
    queryFn: () => vpnDocuments(kind),
    enabled: allowed('view'),
  })
  const revisions = useQuery({
    queryKey: vpnKeys.revisions(kind, history?.id),
    queryFn: () => vpnRevisions(kind, history!.id),
    enabled: !!history,
  })
  const mutation = useMutation({
    mutationFn: (work: () => Promise<unknown>) => work(),
    onSuccess: () => {
      setEditing(undefined)
      setHistory(null)
      void client.invalidateQueries({ queryKey: vpnKeys.all })
      message.success(text('已保存', 'Saved'))
    },
    onError: (err: Error) => message.error(err.message),
  })
  const edit = (item: VPNDocument | null) => {
    form.resetFields()
    form.setFieldsValue(
      item?.configuration || (kind === 'profiles' ? vpnProfileDefaults : vpnPolicyDefaults),
    )
    setEditing(item)
  }
  const title =
    kind === 'profiles'
      ? text('VPN 连接方案', 'VPN connection profiles')
      : text('VPN Auto 策略', 'VPN Auto policies')
  return (
    <ManagementDataPage
      header={{
        title,
        description: text(
          '发布后的修订控制新连接；安全范围变更会撤销受影响会话。',
          'Published revisions govern new connections. Security scope changes revoke affected sessions.',
        ),
      }}
      tableNode={
        <TablePane<VPNDocument>
          items={query.data}
          loading={query.isPending && allowed('view')}
          error={query.isError}
          refreshing={query.isFetching}
          onRefresh={() => void query.refetch()}
          searchPlaceholder={text('搜索方案或策略', 'Search profiles or policies')}
          getSearchValues={(d) => [d.configuration.name, d.id]}
          createAction={
            allowed('create') ? (
              <Button type="primary" onClick={() => edit(null)}>
                {text('新建', 'Create')}
              </Button>
            ) : undefined
          }
          columns={[
            {
              title: text('名称', 'Name'),
              key: 'name',
              render: (_, d) => <Typography.Text strong>{d.configuration.name}</Typography.Text>,
            },
            {
              title: text('修订', 'Revision'),
              key: 'revision',
              render: (_, d) => `r${d.revision}`,
            },
            {
              title: text('发布状态', 'Publication'),
              key: 'published',
              render: (_, d) => (
                <StatusTag
                  value={d.publishedRevision === d.revision ? 'published' : 'draft'}
                  label={
                    d.publishedRevision
                      ? `${text('已发布', 'Published')} r${d.publishedRevision}${d.revision > d.publishedRevision ? ` · ${text('有草稿', 'Draft changes')}` : ''}`
                      : text('未发布', 'Unpublished')
                  }
                />
              ),
            },
            {
              title: text('操作', 'Actions'),
              key: 'actions',
              render: (_, d) => (
                <Space>
                  {allowed('update') ? (
                    <Button size="small" onClick={() => edit(d)}>
                      {text('编辑', 'Edit')}
                    </Button>
                  ) : null}
                  <Button size="small" onClick={() => setHistory(d)}>
                    {text('修订与回滚', 'Revisions')}
                  </Button>
                  {allowed('publish') ? (
                    <Popconfirm
                      title={text(
                        '发布此修订？安全范围变更将撤销相关会话。',
                        'Publish this revision? Security changes revoke affected sessions.',
                      )}
                      onConfirm={() => mutation.mutate(() => publishVPNDocument(kind, d))}
                    >
                      <Button
                        size="small"
                        disabled={mutation.isPending || d.publishedRevision === d.revision}
                      >
                        {text('发布', 'Publish')}
                      </Button>
                    </Popconfirm>
                  ) : null}
                  {allowed('delete') ? (
                    <Popconfirm
                      title={text('删除此配置？', 'Delete this configuration?')}
                      onConfirm={() => mutation.mutate(() => deleteVPNDocument(kind, d))}
                    >
                      <Button size="small" danger disabled={mutation.isPending}>
                        {text('删除', 'Delete')}
                      </Button>
                    </Popconfirm>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      }
    >
      {!allowed('view') && !permissions.isPending ? (
        <Alert
          type="warning"
          showIcon
          description={text('没有查看此配置的权限', 'You cannot view these configurations')}
        />
      ) : null}
      <Modal
        title={title}
        open={editing !== undefined}
        onCancel={() => setEditing(undefined)}
        confirmLoading={mutation.isPending}
        width={680}
        destroyOnHidden
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          onFinish={(values) =>
            mutation.mutate(() =>
              saveVPNDocument(kind, editing?.id, editing?.revision || 0, values),
            )
          }
        >
          <VPNNameField />
          {kind === 'profiles' ? <VPNProfileFields can={can} /> : <VPNPolicyFields />}
        </Form>
      </Modal>
      <Drawer
        open={!!history}
        onClose={() => setHistory(null)}
        title={text('修订记录', 'Revision history')}
        size={760}
      >
        {revisions.isError ? <Alert type="error" description={revisions.error.message} /> : null}
        <AdminTable
          rowKey="revision"
          loading={revisions.isPending}
          dataSource={revisions.data || []}
          columns={[
            { title: text('修订', 'Revision'), dataIndex: 'revision' },
            { title: text('操作者', 'Actor'), dataIndex: 'createdBy' },
            { title: text('时间', 'Time'), dataIndex: 'createdAt' },
            {
              title: text('操作', 'Action'),
              key: 'rollback',
              render: (_: unknown, r: VPNRevision) => (
                <Button
                  disabled={
                    !allowed('publish') ||
                    mutation.isPending ||
                    r.revision === history?.publishedRevision
                  }
                  onClick={() =>
                    history && mutation.mutate(() => publishVPNDocument(kind, history, r.revision))
                  }
                >
                  {text('回滚为新修订', 'Restore as new revision')}
                </Button>
              ),
            },
          ]}
          expandable={{
            expandedRowRender: (r: VPNRevision) => (
              <pre>{JSON.stringify(r.configuration, null, 2)}</pre>
            ),
          }}
        />
      </Drawer>
    </ManagementDataPage>
  )
}
