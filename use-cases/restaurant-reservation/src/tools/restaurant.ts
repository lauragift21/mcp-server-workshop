import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RestaurantService } from '../services/restaurant-service';
import { env } from 'cloudflare:workers';

export function registerRestaurantTools(server: McpServer) {
  const apiKey = env.YELP_API_KEY;
  if (!apiKey) {
    throw new Error('YELP_API_KEY environment variable is required');
  }
  const restaurantService = new RestaurantService(apiKey);

  server.tool(
    'search_restaurants',
    'Search for restaurants with optional filters for location, cuisine, price level, and rating',
    {
      location: z
        .string()
        .optional()
        .describe('Filter by location (e.g., "Downtown", "Midtown")'),
      cuisine: z
        .string()
        .optional()
        .describe(
          'Filter by cuisine type (e.g., "Italian", "Japanese", "French")'
        ),
      priceLevel: z
        .number()
        .min(1)
        .max(4)
        .optional()
        .describe('Maximum price level (1-4, where 1 is cheapest)'),
      minRating: z
        .number()
        .min(1)
        .max(5)
        .optional()
        .describe('Minimum rating (1-5 stars)'),
    },
    async ({ location, cuisine, priceLevel, minRating }) => {
      try {
        const filters = { location, cuisine, priceLevel, minRating };
        const restaurants = await restaurantService.searchRestaurants(filters);

        if (restaurants.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: '🔍 No restaurants found matching your criteria. Try adjusting your filters.',
              },
            ],
          };
        }

        const formattedResults = restaurants
          .map((r) => restaurantService.formatRestaurant(r))
          .join('\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `Found ${restaurants.length} restaurants:\n\n${formattedResults}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error searching restaurants: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    'get_restaurant_details',
    'Get detailed information about a specific restaurant by ID',
    {
      restaurantId: z.string().describe('The unique ID of the restaurant'),
    },
    async ({ restaurantId }) => {
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

        return {
          content: [
            {
              type: 'text',
              text: restaurantService.formatRestaurant(restaurant),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error fetching restaurant details: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            },
          ],
        };
      }
    }
  );
}
