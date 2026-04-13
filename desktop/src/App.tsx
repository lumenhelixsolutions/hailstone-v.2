import { useState, useCallback, useRef } from 'react'
import type { RokuDevice, ScanState } from './types/roku'
import { scanSubnet, detectSubnet, probeDevice } from './lib/roku'

type Page = 'dashboard' | 'devices' | 'apps' | 'settings'

const INITIAL_SCAN: ScanState = { scanning: false, scanned: 0, total: 254, error: null }

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [devices, setDevices] = useState<RokuDevice[]>([])
  const [selectedIp, setSelectedIp] = useState<string | null>(null)
  const [scanState, setScanState] = useState<ScanState>(INITIAL_SCAN)
  const [log, setLog] = useState<string[]>([])
  const [lastRefresh, setLastRefresh] = useState<number | null>(null)
  const scanAbortRef = useRef<{ aborted: boolean }>({ aborted: false })

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 100))
  }, [])

  /**
   * Add or update a device in state, deduplicated by IP.
   * If a device with the same IP already exists, it is updated rather than duplicated.
   */
  const upsertDevice = useCallback((device: RokuDevice) => {
    setDevices((prev) => {
      const idx = prev.findIndex((d) => d.ip === device.ip)
      if (idx >= 0) {
        const updated = [...prev]
        updated[idx] = device
        return updated
      }
      return [...prev, device]
    })
  }, [])

  const handleScan = useCallback(async () => {
    if (scanState.scanning) return

    // Reset scan state and REPLACE device list (do not accumulate across scans)
    const abort = { aborted: false }
    scanAbortRef.current = abort
    setDevices([])
    setScanState({ scanning: true, scanned: 0, total: 254, error: null })
    setLog([])
    addLog('Starting network scan…')

    try {
      const subnet = await detectSubnet()
      addLog(`Detected subnet: ${subnet}.0/24`)

      await scanSubnet(
        subnet,
        (device) => {
          if (abort.aborted) return
          upsertDevice(device)
          addLog(`Found Roku device: ${device.name} (${device.ip})`)
        },
        (scanned, total) => {
          if (abort.aborted) return
          setScanState((s) => ({ ...s, scanned, total }))
        },
      )

      if (!abort.aborted) {
        setLastRefresh(Date.now())
        setScanState((s) => ({ ...s, scanning: false }))
        addLog('Scan complete.')
      }
    } catch (err) {
      if (!abort.aborted) {
        const msg = err instanceof Error ? err.message : String(err)
        setScanState((s) => ({ ...s, scanning: false, error: msg }))
        addLog(`Scan error: ${msg}`)
      }
    }
  }, [scanState.scanning, addLog, upsertDevice])

  const handleStopScan = useCallback(() => {
    scanAbortRef.current.aborted = true
    setScanState((s) => ({ ...s, scanning: false }))
    addLog('Scan stopped by user.')
  }, [addLog])

  const handleRefreshDevice = useCallback(async () => {
    if (!selectedIp) return
    addLog(`Refreshing ${selectedIp}…`)
    const device = await probeDevice(selectedIp)
    if (device) {
      upsertDevice(device)
      setLastRefresh(Date.now())
      addLog(`Refreshed: ${device.name} (${device.ip})`)
    } else {
      setDevices((prev) =>
        prev.map((d) => (d.ip === selectedIp ? { ...d, online: false } : d)),
      )
      addLog(`Device ${selectedIp} is offline or not responding.`)
    }
  }, [selectedIp, addLog, upsertDevice])

  const selectedDevice = devices.find((d) => d.ip === selectedIp) ?? null

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 font-sans">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-800">
          <h1 className="text-lg font-bold text-blue-400">Roku Portal</h1>
          <p className="text-xs text-gray-500 mt-0.5">ECP Device Manager</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {(['dashboard', 'devices', 'apps', 'settings'] as Page[]).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm capitalize transition-colors ${
                page === p
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`}
            >
              {p}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-800 text-xs text-gray-600">
          {devices.length} device{devices.length !== 1 ? 's' : ''} found
        </div>
      </aside>

      {/* Main area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6">
          <h2 className="text-sm font-semibold capitalize">{page}</h2>
          <div className="flex gap-2">
            {scanState.scanning ? (
              <button
                onClick={handleStopScan}
                className="px-3 py-1.5 text-xs bg-red-700 hover:bg-red-600 rounded-md"
              >
                Stop Scan
              </button>
            ) : (
              <button
                onClick={handleScan}
                className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-md"
              >
                Scan Network
              </button>
            )}
            {selectedDevice && (
              <button
                onClick={handleRefreshDevice}
                className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-md"
              >
                Refresh Device
              </button>
            )}
          </div>
        </header>

        {/* Scan progress bar */}
        {scanState.scanning && (
          <div className="bg-gray-900 px-6 py-2 border-b border-gray-800">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Scanning subnet…</span>
              <span>{scanState.scanned} / {scanState.total}</span>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${(scanState.scanned / scanState.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {page === 'dashboard' && (
            <DashboardPage
              selectedDevice={selectedDevice}
              devices={devices}
              lastRefresh={lastRefresh}
              onScan={handleScan}
              onRefresh={handleRefreshDevice}
              onSelectDevice={setSelectedIp}
              log={log}
            />
          )}
          {page === 'devices' && (
            <DevicesPage
              devices={devices}
              selectedIp={selectedIp}
              onSelect={setSelectedIp}
              onScan={handleScan}
              scanning={scanState.scanning}
            />
          )}
          {page === 'apps' && <AppsPage selectedDevice={selectedDevice} />}
          {page === 'settings' && <SettingsPage />}
        </div>
      </main>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

interface DashboardProps {
  selectedDevice: RokuDevice | null
  devices: RokuDevice[]
  lastRefresh: number | null
  onScan: () => void
  onRefresh: () => void
  onSelectDevice: (ip: string) => void
  log: string[]
}

function DashboardPage({ selectedDevice, devices, lastRefresh, onRefresh, log }: DashboardProps) {
  return (
    <div className="space-y-6">
      {/* Status card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Selected Device</h3>
        {selectedDevice ? (
          <div className="space-y-1.5 text-sm">
            <div className="flex gap-2">
              <span className="text-gray-500 w-32">Name</span>
              <span className="font-medium">{selectedDevice.name}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-32">IP Address</span>
              <span className="font-mono">{selectedDevice.ip}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-32">ECP Endpoint</span>
              <span className="font-mono text-blue-400">{selectedDevice.ecpUrl}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-32">Model</span>
              <span>{selectedDevice.model || '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-32">Serial</span>
              <span className="font-mono">{selectedDevice.serial || '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-32">Software</span>
              <span>{selectedDevice.softwareVersion || '—'}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-32">Status</span>
              <span className={selectedDevice.online ? 'text-green-400' : 'text-red-400'}>
                {selectedDevice.online ? 'Online' : 'Offline'}
              </span>
            </div>
            {lastRefresh && (
              <div className="flex gap-2">
                <span className="text-gray-500 w-32">Last Refresh</span>
                <span className="text-gray-400">{new Date(lastRefresh).toLocaleTimeString()}</span>
              </div>
            )}
            <div className="pt-2">
              <button
                onClick={onRefresh}
                className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-md"
              >
                Refresh Status
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {devices.length > 0
              ? 'Select a device from the Devices page.'
              : 'No Roku devices found. Click "Scan Network" to discover devices.'}
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-2xl font-bold">{devices.filter((d) => d.online).length}</div>
          <div className="text-xs text-gray-500 mt-1">Online Roku Devices</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-2xl font-bold">{devices.length}</div>
          <div className="text-xs text-gray-500 mt-1">Total Discovered</div>
        </div>
      </div>

      {/* Activity log */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-400 mb-3">Activity Log</h3>
        {log.length === 0 ? (
          <p className="text-xs text-gray-600">No activity yet.</p>
        ) : (
          <div className="space-y-0.5 max-h-40 overflow-y-auto font-mono text-xs text-gray-400">
            {log.map((entry, i) => (
              <div key={i}>{entry}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Devices page
// ---------------------------------------------------------------------------

interface DevicesPageProps {
  devices: RokuDevice[]
  selectedIp: string | null
  onSelect: (ip: string) => void
  onScan: () => void
  scanning: boolean
}

function DevicesPage({ devices, selectedIp, onSelect, onScan, scanning }: DevicesPageProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-400">
          {devices.length} Roku device{devices.length !== 1 ? 's' : ''} found
        </h3>
        <button
          onClick={onScan}
          disabled={scanning}
          className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-md"
        >
          {scanning ? 'Scanning…' : 'Scan Network'}
        </button>
      </div>

      {devices.length === 0 && !scanning && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <p className="text-gray-500 text-sm">No Roku devices found on this network.</p>
          <p className="text-gray-600 text-xs mt-1">
            Make sure your Roku device is powered on and connected to the same network.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {devices.map((device) => (
          <button
            key={device.ip}
            onClick={() => onSelect(device.ip)}
            className={`w-full text-left bg-gray-900 border rounded-xl p-4 transition-colors ${
              selectedIp === device.ip
                ? 'border-blue-500 bg-gray-800'
                : 'border-gray-800 hover:border-gray-600'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{device.name}</div>
                <div className="text-xs text-gray-500 font-mono mt-0.5">{device.ip}</div>
                {device.model && (
                  <div className="text-xs text-gray-600 mt-0.5">{device.model}</div>
                )}
              </div>
              <div
                className={`text-xs px-2 py-0.5 rounded-full ${
                  device.online
                    ? 'bg-green-900 text-green-400'
                    : 'bg-red-900 text-red-400'
                }`}
              >
                {device.online ? 'Online' : 'Offline'}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Apps page
// ---------------------------------------------------------------------------

function AppsPage({ selectedDevice }: { selectedDevice: RokuDevice | null }) {
  if (!selectedDevice) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-500 text-sm">Connect a Roku device to load installed apps.</p>
        <p className="text-gray-600 text-xs mt-1">
          Go to the Devices page, run a scan, and select a device.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
      <p className="text-gray-500 text-sm">
        App listing via ECP is not yet implemented for{' '}
        <span className="text-blue-400">{selectedDevice.name}</span>.
      </p>
      <p className="text-gray-600 text-xs mt-1">
        ECP endpoint: {selectedDevice.ecpUrl}/query/apps
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------

function SettingsPage() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-400">Settings</h3>
      <p className="text-xs text-gray-600">Settings persistence is not yet implemented.</p>
    </div>
  )
}
