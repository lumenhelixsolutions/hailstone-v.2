import type { NetworkDiagnostics } from '../lib/roku'

interface DiagnosticsPanelProps {
  diagnostics: NetworkDiagnostics | null
  loading: boolean
}

export function DiagnosticsPanel({ diagnostics, loading }: DiagnosticsPanelProps) {
  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: 10,
        padding: '16px 20px',
        marginBottom: 24,
      }}
    >
      <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#94a3b8' }}>
        Network Diagnostics
      </h3>

      {loading || !diagnostics ? (
        <div style={{ fontSize: 13, color: '#64748b' }}>Running diagnostics…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DiagRow
            label="Environment"
            value={diagnostics.isBrowserContext ? 'Web browser' : 'Native / Tauri'}
            status={diagnostics.isBrowserContext ? 'warn' : 'ok'}
          />
          <DiagRow
            label="Scan subnet"
            value={`${diagnostics.subnet}.0/24`}
            status="info"
          />
          <DiagRow
            label="CORS"
            value={
              diagnostics.corsLikelyBlocked
                ? 'Blocked — browser prevents cross-origin ECP fetches'
                : 'Not blocked'
            }
            status={diagnostics.corsLikelyBlocked ? 'error' : 'ok'}
          />
          <DiagRow
            label="Gateway probe"
            value={gatewayLabel(diagnostics.gatewayProbeStatus)}
            status={gatewayStatus(diagnostics.gatewayProbeStatus)}
          />
          <div
            style={{
              marginTop: 4,
              padding: '8px 12px',
              borderRadius: 6,
              background: diagnostics.corsLikelyBlocked ? '#1c1917' : '#0f2a1a',
              borderLeft: `3px solid ${diagnostics.corsLikelyBlocked ? '#f59e0b' : '#22c55e'}`,
              fontSize: 12,
              color: '#cbd5e1',
              lineHeight: 1.5,
            }}
          >
            {diagnostics.summary}
          </div>
        </div>
      )}
    </div>
  )
}

type StatusKind = 'ok' | 'warn' | 'error' | 'info'

function DiagRow({ label, value, status }: { label: string; value: string; status: StatusKind }) {
  const colors: Record<StatusKind, string> = {
    ok: '#22c55e',
    warn: '#f59e0b',
    error: '#ef4444',
    info: '#94a3b8',
  }

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 120, flexShrink: 0, fontSize: 12, color: '#64748b', paddingTop: 1 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            display: 'inline-block',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: colors[status],
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 13, color: '#e2e8f0' }}>{value}</span>
      </div>
    </div>
  )
}

function gatewayLabel(status: NetworkDiagnostics['gatewayProbeStatus']): string {
  switch (status) {
    case 'reachable':
      return 'Roku ECP responded — device found'
    case 'cors-error':
      return 'CORS blocked (browser security)'
    case 'unreachable':
      return 'No response on port 8060'
    case 'pending':
      return 'Checking…'
  }
}

function gatewayStatus(status: NetworkDiagnostics['gatewayProbeStatus']): StatusKind {
  switch (status) {
    case 'reachable':
      return 'ok'
    case 'cors-error':
      return 'error'
    case 'unreachable':
      return 'warn'
    case 'pending':
      return 'info'
  }
}
