export interface RokuDevice {
  ip: string
  name: string
  model: string
  serial: string
  softwareVersion: string
  ecpUrl: string
  online: boolean
  lastSeen: number
}

export interface ScanState {
  scanning: boolean
  scanned: number
  total: number
  error: string | null
}
