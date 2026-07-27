import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  KeyOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Avatar, Button, Card, Descriptions, Space, Spin, Statistic, Typography } from 'antd'
import { Alert, App, Input, List, Modal, Popconfirm } from 'antd'
import { useNavigate } from 'react-router-dom'
import { identityRuntimeQueries } from '@/features/identity'
import type {
  MFAEnrollmentChallenge,
  MFARecoveryChallenge,
} from '@opensoha/contracts/gen/ts/sohaapi'
import { providerPortalMutations } from '../mutations'
import { providerPortalQueries } from '../queries'
import { PortalTagsOrEmpty } from '../shared/application-ui'
import { formatPortalDateTime } from '../shared/formatters'
import { PortalAccountMenu } from '../shared/account-menu'
import '../provider-portal-pages.css'

const { Text, Title } = Typography

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const bytes = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  return Uint8Array.from(bytes, (character) => character.charCodeAt(0))
}

function encodeBase64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value)
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function PortalSecurityPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const securityQuery = useQuery(providerPortalQueries.security())
  const runtimeQuery = useQuery(identityRuntimeQueries.capabilities())
  const runtime = runtimeQuery.data
  const mfaAvailable = Boolean(
    runtime?.totp.available || runtime?.webauthn.available || runtime?.recoveryCodes.available,
  )
  const credentialsQuery = useQuery(providerPortalQueries.mfaCredentials(mfaAvailable))
  const [totpChallenge, setTOTPChallenge] = useState<MFAEnrollmentChallenge | null>(null)
  const [totpCode, setTOTPCode] = useState('')
  const [recoveryChallenge, setRecoveryChallenge] = useState<MFARecoveryChallenge | null>(null)
  const [recoveryCode, setRecoveryCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const revokeMutation = useMutation(providerPortalMutations.revokeMFACredential(queryClient))
  const beginTOTPMutation = useMutation(providerPortalMutations.beginTOTPEnrollment())
  const verifyMutation = useMutation(providerPortalMutations.verifyMFAChallenge(queryClient))
  const beginRecoveryMutation = useMutation(providerPortalMutations.beginRecoveryChallenge())
  const beginWebAuthnMutation = useMutation(providerPortalMutations.beginWebAuthnEnrollment())
  const authenticateWebAuthnMutation = useMutation(
    providerPortalMutations.beginWebAuthnAuthentication(),
  )
  const verifyWebAuthnMutation = useMutation(
    providerPortalMutations.verifyWebAuthnChallenge(queryClient),
  )
  const recoveryMutation = useMutation(providerPortalMutations.regenerateRecoveryCodes())

  const enrollWebAuthn = async () => {
    if (!window.PublicKeyCredential || !navigator.credentials) return
    try {
      const options = await beginWebAuthnMutation.mutateAsync()
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: decodeBase64Url(options.challenge),
          rp: { id: options.rpId, name: options.rpName },
          user: {
            id: decodeBase64Url(options.userId),
            name: options.userName,
            displayName: options.userName,
          },
          pubKeyCredParams: options.algorithms.map((alg) => ({ alg, type: 'public-key' })),
          timeout: options.timeoutMilliseconds,
          excludeCredentials: options.excludeCredentialIds?.map((id) => ({
            id: decodeBase64Url(id),
            type: 'public-key',
          })),
        },
      })) as PublicKeyCredential | null
      if (!credential) return
      const response = credential.response as AuthenticatorAttestationResponse
      await verifyWebAuthnMutation.mutateAsync({
        challengeId: options.challengeId,
        response: {
          credentialId: credential.id,
          clientDataJSON: encodeBase64Url(response.clientDataJSON),
          attestationObject: encodeBase64Url(response.attestationObject),
        },
      })
      message.success('Passkey registered')
      void credentialsQuery.refetch()
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Passkey registration failed')
    }
  }

  const authenticateWebAuthn = async () => {
    if (!window.PublicKeyCredential || !navigator.credentials) return
    try {
      const options = await authenticateWebAuthnMutation.mutateAsync({ purpose: 'step_up' })
      const credential = (await navigator.credentials.get({
        publicKey: {
          challenge: decodeBase64Url(options.challenge),
          rpId: options.rpId,
          timeout: options.timeoutMilliseconds,
          userVerification: options.userVerification,
          allowCredentials: options.allowCredentialIds?.map((id) => ({
            id: decodeBase64Url(id),
            type: 'public-key',
          })),
        },
      })) as PublicKeyCredential | null
      if (!credential) return
      const response = credential.response as AuthenticatorAssertionResponse
      await verifyWebAuthnMutation.mutateAsync({
        challengeId: options.challengeId,
        response: {
          credentialId: credential.id,
          clientDataJSON: encodeBase64Url(response.clientDataJSON),
          authenticatorData: encodeBase64Url(response.authenticatorData),
          signature: encodeBase64Url(response.signature),
          userHandle: response.userHandle ? encodeBase64Url(response.userHandle) : undefined,
        },
      })
      message.success('Passkey verification successful')
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Passkey verification failed')
    }
  }

  const security = securityQuery.data
  const principal = security?.principal

  if (securityQuery.isLoading) {
    return (
      <div className="soha-provider-portal is-loading">
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div className="soha-provider-portal">
      <header className="soha-portal-header">
        <div className="soha-portal-brand">
          <div className="soha-portal-mark">
            <SafetyCertificateOutlined />
          </div>
          <div>
            <Title level={3}>Security</Title>
            <Text type="secondary">Identity, sessions, and linked sources</Text>
          </div>
        </div>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/portal')}>
            Portal
          </Button>
          <PortalAccountMenu />
        </Space>
      </header>

      <main className="soha-portal-main">
        <section className="soha-portal-security-overview">
          <Card size="small">
            <Statistic
              title="MFA"
              value={security?.mfaEnabled ? 'Enabled' : 'Not enabled'}
              prefix={<LockOutlined />}
            />
          </Card>
          <Card size="small">
            <Statistic
              title="Active sessions"
              value={security?.activeSession ?? 0}
              prefix={<SafetyCertificateOutlined />}
            />
          </Card>
          <Card size="small">
            <Statistic
              title="Linked sources"
              value={security?.linkedSources.length ?? 0}
              prefix={<KeyOutlined />}
            />
          </Card>
          <Card size="small">
            <Statistic
              title="Recent login"
              value={formatPortalDateTime(security?.recentLoginAt)}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </section>

        <section className="soha-portal-detail-layout">
          <div className="soha-portal-detail-main">
            <section className="soha-portal-side-panel">
              <div className="soha-portal-principal is-large">
                <Avatar icon={<UserOutlined />} size={48} />
                <div className="soha-portal-principal-copy">
                  <Title level={4}>{principal?.userName || 'User'}</Title>
                  <Text type="secondary" ellipsis title={principal?.email}>
                    {principal?.email || principal?.userId || '-'}
                  </Text>
                </div>
              </div>
              <Descriptions
                bordered
                column={{ xs: 1, sm: 1, md: 2 }}
                size="small"
                items={[
                  { key: 'userId', label: 'User ID', children: principal?.userId || '-' },
                  { key: 'email', label: 'Email', children: principal?.email || '-' },
                  {
                    key: 'mfa',
                    label: 'MFA',
                    children: security?.mfaEnabled ? 'Enabled' : 'Not enabled',
                  },
                  {
                    key: 'recentLoginAt',
                    label: 'Recent login',
                    children: formatPortalDateTime(security?.recentLoginAt),
                  },
                ]}
              />
            </section>

            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <KeyOutlined />
                <span>Linked sources</span>
              </div>
              <div className="soha-portal-app-tags">
                <PortalTagsOrEmpty values={security?.linkedSources} />
              </div>
            </section>

            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <LockOutlined />
                <span>Multi-factor authentication</span>
              </div>
              {!mfaAvailable ? (
                <Alert
                  showIcon
                  title="MFA runtime unavailable"
                  description="This server has no usable MFA challenge runtime."
                  type="warning"
                />
              ) : (
                <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                  <Space wrap>
                    <Button
                      disabled={!runtime?.totp.available}
                      loading={beginTOTPMutation.isPending}
                      onClick={() =>
                        beginTOTPMutation.mutate(undefined, {
                          onSuccess: setTOTPChallenge,
                          onError: (error) => message.error(error.message),
                        })
                      }
                    >
                      Add authenticator
                    </Button>
                    <Button
                      disabled={
                        !runtime?.webauthn.available ||
                        !window.PublicKeyCredential ||
                        !navigator.credentials
                      }
                      loading={beginWebAuthnMutation.isPending || verifyWebAuthnMutation.isPending}
                      onClick={() => void enrollWebAuthn()}
                    >
                      Add passkey
                    </Button>
                    <Button
                      disabled={
                        !runtime?.webauthn.available ||
                        !runtime?.stepUp.available ||
                        !window.PublicKeyCredential ||
                        !navigator.credentials
                      }
                      loading={
                        authenticateWebAuthnMutation.isPending || verifyWebAuthnMutation.isPending
                      }
                      onClick={() => void authenticateWebAuthn()}
                    >
                      Verify passkey
                    </Button>
                    <Popconfirm
                      title="Generate new recovery codes?"
                      description="Previously generated recovery codes will stop working."
                      onConfirm={() =>
                        recoveryMutation.mutate(undefined, {
                          onSuccess: (result) => setRecoveryCodes(result.codes),
                          onError: (error) => message.error(error.message),
                        })
                      }
                    >
                      <Button
                        disabled={!runtime?.recoveryCodes.available}
                        loading={recoveryMutation.isPending}
                      >
                        Recovery codes
                      </Button>
                    </Popconfirm>
                    <Button
                      disabled={!runtime?.recoveryCodes.available}
                      icon={<KeyOutlined />}
                      loading={beginRecoveryMutation.isPending}
                      onClick={() =>
                        beginRecoveryMutation.mutate(undefined, {
                          onSuccess: setRecoveryChallenge,
                          onError: (error) => message.error(error.message),
                        })
                      }
                    >
                      Use recovery code
                    </Button>
                  </Space>
                  <List
                    dataSource={credentialsQuery.data ?? []}
                    loading={credentialsQuery.isLoading}
                    locale={{ emptyText: 'No MFA credentials' }}
                    renderItem={(credential) => (
                      <List.Item
                        actions={[
                          <Popconfirm
                            key="revoke"
                            title="Revoke this credential?"
                            onConfirm={() => revokeMutation.mutate(credential.id)}
                          >
                            <Button danger size="small">
                              Revoke
                            </Button>
                          </Popconfirm>,
                        ]}
                      >
                        <List.Item.Meta
                          title={credential.displayName}
                          description={`${credential.type} · ${formatPortalDateTime(credential.lastUsedAt || credential.createdAt)}`}
                        />
                      </List.Item>
                    )}
                  />
                </Space>
              )}
            </section>
          </div>

          <aside className="soha-portal-side">
            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <TeamOutlined />
                <span>Roles</span>
              </div>
              <div className="soha-portal-app-tags">
                <PortalTagsOrEmpty values={principal?.roles} />
              </div>
            </section>
            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <TeamOutlined />
                <span>Teams</span>
              </div>
              <div className="soha-portal-app-tags">
                <PortalTagsOrEmpty values={principal?.teams} />
              </div>
            </section>
            <section className="soha-portal-side-panel">
              <div className="soha-portal-side-title">
                <InfoCircleOutlined />
                <span>Tags</span>
              </div>
              <div className="soha-portal-app-tags">
                <PortalTagsOrEmpty values={principal?.tags} />
              </div>
            </section>
          </aside>
        </section>
      </main>

      <Modal
        destroyOnHidden
        okButtonProps={{
          disabled: totpCode.trim().length < 6,
          loading: verifyMutation.isPending,
        }}
        onCancel={() => {
          setTOTPChallenge(null)
          setTOTPCode('')
        }}
        onOk={() =>
          totpChallenge &&
          verifyMutation.mutate(
            { challengeId: totpChallenge.challengeId, response: totpCode.trim() },
            {
              onSuccess: () => {
                setTOTPChallenge(null)
                setTOTPCode('')
                message.success('Authenticator registered')
                void credentialsQuery.refetch()
              },
              onError: (error) => message.error(error.message),
            },
          )
        }
        open={Boolean(totpChallenge)}
        title="Register authenticator"
      >
        <Alert
          showIcon
          title="Scan this provisioning URI in your authenticator app"
          description={<Text copyable>{totpChallenge?.provisioningUri}</Text>}
          type="info"
        />
        <Input.OTP length={6} onChange={setTOTPCode} value={totpCode} style={{ marginTop: 16 }} />
      </Modal>

      <Modal
        destroyOnHidden
        okButtonProps={{
          disabled: recoveryCode.trim().length < 16,
          loading: verifyMutation.isPending,
        }}
        onCancel={() => {
          setRecoveryChallenge(null)
          setRecoveryCode('')
        }}
        onOk={() =>
          recoveryChallenge &&
          verifyMutation.mutate(
            { challengeId: recoveryChallenge.challengeId, response: recoveryCode.trim() },
            {
              onSuccess: () => {
                setRecoveryChallenge(null)
                setRecoveryCode('')
                message.success('Recovery code verified')
              },
              onError: (error) => message.error(error.message),
            },
          )
        }
        open={Boolean(recoveryChallenge)}
        title="Use recovery code"
      >
        <Input
          autoComplete="one-time-code"
          maxLength={17}
          onChange={(event) => setRecoveryCode(event.target.value)}
          placeholder="XXXXXXXX-XXXXXXXX"
          value={recoveryCode}
        />
      </Modal>

      <Modal
        cancelButtonProps={{ style: { display: 'none' } }}
        destroyOnHidden
        onOk={() => setRecoveryCodes([])}
        open={recoveryCodes.length > 0}
        title="Recovery codes"
      >
        <Alert
          showIcon
          title="Shown once"
          description="Store these codes securely. Each code can be used only once."
          type="warning"
        />
        <List
          dataSource={recoveryCodes}
          renderItem={(code) => (
            <List.Item>
              <Text code copyable>
                {code}
              </Text>
            </List.Item>
          )}
        />
      </Modal>
    </div>
  )
}
