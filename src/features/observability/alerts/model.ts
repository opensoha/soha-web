export function alertDisplayStatus(alert?: { status?: string; currentState?: string }) {
  return alert?.currentState || alert?.status || ''
}

export function stringifyAlertPayload(payload: unknown) {
  return JSON.stringify(payload ?? {}, null, 2)
}
