/** A verified Roku device found by ECP discovery. */
export interface RokuDevice {
  /** IPv4 address of the device on the local network */
  ip: string
  /** ECP base URL, e.g. http://192.168.1.10:8060 */
  ecpUrl: string
  /** Human-readable device name from ECP device-info */
  name: string
  /** Roku model name, e.g. "Roku Express" */
  model: string
  /** Serial number */
  serialNumber: string
  /** Software/firmware version */
  softwareVersion: string
  /** Unique device name (UDN / uuid) */
  udn: string
  /** When the device was last confirmed reachable */
  lastSeen: number
}

export type ScanStatus = 'idle' | 'scanning' | 'done' | 'error'

export interface ScanProgress {
  scanned: number
  total: number
}
