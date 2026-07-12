import { Alert, App, Button, Input, Modal, Space, Typography } from 'antd'
import { CopyOutlined } from '@ant-design/icons'

const { Paragraph, Text } = Typography

export interface IdentityOIDCSecretReveal {
  clientId: string
  clientSecret: string
}

interface SecretRevealModalProps {
  onClose: () => void
  value: IdentityOIDCSecretReveal | null
}

export function SecretRevealModal({ onClose, value }: SecretRevealModalProps) {
  const { message } = App.useApp()

  return (
    <Modal
      okText="我已保存"
      onCancel={onClose}
      onOk={onClose}
      open={Boolean(value)}
      title="OIDC Client Secret"
    >
      <Space className="soha-identity-secret-reveal" orientation="vertical" size={12}>
        <Alert
          showIcon
          type="warning"
          title="Client secret 仅展示一次。关闭后需要轮换 secret 才能再次获得新值。"
        />
        <div>
          <Text type="secondary">Client ID</Text>
          <Paragraph copyable className="soha-identity-secret-value">
            {value?.clientId}
          </Paragraph>
        </div>
        <div>
          <Text type="secondary">Client Secret</Text>
          <Space.Compact block>
            <Input.Password readOnly value={value?.clientSecret ?? ''} />
            <Button
              aria-label="复制 client secret"
              icon={<CopyOutlined />}
              onClick={() => {
                const secret = value?.clientSecret
                if (!secret || !navigator.clipboard) return
                navigator.clipboard.writeText(secret).then(
                  () => message.success('已复制 client secret'),
                  () => message.error('复制失败'),
                )
              }}
            />
          </Space.Compact>
        </div>
      </Space>
    </Modal>
  )
}
