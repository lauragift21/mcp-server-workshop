import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { BookingService } from '../services/booking-service'
import { Props } from '../utils'

/**
 * Registers travel plan management tools with the MCP server
 */
export function registerTravelPlanTools(server: McpServer, props: Props) {
  const bookingService = new BookingService(props.accessToken)

  // Create travel plan tool
  server.tool(
    'create_travel_plan',
    'Create a new travel plan with destinations, dates, travelers, and budget',
    {
      title: z.string().describe('Title for the travel plan'),
      destinations: z.array(z.string()).describe('List of destinations'),
      startDate: z.string().describe('Travel start date in YYYY-MM-DD format'),
      endDate: z.string().describe('Travel end date in YYYY-MM-DD format'),
      travelers: z.number().default(1).describe('Number of travelers'),
      budget: z.number().optional().describe('Budget for the trip'),
    },
    async ({ title, destinations, startDate, endDate, travelers, budget }) => {
      try {
        const plan = await bookingService.createTravelPlan(title, destinations, startDate, endDate, travelers, budget)

        return {
          content: [
            {
              text:
                `✅ Travel plan created successfully!\n\n` +
                `Plan ID: ${plan.id}\n` +
                `Title: ${plan.title}\n` +
                `Destinations: ${plan.destinations.join(', ')}\n` +
                `Dates: ${plan.startDate} to ${plan.endDate}\n` +
                `Travelers: ${plan.travelers}\n` +
                `Budget: ${plan.budget ? `$${plan.budget}` : 'Not set'}\n` +
                `Status: ${plan.status}\n\n` +
                `🎯 Use this Plan ID (${plan.id}) to search for flights and hotels, then book your complete trip!`,
              type: 'text',
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              text: `❌ Failed to create travel plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
              type: 'text',
            },
          ],
        }
      }
    },
  )

  // Get travel plan tool
  server.tool(
    'get_travel_plan',
    'Retrieve details of an existing travel plan',
    {
      planId: z.string().describe('Travel plan ID'),
    },
    async ({ planId }) => {
      try {
        const plan = await bookingService.getTravelPlan(planId)

        if (!plan) {
          return {
            content: [
              {
                text: `❌ Travel plan not found with ID: ${planId}`,
                type: 'text',
              },
            ],
          }
        }

        const flightSummary =
          plan.flights && plan.flights.length > 0
            ? `\n\n✈️ Flights (${plan.flights.length}):\n` + plan.flights.map((f) => `- ${f.confirmationNumber} (${f.status})`).join('\n')
            : '\n\n✈️ No flights booked yet'

        const hotelSummary =
          plan.hotels && plan.hotels.length > 0
            ? `\n\n🏨 Hotels (${plan.hotels.length}):\n` + plan.hotels.map((h) => `- ${h.confirmationNumber} (${h.status})`).join('\n')
            : '\n\n🏨 No hotels booked yet'

        return {
          content: [
            {
              text:
                `📋 Travel Plan Details\n\n` +
                `Plan ID: ${plan.id}\n` +
                `Title: ${plan.title}\n` +
                `Destinations: ${plan.destinations.join(', ')}\n` +
                `Dates: ${plan.startDate} to ${plan.endDate}\n` +
                `Travelers: ${plan.travelers}\n` +
                `Budget: ${plan.budget ? `$${plan.budget}` : 'Not set'}\n` +
                `Status: ${plan.status}\n` +
                `Created: ${new Date(plan.createdAt).toLocaleString()}\n` +
                `Updated: ${new Date(plan.updatedAt).toLocaleString()}` +
                flightSummary +
                hotelSummary,
              type: 'text',
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              text: `❌ Failed to retrieve travel plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
              type: 'text',
            },
          ],
        }
      }
    },
  )

  // Book complete trip tool
  server.tool(
    'book_trip',
    'Book a complete trip with flights and hotels for a travel plan',
    {
      planId: z.string().describe('Travel plan ID'),
      flightBookings: z
        .array(
          z.object({
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
          }),
        )
        .describe('Flight bookings to make'),
      hotelBookings: z
        .array(
          z.object({
            hotelId: z.string().describe('Hotel ID from search results'),
            checkIn: z.string().describe('Check-in date in YYYY-MM-DD format'),
            checkOut: z.string().describe('Check-out date in YYYY-MM-DD format'),
            rooms: z.number().describe('Number of rooms'),
            guests: z.number().describe('Number of guests'),
            guestInfo: z
              .array(
                z.object({
                  firstName: z.string().describe('Guest first name'),
                  lastName: z.string().describe('Guest last name'),
                  email: z.string().optional().describe('Guest email (optional)'),
                }),
              )
              .describe('List of guests'),
          }),
        )
        .describe('Hotel bookings to make'),
      contactInfo: z
        .object({
          email: z.string().describe('Contact email'),
          phone: z.string().describe('Contact phone number'),
          firstName: z.string().describe('Contact first name'),
          lastName: z.string().describe('Contact last name'),
        })
        .describe('Contact information for all bookings'),
    },
    async ({ planId, flightBookings, hotelBookings, contactInfo }) => {
      try {
        // Convert to booking service format
        const flightRequests = flightBookings.map((fb) => ({
          flightId: fb.flightId,
          passengers: fb.passengers,
          contactInfo,
        }))

        const hotelRequests = hotelBookings.map((hb) => ({
          hotelId: hb.hotelId,
          checkIn: hb.checkIn,
          checkOut: hb.checkOut,
          rooms: hb.rooms,
          guests: hb.guests,
          guestInfo: hb.guestInfo,
          contactInfo,
        }))

        const result = await bookingService.bookTrip(planId, flightRequests, hotelRequests)

        const flightSummary =
          result.flightConfirmations.length > 0
            ? `\n\n✈️ Flights Booked (${result.flightConfirmations.length}):\n` +
              result.flightConfirmations.map((f) => `- ${f.confirmationNumber} (${f.status}) - ${f.currency} ${f.totalPrice}`).join('\n')
            : ''

        const hotelSummary =
          result.hotelConfirmations.length > 0
            ? `\n\n🏨 Hotels Booked (${result.hotelConfirmations.length}):\n` +
              result.hotelConfirmations.map((h) => `- ${h.confirmationNumber} (${h.status}) - ${h.currency} ${h.totalPrice}`).join('\n')
            : ''

        return {
          content: [
            {
              text:
                `🎉 Trip booked successfully!\n\n` +
                `Travel Plan: ${result.plan.title}\n` +
                `Plan ID: ${result.plan.id}\n` +
                `Status: ${result.plan.status}\n` +
                `Total Cost: $${result.totalCost}\n` +
                `Booking Date: ${new Date().toLocaleString()}` +
                flightSummary +
                hotelSummary +
                `\n\n📧 Confirmation emails will be sent to ${contactInfo.email}\n` +
                `📅 All bookings have been added to your calendar\n` +
                `🎯 Your complete trip is now confirmed!`,
              type: 'text',
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              text:
                `❌ Trip booking failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
                `Some bookings may have been partially completed. Please check individual confirmations.`,
              type: 'text',
            },
          ],
        }
      }
    },
  )
}
