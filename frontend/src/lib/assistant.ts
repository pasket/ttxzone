/** The AI assistant's client configuration (Preferences -> AI assistant). */

/** The MCP endpoint as this browser reaches it (the SPA and the API share
 * an origin, in development through the Vite proxy). */
export function mcpServerUrl(): string {
  return `${window.location.origin}/api/v1/mcp`
}

/** The configuration of a client that speaks MCP over HTTP itself (no
 * Node.js bridge): the server's address and the token as a header. */
export function httpClientConfig(url: string, token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        'ttx-zone': { type: 'http', url, headers: { Authorization: `Bearer ${token}` } },
      },
    },
    null,
    2,
  )
}

/** Claude Desktop's configuration: the mcp-remote bridge sends the token
 * as a header, taken from an environment variable so the argument has no
 * space in it. Plain http is only accepted for localhost unless told. */
export function claudeDesktopConfig(url: string, token: string): string {
  const { protocol, hostname } = new URL(url)
  const local = hostname === 'localhost' || hostname === '127.0.0.1'
  const args = ['-y', 'mcp-remote', url, '--header', 'Authorization:${TTX_ZONE_AUTH}']
  if (protocol === 'http:' && !local) args.push('--allow-http')
  return JSON.stringify(
    {
      mcpServers: {
        'ttx-zone': { command: 'npx', args, env: { TTX_ZONE_AUTH: `Bearer ${token}` } },
      },
    },
    null,
    2,
  )
}

/** Where an accepted proposal's row is recorded once the page's form
 * saved it (POST …/applied). */
export function orgProposalAppliedUrl(organizationId: string, proposalId: string) {
  return `/organizations/${organizationId}/assistant/proposals/${proposalId}/applied`
}
