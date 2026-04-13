import type { RokuDevice } from '../types/roku'

interface StatusBannerProps {
  device: RokuDevice | null
  onRefresh: () => void
  refreshing: boolean
}

export function StatusBanner({ device, onRefresh, refreshing }: StatusBannerProps) {
  return (
    <div
      style={{
        background: '#1e293b',
        borderRadius: 10,
        padding: '20px 24px',
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Active Device</h2>
        <button
          onClick={onRefresh}
          disabled={refreshing || !device}
          style={{
            background: '#4f46e5',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            padding: '6px 14px',
            cursor: device && !refreshing ? 'pointer' : 'not-allowed',
            opacity: device && !refreshing ? 1 : 0.5,
            fontSize: 13,
          }}
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {device ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
          <Field label="Name" value={device.name} />
          <Field label="IP Address" value={device.ip} />
          <Field label="Model" value={device.model} />
          <Field label="Serial" value={device.serialNumber} />
          <Field label="Software" value={device.softwareVersion} />
          <Field label="ECP URL" value={device.ecpUrl} />
        </div>
      ) : (
        <p style={{ color: '#64748b', fontSize: 14 }}>
          No device selected. Scan for devices and click one to select it.
        </p>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, color: '#e2e8f0' }}>{value}</div>
    </div>
  )
}
