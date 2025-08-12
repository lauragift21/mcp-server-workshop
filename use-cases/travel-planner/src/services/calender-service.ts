import { CalendarEvent, Conflict } from '../types'

export class CalendarService {
  private accessToken: string
  private baseUrl = 'https://www.googleapis.com/calendar/v3'

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  async getEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
    try {
      const url = new URL(`${this.baseUrl}/calendars/primary/events`)
      url.searchParams.set('timeMin', new Date(startDate).toISOString())
      url.searchParams.set('timeMax', new Date(endDate).toISOString())
      url.searchParams.set('singleEvents', 'true')
      url.searchParams.set('orderBy', 'startTime')

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Calendar API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as { items?: any[] }
      return this.transformCalendarEvents(data.items || [])
    } catch (error) {
      console.error('Error fetching calendar events:', error)
      // Return mock data for development
      return this.getMockEvents(startDate, endDate)
    }
  }

  private transformCalendarEvents(events: any[]): CalendarEvent[] {
    return events.map((event) => ({
      id: event.id,
      summary: event.summary || 'No title',
      description: event.description,
      start: {
        dateTime: event.start.dateTime,
        date: event.start.date,
        timeZone: event.start.timeZone,
      },
      end: {
        dateTime: event.end.dateTime,
        date: event.end.date,
        timeZone: event.end.timeZone,
      },
      location: event.location,
    }))
  }

  private getMockEvents(startDate: string, endDate: string): CalendarEvent[] {
    const start = new Date(startDate)
    const mockEvents: CalendarEvent[] = []

    // Add some mock events for testing
    const event1Date = new Date(start)
    event1Date.setDate(start.getDate() + 1)

    mockEvents.push({
      id: 'mock_event_1',
      summary: 'Team Meeting',
      description: 'Weekly team sync meeting',
      start: {
        dateTime: event1Date.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: new Date(event1Date.getTime() + 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        timeZone: 'America/New_York',
      },
      location: 'Conference Room A',
    })

    const event2Date = new Date(start)
    event2Date.setDate(start.getDate() + 2)
    event2Date.setHours(14, 0, 0, 0)

    mockEvents.push({
      id: 'mock_event_2',
      summary: 'Client Presentation',
      description: 'Quarterly business review with client',
      start: {
        dateTime: event2Date.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        timeZone: 'America/New_York',
      },
      end: {
        dateTime: new Date(event2Date.getTime() + 2 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        timeZone: 'America/New_York',
      },
      location: 'Client Office',
    })

    return mockEvents
  }

  async createEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent | null> {
    try {
      const response = await fetch(`${this.baseUrl}/calendars/primary/events`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start: event.start,
          end: event.end,
          location: event.location,
        }),
      })

      if (!response.ok) {
        throw new Error(`Calendar create event error: ${response.status}`)
      }

      const data = await response.json()
      return this.transformCalendarEvents([data])[0]
    } catch (error) {
      console.error('Error creating calendar event:', error)
      return null
    }
  }

  checkConflicts(events: CalendarEvent[], travelStartDate: string, travelEndDate: string): Conflict[] {
    const conflicts: Conflict[] = []
    const travelStart = new Date(travelStartDate)
    const travelEnd = new Date(travelEndDate)

    // Add buffer time for travel (4 hours before departure, 2 hours after return)
    const departureBuffer = new Date(travelStart.getTime() - 4 * 60 * 60 * 1000)
    const returnBuffer = new Date(travelEnd.getTime() + 2 * 60 * 60 * 1000)

    for (const event of events) {
      const eventStart = new Date(event.start.dateTime || event.start.date || '')
      const eventEnd = new Date(event.end.dateTime || event.end.date || '')

      // Check for overlaps with travel period
      if (this.isOverlapping(eventStart, eventEnd, travelStart, travelEnd)) {
        conflicts.push({
          type: 'overlap',
          eventId: event.id,
          eventTitle: event.summary,
          conflictTime: eventStart.toISOString(),
          severity: 'high',
          suggestion: 'Consider rescheduling this event or adjusting travel dates',
        })
      }

      // Check for tight schedule conflicts (events too close to travel time)
      if (this.isTooClose(eventStart, eventEnd, departureBuffer, travelStart)) {
        conflicts.push({
          type: 'tight_schedule',
          eventId: event.id,
          eventTitle: event.summary,
          conflictTime: eventStart.toISOString(),
          severity: 'medium',
          suggestion: 'Allow more time between this event and travel departure',
        })
      }

      if (this.isTooClose(returnBuffer, travelEnd, eventStart, eventEnd)) {
        conflicts.push({
          type: 'tight_schedule',
          eventId: event.id,
          eventTitle: event.summary,
          conflictTime: eventStart.toISOString(),
          severity: 'medium',
          suggestion: 'Allow more time between travel return and this event',
        })
      }

      // Check for travel time conflicts (events in different locations)
      if (event.location && this.requiresTravelTime(event.location, travelStart, travelEnd)) {
        conflicts.push({
          type: 'travel_time',
          eventId: event.id,
          eventTitle: event.summary,
          conflictTime: eventStart.toISOString(),
          severity: 'low',
          suggestion: 'Consider travel time to/from this event location',
        })
      }
    }

    return conflicts
  }

  private isOverlapping(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && start2 < end1
  }

  private isTooClose(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    const timeDiff = Math.abs(end1.getTime() - start2.getTime())
    const oneHour = 60 * 60 * 1000
    return timeDiff < oneHour
  }

  private requiresTravelTime(eventLocation: string, travelStart: Date, travelEnd: Date): boolean {
    // Simple heuristic: if event location contains airport codes or is far from typical locations
    const airportCodes = ['airport', 'terminal', 'gate']
    const location = eventLocation.toLowerCase()
    return airportCodes.some((code) => location.includes(code))
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      })

      return response.ok
    } catch (error) {
      console.error('Error deleting calendar event:', error)
      return false
    }
  }

  async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | null> {
    try {
      const response = await fetch(`${this.baseUrl}/calendars/primary/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary: updates.summary,
          description: updates.description,
          start: updates.start,
          end: updates.end,
          location: updates.location,
        }),
      })

      if (!response.ok) {
        throw new Error(`Calendar update event error: ${response.status}`)
      }

      const data = await response.json()
      return this.transformCalendarEvents([data])[0]
    } catch (error) {
      console.error('Error updating calendar event:', error)
      return null
    }
  }
}
