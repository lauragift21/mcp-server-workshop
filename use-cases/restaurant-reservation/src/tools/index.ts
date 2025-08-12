import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerRestaurantTools } from './restaurant';
import { registerReservationTools } from './reservation';

/**
 * Registers all restaurant reservation MCP tools with the server
 */
export function registerAllTools(server: McpServer) {
  registerRestaurantTools(server);
  registerReservationTools(server);
}
