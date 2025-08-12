import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { CalendarService } from '../services/calender-service'
import { Props } from '../utils'

export function registerCalendarTools(server: McpServer, props: Props) {
  const calendarService = new CalendarService(props.accessToken)

  // Calendar conflict check tool
  server.tool(
    'check_calendar_conflicts',
    'Check your Google Calendar for conflicts with travel dates',
    {
      startDate: z.string().describe('Travel start date in YYYY-MM-DD format'),
      endDate: z.string().describe('Travel end date in YYYY-MM-DD format'),
    },
    async ({ startDate, endDate }) => {
      try {
        // Get calendar events with buffer
        const bufferStart = new Date(startDate)
        bufferStart.setDate(bufferStart.getDate() - 1)

        const bufferEnd = new Date(endDate)
        bufferEnd.setDate(bufferEnd.getDate() + 1)

        const events = await calendarService.getEvents(bufferStart.toISOString(), bufferEnd.toISOString())

        const conflicts = calendarService.checkConflicts(events, startDate, endDate)

        if (conflicts.length === 0) {
          return {
            content: [
              {
                text: `No calendar conflicts found for travel dates ${startDate} to ${endDate}. You're all clear to travel!`,
                type: 'text',
              },
            ],
          }
        }

        const conflictSummary = conflicts
          .map(
            (conflict) =>
              `⚠️ ${conflict.severity.toUpperCase()}: ${conflict.eventTitle}\n` +
              `Type: ${conflict.type}\n` +
              `Time: ${new Date(conflict.conflictTime).toLocaleString()}\n` +
              `Suggestion: ${conflict.suggestion}\n`,
          )
          .join('\n---\n')

        return {
          content: [
            {
              text: `Found ${conflicts.length} potential conflicts for travel dates ${startDate} to ${endDate}:\n\n${conflictSummary}`,
              type: 'text',
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              text: `Error checking calendar conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`,
              type: 'text',
            },
          ],
        }
      }
    },
  )
}
