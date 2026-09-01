export const authKeys = {
  providers: () => ['auth-providers'] as const,
  loginOptions: () => ['auth-login-options'] as const,
  browserHandoff: (handoffId: string) => ['browser-handoff', handoffId] as const,
  profile: () => ['auth-profile'] as const,
  profileGatewayTokens: () => ['ai-gateway', 'personal-access-tokens'] as const,
}
