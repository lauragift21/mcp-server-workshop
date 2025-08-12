import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Props } from '../utils'
import { registerFlightTools } from './flights'
import { registerHotelTools } from './hotel'
import { registerCalendarTools } from './calender'
import { registerTravelPlanTools } from './travel-plan'

/**
 * Registers all travel search MCP tools with the server
 */
export function registerAllTools(server: McpServer, props: Props) {
  // Register individual tool categories
  registerFlightTools(server, props)
  registerHotelTools(server, props)
  registerCalendarTools(server, props)
  registerTravelPlanTools(server, props)
}
