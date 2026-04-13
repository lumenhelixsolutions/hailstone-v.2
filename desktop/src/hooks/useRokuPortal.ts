import { useCallback, useEffect, useRef, useState } from 'react'
import type { RokuDevice, ScanProgress, ScanStatus } from '../types/roku'
import type { NetworkDiagnostics } from '../lib/roku'
import { detectSubnet, refreshDevice, runDiagnostics, scanSubnet } from '../lib/roku'

export interface RokuPortalState {
  devices: RokuDevice[]
  selectedDevice: RokuDevice | null
  scanStatus: ScanStatus
  scanProgress: ScanProgress
  activityLog: string[]
  deviceCount: number
  refreshing: boolean
  diagnostics: NetworkDiagnostics | null
  diagnosticsLoading: boolean
  selectDevice: (device: RokuDevice) => void
  startScan: () => Promise<void>
  refreshSelected: () => Promise<void>
}

const MAX_LOG = 200

function timestamp(): string {
  return new Date().toLocaleTimeString()
}

export function useRokuPortal(): RokuPortalState {
  const [devices, setDevices] = useState<RokuDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<RokuDevice | null>(null)
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
  const [scanProgress, setScanProgress] = useState<ScanProgress>({ scanned: 0, total: 254 })
  const [refreshing, setRefreshing] = useState(false)
  const [activityLog, setActivityLog] = useState<string[]>([
    `${timestamp()} — Portal started. Click "Scan Network" to discover Roku devices.`,
  ])
  const [diagnostics, setDiagnostics] = useState<NetworkDiagnostics | null>(null)
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(true)

  /** Tracks UDNs already present in state to prevent duplicates. */
  const knownUdns = useRef<Set<string>>(new Set())
  /** Tracks IPs already present in state to prevent duplicates. */
  const knownIps = useRef<Set<string>>(new Set())

  const addLog = useCallback((msg: string) => {
    setActivityLog((prev) => [`${timestamp()} — ${msg}`, ...prev].slice(0, MAX_LOG))
  }, [])

  // Run diagnostics once on mount to detect CORS / environment issues.
  useEffect(() => {
    setDiagnosticsLoading(true)
    runDiagnostics()
      .then(setDiagnostics)
      .finally(() => setDiagnosticsLoading(false))
  }, [])

  const selectDevice = useCallback((device: RokuDevice) => {
    setSelectedDevice(device)
    addLog(`Selected device: ${device.name} (${device.ip})`)
  }, [addLog])

  const startScan = useCallback(async () => {
    if (scanStatus === 'scanning') return

    setScanStatus('scanning')
    setScanProgress({ scanned: 0, total: 254 })

    // ── FIX: Reset device list and deduplication state at the start of
    //         each scan so that repeated scans do not accumulate stale
    //         or duplicate entries. ────────────────────────────────────
    setDevices([])
    setSelectedDevice(null)
    knownUdns.current.clear()
    knownIps.current.clear()
    // ─────────────────────────────────────────────────────────────────

    const subnet = detectSubnet()
    addLog(`Scanning subnet ${subnet}.0/24 for Roku devices…`)

    try {
      await scanSubnet(
        subnet,
        (device) => {
          // ── FIX: Deduplicate by UDN (preferred) and IP before inserting.
          //         This guards against edge cases where the same device is
          //         discovered through multiple probes within a single scan. ──
          if (knownUdns.current.has(device.udn) || knownIps.current.has(device.ip)) {
            return
          }
          knownUdns.current.add(device.udn)
          knownIps.current.add(device.ip)
          // ───────────────────────────────────────────────────────────────────

          setDevices((prev) => [...prev, device])
          addLog(`Found Roku device: ${device.name} at ${device.ip} (${device.model})`)
        },
        (scanned, total) => {
          setScanProgress({ scanned, total })
        },
      )

      setScanStatus('done')
      setDevices((prev) => {
        addLog(
          prev.length > 0
            ? `Scan complete — ${prev.length} Roku device${prev.length !== 1 ? 's' : ''} found.`
            : 'Scan complete — no Roku devices found on this subnet.',
        )
        return prev
      })
    } catch (err) {
      setScanStatus('error')
      addLog(`Scan error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [scanStatus, addLog])

  const refreshSelected = useCallback(async () => {
    if (!selectedDevice) {
      addLog('No device selected — nothing to refresh.')
      return
    }

    setRefreshing(true)
    addLog(`Refreshing ${selectedDevice.name} (${selectedDevice.ip})…`)
    const updated = await refreshDevice(selectedDevice)
    setRefreshing(false)

    if (updated) {
      setSelectedDevice(updated)
      // Match by UDN so that an IP change does not create a duplicate entry.
      setDevices((prev) =>
        prev.map((d) => (d.udn === updated.udn ? updated : d)),
      )
      addLog(`Refreshed: ${updated.name} is online.`)
    } else {
      addLog(`Device ${selectedDevice.name} (${selectedDevice.ip}) is unreachable.`)
    }
  }, [selectedDevice, addLog])

  return {
    devices,
    selectedDevice,
    scanStatus,
    scanProgress,
    activityLog,
    deviceCount: devices.length,
    refreshing,
    diagnostics,
    diagnosticsLoading,
    selectDevice,
    startScan,
    refreshSelected,
  }
}
