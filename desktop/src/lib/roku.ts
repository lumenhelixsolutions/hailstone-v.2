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

// ── Diagnostics ───────────────────────────────────────────────────────────────

export interface NetworkDiagnostics {
  /** The /24 subnet prefix that will be scanned. */
  subnet: string
  /** True when running in a browser context (not a native Tauri shell). */
  isBrowserContext: boolean
  /**
   * True when browser CORS policy is likely to block ECP fetches.
   *
   * Roku ECP endpoints do not emit Access-Control-Allow-Origin headers, so any
   * page served from an http(s):// origin will have its cross-origin requests
   * blocked by the browser.  Only a native Tauri webview (which uses a custom
   * protocol) or a localhost dev-proxy can bypass this.
   */
  corsLikelyBlocked: boolean
  /**
   * Result of a test probe against the gateway (.1) of the detected subnet.
   * 'reachable'  – the host answered and returned Roku ECP XML.
   * 'cors-error' – the fetch was blocked by CORS (TypeError with no status).
   * 'unreachable'– connection refused / timed out.
   * 'pending'    – the check has not completed yet.
   */
  gatewayProbeStatus: 'reachable' | 'cors-error' | 'unreachable' | 'pending'
  /** Human-readable explanation of the current environment / limitations. */
  summary: string
}

/**
 * Run a quick environment and network self-check and return a
 * NetworkDiagnostics report.  This is the "Rust diagnostic bridge" for the
 * browser/Vite build — it surfaces the same information a native Tauri command
 * would expose, using only browser APIs.
 */
export async function runDiagnostics(): Promise<NetworkDiagnostics> {
  const subnet = detectSubnet()

  // Is the page served from a real http(s) origin?  (vs tauri:// or file://)
  const origin = typeof window !== 'undefined' ? window.location.protocol : 'tauri:'
  const isBrowserContext = origin === 'http:' || origin === 'https:'

  // CORS blocks cross-origin requests from http(s) pages to Roku ECP.
  // A tauri:// or file:// origin behaves like a native app and is not blocked.
  const corsLikelyBlocked = isBrowserContext

  // Quick probe of the subnet gateway to characterise reachability.
  let gatewayProbeStatus: NetworkDiagnostics['gatewayProbeStatus'] = 'pending'
  try {
    const res = await fetch(ecpUrl(`${subnet}.1`, '/query/device-info'), {
      signal: AbortSignal.timeout(2000),
    })
    // If we got a response at all, CORS is NOT blocking (e.g. Vite proxy is
    // in place).  Check whether the response looks like Roku ECP.
    const xml = await res.text()
    const looksLikeEcp = xml.includes('device-info') || xml.includes('friendly-device-name')
    gatewayProbeStatus = res.ok && looksLikeEcp ? 'reachable' : 'unreachable'
  } catch (err) {
    // A TypeError with message "Failed to fetch" (no response at all) is the
    // browser CORS fingerprint.  A network error with a status-like message
    // indicates plain unreachability.
    const msg = err instanceof Error ? err.message : String(err)
    if (
      msg.toLowerCase().includes('failed to fetch') ||
      msg.toLowerCase().includes('load failed') ||
      msg.toLowerCase().includes('networkerror')
    ) {
      gatewayProbeStatus = corsLikelyBlocked ? 'cors-error' : 'unreachable'
    } else {
      gatewayProbeStatus = 'unreachable'
    }
  }

  let summary: string
  if (gatewayProbeStatus === 'cors-error' || corsLikelyBlocked) {
    summary =
      'Running as a web app (browser context). ' +
      'Browser CORS policy blocks cross-origin fetches to Roku ECP (port 8060). ' +
      'Device discovery will not work until the app is built as a native Tauri desktop app ' +
      'or a local ECP proxy is configured in vite.config.ts.'
  } else if (gatewayProbeStatus === 'reachable') {
    summary = `ECP reachable on ${subnet}.x — discovery should work.`
  } else {
    summary =
      `Subnet ${subnet}.0/24 is unreachable or no Roku devices responded on port 8060. ` +
      'Ensure the Roku device is powered on and on the same network.'
  }

  return {
    subnet,
    isBrowserContext,
    corsLikelyBlocked,
    gatewayProbeStatus,
    summary,
  }
}
