import type { RokuDevice } from '../types/roku'

const ECP_PORT = 8060

/** Build an ECP URL for the given IP and path. */
export function ecpUrl(ip: string, path: string): string {
  return `http://${ip}:${ECP_PORT}${path}`
}

/**
 * Parse a single text value out of an XML string by tag name.
 * Returns null if the tag is absent or empty.
 */
function parseXmlTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i')
  const m = re.exec(xml)
  return m && m[1].trim() ? m[1].trim() : null
}

/**
 * Attempt to probe an IP address and validate that it is a real Roku device.
 *
 * FIX (was: only checked `res.ok`):
 *   We now read the response body and confirm Roku-specific ECP XML fields
 *   are present. Any host that merely returns HTTP 200 on port 8060 but
 *   does NOT include the required Roku device-info fields is rejected.
 *
 * @returns A populated RokuDevice on success, or null if the host is not
 *          a valid Roku device or is unreachable.
 */
export async function probeDevice(
  ip: string,
  timeoutMs = 1500,
): Promise<RokuDevice | null> {
  try {
    const res = await fetch(ecpUrl(ip, '/query/device-info'), {
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!res.ok) return null

    const xml = await res.text()

    // ── Roku-specific validation ────────────────────────────────────────────
    // A genuine Roku ECP response MUST contain all of these fields.
    // If any are absent the host is not a real Roku device.
    const name = parseXmlTag(xml, 'friendly-device-name')
    const model = parseXmlTag(xml, 'model-name')
    const serialNumber = parseXmlTag(xml, 'serial-number')
    const softwareVersion = parseXmlTag(xml, 'software-version')
    const udn = parseXmlTag(xml, 'udn')

    if (!name || !model || !serialNumber || !softwareVersion || !udn) {
      return null
    }
    // ────────────────────────────────────────────────────────────────────────

    return {
      ip,
      ecpUrl: ecpUrl(ip, ''),
      name,
      model,
      serialNumber,
      softwareVersion,
      udn,
      lastSeen: Date.now(),
    }
  } catch {
    return null
  }
}

/**
 * Scan all 254 hosts in a /24 subnet in parallel batches, calling
 * onFound only for hosts that pass the Roku ECP validation in probeDevice.
 *
 * FIX: onFound now receives a full RokuDevice (not just an IP) so that
 *      callers never need to store unvalidated IPs.
 */
export async function scanSubnet(
  subnet: string,
  onFound: (device: RokuDevice) => void,
  onProgress: (scanned: number, total: number) => void,
  probeTimeoutMs = 1500,
): Promise<void> {
  const total = 254
  let scanned = 0
  const BATCH = 25

  for (let start = 1; start <= total; start += BATCH) {
    const end = Math.min(start + BATCH - 1, total)
    const batch = Array.from(
      { length: end - start + 1 },
      (_, i) => `${subnet}.${start + i}`,
    )

    await Promise.all(
      batch.map(async (ip) => {
        const device = await probeDevice(ip, probeTimeoutMs)
        scanned++
        onProgress(scanned, total)
        if (device !== null) onFound(device)
      }),
    )
  }
}

/**
 * Return the /24 subnet prefix to scan.
 *
 * In a browser / Vite dev context we cannot read the host's local IP
 * directly (no native shell access). Most home/office networks use
 * 192.168.1.x, so that prefix is used as the default.
 *
 * In a real Tauri desktop build this function should be replaced with a
 * Tauri command that returns `localIp().split('.').slice(0, 3).join('.')`.
 */
export function detectSubnet(): string {
  return '192.168.1'
}

/**
 * Re-check a single previously discovered device to confirm it is still
 * reachable and return fresh metadata.
 */
export async function refreshDevice(device: RokuDevice): Promise<RokuDevice | null> {
  return probeDevice(device.ip)
}
