import type { RokuDevice } from '../types/roku'
import { DeviceCard } from './DeviceCard'

interface DeviceListProps {
  devices: RokuDevice[]
  selectedDevice: RokuDevice | null
  onSelect: (device: RokuDevice) => void
  scanning: boolean
}

export function DeviceList({ devices, selectedDevice, onSelect, scanning }: DeviceListProps) {
  if (scanning) {
    return (
      <div style={{ color: '#94a3b8', padding: '24px 0', textAlign: 'center' }}>
        Scanning for Roku devices…
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div style={{ color: '#64748b', padding: '24px 0', textAlign: 'center' }}>
        No Roku devices found on this network.
        <br />
        <span style={{ fontSize: 12 }}>Click "Scan Network" to search.</span>
      </div>
    )
  }

  return (
    <div>
      {devices.map((d) => (
        <DeviceCard
          key={d.udn || d.ip}
          device={d}
          isSelected={selectedDevice?.ip === d.ip}
          onSelect={() => onSelect(d)}
        />
      ))}
    </div>
  )
}
