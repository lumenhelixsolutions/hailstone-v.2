import type { RokuDevice } from '../types/roku'

interface DeviceCardProps {
  device: RokuDevice
  isSelected: boolean
  onSelect: () => void
}

export function DeviceCard({ device, isSelected, onSelect }: DeviceCardProps) {
  const age = Math.round((Date.now() - device.lastSeen) / 1000)

  return (
    <button
      onClick={onSelect}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '12px 14px',
        marginBottom: 8,
        borderRadius: 8,
        border: isSelected ? '2px solid #6366f1' : '2px solid #1e293b',
        background: isSelected ? '#1e1b4b' : '#1e293b',
        color: '#e2e8f0',
        cursor: 'pointer',
        transition: 'border-color 0.15s',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{device.name}</div>
      <div style={{ fontSize: 12, color: '#94a3b8' }}>{device.ip}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
        {device.model} · seen {age}s ago
      </div>
    </button>
  )
}
