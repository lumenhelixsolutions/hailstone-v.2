import { useState } from 'react'
import { useRokuPortal } from './hooks/useRokuPortal'
import { DeviceList } from './components/DeviceList'
import { StatusBanner } from './components/StatusBanner'
import { DiagnosticsPanel } from './components/DiagnosticsPanel'

type Page = 'dashboard' | 'devices' | 'apps'

const NAV_ITEMS: { id: Page; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'devices', label: 'Devices' },
  { id: 'apps', label: 'Apps' },
]

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const {
    devices,
    selectedDevice,
    scanStatus,
    scanProgress,
    activityLog,
    deviceCount,
    refreshing,
    diagnostics,
    diagnosticsLoading,
    selectDevice,
    startScan,
    refreshSelected,
  } = useRokuPortal()

  const scanning = scanStatus === 'scanning'

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      {/* Top nav */}
      <header
        style={{
          background: '#0f172a',
          borderBottom: '1px solid #1e293b',
          padding: '0 24px',
          height: 56,
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 18, color: '#818cf8' }}>NUMO Roku Portal</span>
        <nav style={{ display: 'flex', gap: 4 }}>
          {NAV_ITEMS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              style={{
                background: page === id ? '#1e293b' : 'transparent',
                color: page === id ? '#e2e8f0' : '#64748b',
                border: 'none',
                borderRadius: 6,
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={() => void startScan()}
            disabled={scanning}
            style={actionBtnStyle(!scanning)}
          >
            {scanning
              ? `Scanning… (${scanProgress.scanned}/${scanProgress.total})`
              : 'Scan Network'}
          </button>
          <button
            onClick={() => void refreshSelected()}
            disabled={scanning || refreshing || !selectedDevice}
            style={actionBtnStyle(!scanning && !refreshing && !!selectedDevice)}
          >
            {refreshing ? 'Refreshing…' : 'Refresh Device'}
          </button>
        </div>
      </header>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 240,
            background: '#0f172a',
            borderRight: '1px solid #1e293b',
            padding: '16px 12px',
            overflowY: 'auto',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 12,
            }}
          >
            Devices ({deviceCount})
          </div>
          <DeviceList
            devices={devices}
            selectedDevice={selectedDevice}
            onSelect={selectDevice}
            scanning={scanning}
          />
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          {page === 'dashboard' && (
            <DashboardPage
              deviceCount={deviceCount}
              selectedDevice={selectedDevice}
              onRefresh={refreshSelected}
              refreshing={refreshing}
              activityLog={activityLog}
              scanning={scanning}
              scanProgress={scanProgress}
              diagnostics={diagnostics}
              diagnosticsLoading={diagnosticsLoading}
            />
          )}
          {page === 'devices' && (
            <DevicesPage
              devices={devices}
              selectedDevice={selectedDevice}
              onSelect={selectDevice}
              scanning={scanning}
              onScan={() => void startScan()}
            />
          )}
          {page === 'apps' && <AppsPage selectedDevice={selectedDevice} />}
        </main>
      </div>
    </div>
  )
}

// ── Page components ──────────────────────────────────────────────────────────

interface DashboardPageProps {
  deviceCount: number
  selectedDevice: ReturnType<typeof useRokuPortal>['selectedDevice']
  onRefresh: () => void
  refreshing: boolean
  activityLog: string[]
  scanning: boolean
  scanProgress: ReturnType<typeof useRokuPortal>['scanProgress']
  diagnostics: ReturnType<typeof useRokuPortal>['diagnostics']
  diagnosticsLoading: ReturnType<typeof useRokuPortal>['diagnosticsLoading']
}

function DashboardPage({
  deviceCount,
  selectedDevice,
  onRefresh,
  refreshing,
  activityLog,
  scanning,
  scanProgress,
  diagnostics,
  diagnosticsLoading,
}: DashboardPageProps) {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard
          label="Verified Roku Devices"
          value={scanning ? `${scanProgress.scanned} / ${scanProgress.total}` : String(deviceCount)}
          note={scanning ? 'Scanning…' : deviceCount === 0 ? 'Run a scan to detect devices' : 'Unique Roku devices only'}
        />
        <StatCard
          label="Active Device"
          value={selectedDevice ? selectedDevice.name : '—'}
          note={selectedDevice ? selectedDevice.ip : 'No device selected'}
        />
        <StatCard
          label="Discovery Method"
          value="ECP / HTTP"
          note="Port 8060, XML validation"
        />
      </div>

      <DiagnosticsPanel diagnostics={diagnostics} loading={diagnosticsLoading} />

      <StatusBanner device={selectedDevice} onRefresh={onRefresh} refreshing={refreshing} />

      <div style={{ background: '#1e293b', borderRadius: 10, padding: '16px 20px' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#94a3b8' }}>
          Activity Log
        </h3>
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 12,
            color: '#64748b',
            maxHeight: 260,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          {activityLog.map((line, i) => (
            <div key={i} style={{ color: line.includes('Found') ? '#86efac' : '#64748b' }}>
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: 10,
        padding: '16px 20px',
      }}
    >
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#475569' }}>{note}</div>
    </div>
  )
}

interface DevicesPageProps {
  devices: ReturnType<typeof useRokuPortal>['devices']
  selectedDevice: ReturnType<typeof useRokuPortal>['selectedDevice']
  onSelect: ReturnType<typeof useRokuPortal>['selectDevice']
  scanning: boolean
  onScan: () => void
}

function DevicesPage({ devices, selectedDevice, onSelect, scanning, onScan }: DevicesPageProps) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Devices</h1>
        <button onClick={onScan} disabled={scanning} style={actionBtnStyle(!scanning)}>
          {scanning ? 'Scanning…' : 'Scan Network'}
        </button>
      </div>

      <DeviceList
        devices={devices}
        selectedDevice={selectedDevice}
        onSelect={onSelect}
        scanning={scanning}
      />

      {selectedDevice && (
        <div style={{ background: '#1e293b', borderRadius: 10, padding: '16px 20px', marginTop: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Selected Device Details</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {[
                ['Name', selectedDevice.name],
                ['Model', selectedDevice.model],
                ['IP', selectedDevice.ip],
                ['ECP URL', selectedDevice.ecpUrl],
                ['Serial', selectedDevice.serialNumber],
                ['Software', selectedDevice.softwareVersion],
                ['UDN', selectedDevice.udn],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td style={{ color: '#64748b', padding: '4px 0', width: 120 }}>{k}</td>
                  <td style={{ color: '#e2e8f0' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AppsPage({ selectedDevice }: { selectedDevice: ReturnType<typeof useRokuPortal>['selectedDevice'] }) {
  if (!selectedDevice) {
    return (
      <div style={{ textAlign: 'center', marginTop: 80, color: '#64748b' }}>
        <div style={{ fontSize: 20, marginBottom: 8 }}>No device selected</div>
        <div style={{ fontSize: 14 }}>
          Connect to a Roku device to load its installed channels.
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 24 }}>
        Apps — {selectedDevice.name}
      </h1>
      <div style={{ color: '#64748b', fontSize: 14 }}>
        ECP channel listing (<code>/query/apps</code>) is not yet implemented.
        <br />
        Selected device: {selectedDevice.ip}
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function actionBtnStyle(enabled: boolean): React.CSSProperties {
  return {
    background: enabled ? '#4f46e5' : '#1e293b',
    color: enabled ? '#fff' : '#475569',
    border: 'none',
    borderRadius: 6,
    padding: '7px 16px',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 13,
    fontWeight: 500,
  }
}
