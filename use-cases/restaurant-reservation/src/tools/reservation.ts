import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ReservationService } from '../services/reservation-service';
import { RestaurantService } from '../services/restaurant-service';
import { env } from 'cloudflare:workers';

/**
 * Registers reservation management tools with the MCP server
 */
export function registerReservationTools(server: McpServer) {
  const apiKey = env.YELP_API_KEY;
  if (!apiKey) {
    throw new Error('YELP_API_KEY environment variable is required');
  }
  const reservationService = ReservationService.getInstance();
  const restaurantService = new RestaurantService(apiKey);

  // Tool to check restaurant availability
  server.tool(
    'check_availability',
    'Check if a restaurant has availability for a specific date, time, and party size',
    {
      restaurantId: z.string().describe('The unique ID of the restaurant'),
      date: z.string().describe('Reservation date (e.g., "2024-08-15")'),
      time: z.string().describe('Preferred time (e.g., "7:00 PM")'),
      partySize: z
        .number()
        .min(1)
        .max(20)
        .describe('Number of people in the party'),
    },
    async ({ restaurantId, date, time, partySize }) => {
      try {
        const restaurant = await restaurantService.getRestaurantById(
          restaurantId
        );
        if (!restaurant) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Restaurant not found. Please check the restaurant ID.',
              },
            ],
          };
        }

        const availability = await reservationService.checkAvailability({
          restaurantId,
          date,
          time,
          partySize,
        });

        const statusIcon = availability.isAvailable ? '✅' : '❌';
        const message =
          `${statusIcon} **${restaurant.name}** ${availability.message}\n\n` +
          `📅 Date: ${date}\n` +
          `🕐 Time: ${time}\n` +
          `👥 Party Size: ${partySize}\n\n` +
          `Other available times: ${availability.alternativeTimes.join(', ')}`;

        return {
          content: [
            {
              type: 'text',
              text: message,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error checking availability: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            },
          ],
        };
      }
    }
  );

  // Tool to make a reservation
  server.tool(
    'make_reservation',
    'Make a restaurant reservation with customer details and special requests',
    {
      restaurantId: z.string().describe('The unique ID of the restaurant'),
      date: z.string().describe('Reservation date (e.g., "2024-08-15")'),
      time: z.string().describe('Reservation time (e.g., "7:00 PM")'),
      partySize: z
        .number()
        .min(1)
        .max(20)
        .describe('Number of people in the party'),
      customerName: z.string().describe('Customer full name'),
      customerEmail: z.string().describe('Customer email address'),
      customerPhone: z.string().describe('Customer phone number'),
      specialRequests: z
        .string()
        .optional()
        .describe('Any special requests or dietary restrictions'),
    },
    async ({
      restaurantId,
      date,
      time,
      partySize,
      customerName,
      customerEmail,
      customerPhone,
      specialRequests,
    }) => {
      try {
        const restaurant = await restaurantService.getRestaurantById(
          restaurantId
        );
        if (!restaurant) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Restaurant not found. Please check the restaurant ID.',
              },
            ],
          };
        }

        const reservation = await reservationService.makeReservation({
          restaurantId,
          date,
          time,
          partySize,
          customerName,
          customerEmail,
          customerPhone,
          specialRequests,
        });

        // Update the reservation with restaurant name
        reservation.restaurantName = restaurant.name;

        return {
          content: [
            {
              type: 'text',
              text: reservationService.formatReservationConfirmation(
                reservation,
                restaurant.phone
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error making reservation: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            },
          ],
        };
      }
    }
  );

  // Tool to view customer reservations
  server.tool(
    'view_reservations',
    'View all reservations for a customer by their email address',
    {
      customerEmail: z
        .string()
        .describe('Customer email address to look up reservations'),
    },
    async ({ customerEmail }) => {
      try {
        const reservations = await reservationService.getReservationsByEmail(
          customerEmail
        );

        if (reservations.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `📋 No reservations found for ${customerEmail}`,
              },
            ],
          };
        }

        // For each reservation, fetch the restaurant details to ensure we have the name
        for (const reservation of reservations) {
          if (!reservation.restaurantName) {
            const restaurant = await restaurantService.getRestaurantById(
              reservation.restaurantId
            );
            if (restaurant) {
              reservation.restaurantName = restaurant.name;
            } else {
              reservation.restaurantName = 'Unknown Restaurant';
            }
          }
        }

        const formattedReservations = reservations
          .map((r) => reservationService.formatReservation(r))
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `📋 **Your Reservations:**\n\n${formattedReservations}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error retrieving reservations: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            },
          ],
        };
      }
    }
  );

  // Tool to cancel a reservation
  server.tool(
    'cancel_reservation',
    'Cancel an existing reservation using the reservation ID and customer email',
    {
      reservationId: z.string().describe('The reservation confirmation ID'),
      customerEmail: z
        .string()
        .describe('Customer email address for verification'),
    },
    async ({ reservationId, customerEmail }) => {
      try {
        // First, get the reservation to check if it exists
        const existingReservation =
          await reservationService.getReservationByIdAndEmail(
            reservationId,
            customerEmail
          );

        if (!existingReservation) {
          return {
            content: [
              {
                type: 'text',
                text: "❌ Reservation not found or email doesn't match. Please check your reservation ID and email address.",
              },
            ],
          };
        }

        // If the restaurant name is missing, try to get it
        if (!existingReservation.restaurantName) {
          const restaurant = await restaurantService.getRestaurantById(
            existingReservation.restaurantId
          );
          if (restaurant) {
            existingReservation.restaurantName = restaurant.name;
          } else {
            existingReservation.restaurantName = 'Unknown Restaurant';
          }
        }

        // Now cancel the reservation
        const cancelledReservation = await reservationService.cancelReservation(
          reservationId,
          customerEmail
        );

        if (!cancelledReservation) {
          return {
            content: [
              {
                type: 'text',
                text: '❌ Error cancelling reservation. Please try again.',
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: reservationService.formatCancellationConfirmation(
                cancelledReservation
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error cancelling reservation: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            },
          ],
        };
      }
    }
  );
}