import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McpAgent } from 'agents/mcp'
import { GoogleHandler } from './google-handler.js'
import { registerAllTools } from './tools'
import { Props } from './utils'
export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: 'Travel Planner MCP',
    version: '1.0.0',
  })

  async init() {
    // Register all tools using the tools directory
    const props = this.props as Props
    registerAllTools(this.server, props)
  }
}

export default new OAuthProvider({
  apiHandler: MyMCP.mount('/sse') as any,
  apiRoute: '/sse',
  authorizeEndpoint: '/authorize',
  clientRegistrationEndpoint: '/register',
  defaultHandler: GoogleHandler as any,
  tokenEndpoint: '/token',
})
