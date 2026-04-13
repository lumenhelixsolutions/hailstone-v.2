import type { RokuDevice } from '../types/roku'

const ECP_PORT = 8060

export function ecpUrl(ip: string, path: string): string {
  return `http://${ip}:${ECP_PORT}${path}`
}

/**
 * Parse device-info XML and extract Roku-specific fields.
 * Returns null if the response is not a valid Roku ECP device-info document.
 */
function parseRokuDeviceInfo(xml: string): Pick<RokuDevice, 'name' | 'model' | 'serial' | 'softwareVersion'> | null {
  const get = (tag: string): string => {
    const m = xml.match(new RegExp(`<${tag}>([^<]*)<\/${tag}>`))
    return m ? m[1].trim() : ''
  }

  // These fields are present in every Roku ECP device-info response.
  // If they are all empty the response is not a real Roku device.
  const name = get('friendly-device-name')
  const model = get('model-name')
  const serial = get('serial-number')
  const softwareVersion = get('software-version')

  // Require at least one of the Roku-specific identifiers to be present.
  if (!name && !model && !serial) {
    return null
  }

  return { name: name || model, model, serial, softwareVersion }
}

/**
 * Probe a single IP address and return a RokuDevice if the host is a genuine
 * Roku device, or null otherwise.
 *
 * Validation strategy:
 *  1. Fetch /query/device-info on port 8060.
 *  2. Confirm the HTTP response is 200 OK.
 *  3. Parse the returned XML and verify Roku-specific fields are present.
 *     (friendly-device-name, model-name, serial-number)
 *  4. If any check fails, return null — the host is NOT a Roku device.
 */
export async function probeDevice(ip: string, timeoutMs = 2000): Promise<RokuDevice | null> {
  try {
    const res = await fetch(ecpUrl(ip, '/query/device-info'), {
      signal: AbortSignal.timeout(timeoutMs),
    })

    // Must be 200 OK
    if (!res.ok) return null

    const text = await res.text()

    // Must look like an XML document with a <device-info> root element
    if (!text.includes('<device-info>')) return null

    const parsed = parseRokuDeviceInfo(text)
    if (!parsed) return null

    return {
      ip,
      name: parsed.name || ip,
      model: parsed.model,
      serial: parsed.serial,
      softwareVersion: parsed.softwareVersion,
      ecpUrl: `http://${ip}:${ECP_PORT}`,
      online: true,
      lastSeen: Date.now(),
    }
  } catch {
    return null
  }
}

/**
 * Scan all 254 hosts in a /24 subnet in parallel batches.
 *
 * @param subnet   - The first three octets, e.g. "192.168.1"
 * @param onFound  - Called with a verified RokuDevice for each real Roku found
 * @param onProgress - Called after each host is probed with (scanned, total)
 * @param probeTimeoutMs - Per-host timeout in ms
 */
export async function scanSubnet(
  subnet: string,
  onFound: (device: RokuDevice) => void,
  onProgress: (scanned: number, total: number) => void,
  probeTimeoutMs = 2000,
): Promise<void> {
  const total = 254
  let scanned = 0
  const BATCH = 20

  for (let start = 1; start <= total; start += BATCH) {
    const end = Math.min(start + BATCH - 1, total)
    const batch = Array.from({ length: end - start + 1 }, (_, i) => `${subnet}.${start + i}`)
    await Promise.all(
      batch.map(async (ip) => {
        const device = await probeDevice(ip, probeTimeoutMs)
        scanned++
        onProgress(scanned, total)
        if (device) onFound(device)
      }),
    )
  }
}

/**
 * Detect the local /24 subnet by fetching a well-known external URL.
 * Falls back to "192.168.1" if detection fails.
 *
 * Note: In a browser context we cannot read the local IP directly via JS,
 * so we use a WebRTC ICE candidate trick as the best available approach.
 */
export function detectSubnet(): Promise<string> {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] })
      pc.createDataChannel('')
      pc.createOffer().then((offer) => pc.setLocalDescription(offer))

      pc.onicecandidate = (e) => {
        if (!e.candidate) return
        const ipMatch = e.candidate.candidate.match(
          /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})/,
        )
        if (ipMatch) {
          const subnet = `${ipMatch[1]}.${ipMatch[2]}.${ipMatch[3]}`
          pc.close()
          resolve(subnet)
        }
      }

      // Timeout fallback
      setTimeout(() => {
        pc.close()
        resolve('192.168.1')
      }, 3000)
    } catch {
      resolve('192.168.1')
    }
  })
}
