import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { registerDocumentTools } from './google-docs'
import { registerJiraTools } from './jira'

/**
 * Registers all document processing and Jira MCP tools with the server
 */
export function registerAllTools(server: McpServer) {
  // Register individual tool categories
  registerDocumentTools(server)
  registerJiraTools(server)
}
