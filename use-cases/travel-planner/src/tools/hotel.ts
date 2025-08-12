import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { HotelService } from '../services/hotel-service'
import { BookingService } from '../services/booking-service'
import { Props } from '../utils'
import { env } from 'cloudflare:workers'

/**
 * Registers hotel-related tools with the MCP server
 */
export function registerHotelTools(server: McpServer, props: Props) {
  const hotelService = new HotelService(env.RAPIDAPI_KEY)
  const bookingService = new BookingService(props.accessToken)

  // Hotel search tool
  server.tool(
    'search_hotels',
    'Search for hotels by destination, dates, guests, and rating/price filters',
    {
      destination: z.string().describe('Destination city or location'),
      checkIn: z.string().describe('Check-in date in YYYY-MM-DD format'),
      checkOut: z.string().describe('Check-out date in YYYY-MM-DD format'),
      guests: z.number().default(1).describe('Number of guests'),
      rooms: z.number().default(1).describe('Number of rooms'),
      minRating: z.number().optional().describe('Minimum hotel rating (1-5)'),
      maxPrice: z.number().optional().describe('Maximum price per night'),
    },
    async ({ destination, checkIn, checkOut, guests, rooms, minRating, maxPrice }) => {
      try {
        const hotels = await hotelService.searchHotels({
          destination,
          checkIn,
          checkOut,
          guests,
          rooms,
          minRating,
          maxPrice,
        })

        const hotelSummary = hotels
          .map(
            (hotel) =>
              `${hotel.name} (${hotel.rating}⭐)\n` +
              `Location: ${hotel.address}, ${hotel.city}\n` +
              `Price: ${hotel.currency} ${hotel.pricePerNight}/night (Total: ${hotel.currency} ${hotel.totalPrice})\n` +
              `Amenities: ${hotel.amenities.slice(0, 5).join(', ')}\n`,
          )
          .join('\n---\n')

        return {
          content: [
            {
              text: `Found ${hotels.length} hotels in ${destination}:\n\n${hotelSummary}`,
              type: 'text',
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              text: `Error searching hotels: ${error instanceof Error ? error.message : 'Unknown error'}`,
              type: 'text',
            },
          ],
        }
      }
    },
  )

  // Hotel booking tool
  server.tool(
    'book_hotel',
    'Book a hotel with guest information and contact details',
    {
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
      contactInfo: z
        .object({
          email: z.string().describe('Contact email'),
          phone: z.string().describe('Contact phone number'),
          firstName: z.string().describe('Contact first name'),
          lastName: z.string().describe('Contact last name'),
        })
        .describe('Contact information'),
    },
    async ({ hotelId, checkIn, checkOut, rooms, guests, guestInfo, contactInfo }) => {
      try {
        const bookingRequest = {
          hotelId,
          checkIn,
          checkOut,
          rooms,
          guests,
          guestInfo,
          contactInfo,
        }

        const confirmation = await bookingService.bookHotel(bookingRequest)

        // Add booking to calendar
        await bookingService.addToCalendar(confirmation)

        const nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))

        return {
          content: [
            {
              text:
                `✅ Hotel booked successfully!\n\n` +
                `Booking ID: ${confirmation.bookingId}\n` +
                `Confirmation Number: ${confirmation.confirmationNumber}\n` +
                `Status: ${confirmation.status}\n` +
                `Check-in: ${checkIn}\n` +
                `Check-out: ${checkOut}\n` +
                `Duration: ${nights} nights\n` +
                `Rooms: ${rooms}\n` +
                `Guests: ${guests}\n` +
                `Total Price: ${confirmation.currency} ${confirmation.totalPrice}\n` +
                `Booking Date: ${new Date(confirmation.bookingDate).toLocaleString()}\n\n` +
                `📧 Confirmation email will be sent to ${contactInfo.email}\n` +
                `📅 Hotel stay has been added to your calendar`,
              type: 'text',
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              text:
                `❌ Hotel booking failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
                `Please check your information and try again.`,
              type: 'text',
            },
          ],
        }
      }
    },
  )
}
