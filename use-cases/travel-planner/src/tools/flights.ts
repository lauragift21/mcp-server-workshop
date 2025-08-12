import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { FlightService } from '../services/flight-service'
import { BookingService } from '../services/booking-service'
import { Props } from '../utils'
import { env } from 'cloudflare:workers'

/**
 * Registers flight-related tools with the MCP server
 */
export function registerFlightTools(server: McpServer, props: Props) {
  const flightService = new FlightService(env.AVIATIONSTACK_API_KEY)
  const bookingService = new BookingService(props.accessToken)

  // Flight search tool
  server.tool(
    'search_flights',
    'Search for flights between airports with dates, passengers, and class preferences',
    {
      origin: z.string().describe('Origin airport code (e.g., JFK, LAX)'),
      destination: z.string().describe('Destination airport code (e.g., LHR, CDG)'),
      departureDate: z.string().describe('Departure date in YYYY-MM-DD format'),
      returnDate: z.string().optional().describe('Return date in YYYY-MM-DD format (optional)'),
      passengers: z.number().default(1).describe('Number of passengers'),
      flightClass: z.enum(['economy', 'business', 'first']).default('economy').describe('Flight class'),
    },
    async ({ origin, destination, departureDate, returnDate, passengers, flightClass }) => {
      try {
        const flights = await flightService.searchFlights({
          origin,
          destination,
          departureDate,
          returnDate,
          passengers,
          class: flightClass,
        })

        const flightSummary = flights
          .map(
            (flight) =>
              `${flight.airline} ${flight.flightNumber}: ${flight.origin} → ${flight.destination}\n` +
              `Departure: ${new Date(flight.departureTime).toLocaleString()}\n` +
              `Arrival: ${new Date(flight.arrivalTime).toLocaleString()}\n` +
              `Duration: ${flight.duration}\n` +
              `Price: ${flight.currency} ${flight.price}\n` +
              `Stops: ${flight.stops}\n`,
          )
          .join('\n---\n')

        return {
          content: [
            {
              text: `Found ${flights.length} flights from ${origin} to ${destination}:\n\n${flightSummary}`,
              type: 'text',
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              text: `Error searching flights: ${error instanceof Error ? error.message : 'Unknown error'}`,
              type: 'text',
            },
          ],
        }
      }
    },
  )

  // Flight booking tool
  server.tool(
    'book_flight',
    'Book a flight with passenger information and contact details',
    {
      flightId: z.string().describe('Flight ID from search results'),
      passengers: z
        .array(
          z.object({
            firstName: z.string().describe('Passenger first name'),
            lastName: z.string().describe('Passenger last name'),
            dateOfBirth: z.string().describe('Date of birth in YYYY-MM-DD format'),
            passportNumber: z.string().optional().describe('Passport number (optional)'),
            nationality: z.string().optional().describe('Nationality (optional)'),
          }),
        )
        .describe('List of passengers'),
      contactInfo: z
        .object({
          email: z.string().describe('Contact email'),
          phone: z.string().describe('Contact phone number'),
          firstName: z.string().describe('Contact first name'),
          lastName: z.string().describe('Contact last name'),
        })
        .describe('Contact information'),
    },
    async ({ flightId, passengers, contactInfo }) => {
      try {
        const bookingRequest = {
          flightId,
          passengers,
          contactInfo,
        }

        const confirmation = await bookingService.bookFlight(bookingRequest)

        // Add booking to calendar
        await bookingService.addToCalendar(confirmation)

        return {
          content: [
            {
              text:
                `✅ Flight booked successfully!\n\n` +
                `Booking ID: ${confirmation.bookingId}\n` +
                `Confirmation Number: ${confirmation.confirmationNumber}\n` +
                `Status: ${confirmation.status}\n` +
                `Total Price: ${confirmation.currency} ${confirmation.totalPrice}\n` +
                `Booking Date: ${new Date(confirmation.bookingDate).toLocaleString()}\n\n` +
                `📧 Confirmation email will be sent to ${contactInfo.email}\n` +
                `📅 Flight details have been added to your calendar`,
              type: 'text',
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              text:
                `❌ Flight booking failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
                `Please check your information and try again.`,
              type: 'text',
            },
          ],
        }
      }
    },
  )
}
