# Restaurant Reservation MCP Server

An MCP server for restaurant discovery and reservations using Cloudflare Workers and Yelp API, designed to work with Claude and other AI assistants.

## 📋 Prerequisites

Before you begin, ensure you have:

- **Yelp API Key** (from [Yelp Fusion](https://business.yelp.com/data/products/fusion/))
- **Yelp Client ID** (from [Yelp Fusion](https://business.yelp.com/data/products/fusion/))

## 🛠️ Step-by-Step Setup

### Step 1: Navigate to the Project Directory

Navigate to the project directory:

```bash
cd use-cases/restaurant-reservation
```

### Step 2: Install Dependencies & Copy Example Variables

```bash
npm install

cp .dev.vars.example .dev.vars
```

### Step 3: Environment Variables

Add your Yelp API key and client ID to the `.dev.vars` file:

```
YELP_API_KEY=your_actual_yelp_api_key
YELP_CLIENT_ID=your_actual_yelp_client_id
```

**Get your Yelp API Key:**
1. Visit [Yelp Fusion](https://business.yelp.com/data/products/fusion/)
2. Create a free account and app, you get 30days free trial 
3. Copy your API key and Client ID to `.dev.vars`

## 📁 Implementation Code

### Step 4: Open `src/index.ts` and replace with the following:

```typescript
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from './tools/index';

export class MyMCP extends McpAgent<Env, Record<string, never>> {
  server = new McpServer({
    name: "Restaurant Reservation MCP",
    version: "1.0.0",
  });

  async init() {
    // Register all tools using the tools directory
    registerAllTools(this.server);	
  }		
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === '/sse' || url.pathname === '/sse/message') {
      return MyMCP.serveSSE('/sse').fetch(request, env, ctx);
    }

    if (url.pathname === '/mcp') {
      return MyMCP.serve('/mcp').fetch(request, env, ctx);
    }

    return new Response('Not found', { status: 404 });
  },
};
```
### Step 6: Create Tools Directory & Index

```bash
mkdir src/tools
```

Create `src/tools/index.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerRestaurantTools } from './restaurant';
import { registerReservationTools } from './reservation';

/**
 * Registers all restaurant reservation MCP tools with the server
 */
export function registerAllTools(server: McpServer) {
  registerRestaurantTools(server);
  registerReservationTools(server);
}
```

### Step 8: Create Restaurant Tools

Create `src/tools/restaurant.ts`:

```typescript
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
      location: z.string().optional().describe('Filter by location (e.g., "Downtown", "Midtown")'),
      cuisine: z.string().optional().describe('Filter by cuisine type (e.g., "Italian", "Japanese", "French")'),
      priceLevel: z.number().min(1).max(4).optional().describe('Maximum price level (1-4, where 1 is cheapest)'),
      minRating: z.number().min(1).max(5).optional().describe('Minimum rating (1-5 stars)')
    },
    async ({ location, cuisine, priceLevel, minRating }) => {
      try {
        const filters = { location, cuisine, priceLevel, minRating };
        const restaurants = await restaurantService.searchRestaurants(filters);

        if (restaurants.length === 0) {
          return {
            content: [{
              type: "text",
              text: "🔍 No restaurants found matching your criteria. Try adjusting your filters."
            }]
          };
        }

        const formattedResults = restaurants.map(r => restaurantService.formatRestaurant(r)).join("\n\n");

        return {
          content: [{
            type: "text",
            text: `Found ${restaurants.length} restaurants:\n\n${formattedResults}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ Error searching restaurants: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }
  );

  server.tool(
    'get_restaurant_details',
    'Get detailed information about a specific restaurant by ID',
    {
      restaurantId: z.string().describe('The unique ID of the restaurant')
    },
    async ({ restaurantId }) => {
      try {
        const restaurant = await restaurantService.getRestaurantById(restaurantId);
        
        if (!restaurant) {
          return {
            content: [{
              type: "text",
              text: "❌ Restaurant not found. Please check the restaurant ID."
            }]
          };
        }

        return {
          content: [{
            type: "text",
            text: restaurantService.formatRestaurant(restaurant)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ Error fetching restaurant details: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }
  );
}
```

### Step 11: Create Reservation Tools

Create `src/tools/reservation.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ReservationService } from '../services/reservation-service';
import { RestaurantService } from '../services/restaurant-service';
import { env } from 'cloudflare:workers';

export function registerReservationTools(server: McpServer) {
  const apiKey = env.YELP_API_KEY;
  if (!apiKey) {
    throw new Error('YELP_API_KEY environment variable is required');
  }
  const reservationService = new ReservationService();
  const restaurantService = new RestaurantService(apiKey);

  server.tool(
    'check_availability',
    'Check if a restaurant has availability for a specific date, time, and party size',
    {
      restaurantId: z.string().describe('The unique ID of the restaurant'),
      date: z.string().describe('Reservation date (e.g., "2024-08-15")'),
      time: z.string().describe('Preferred time (e.g., "7:00 PM")'),
      partySize: z.number().min(1).max(20).describe('Number of people in the party')
    },
    async ({ restaurantId, date, time, partySize }) => {
      try {
        const restaurant = await restaurantService.getRestaurantById(restaurantId);
        if (!restaurant) {
          return {
            content: [{
              type: "text",
              text: "❌ Restaurant not found. Please check the restaurant ID."
            }]
          };
        }

        const availability = await reservationService.checkAvailability({
          restaurantId,
          date,
          time,
          partySize
        });

        const statusIcon = availability.isAvailable ? "✅" : "❌";
        const message = `${statusIcon} **${restaurant.name}** ${availability.message}\n\n` +
                       `📅 Date: ${date}\n` +
                       `🕐 Time: ${time}\n` +
                       `👥 Party size: ${partySize}`;

        return {
          content: [{
            type: "text",
            text: message
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ Error checking availability: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }
  );

  server.tool(
    'make_reservation',
    'Make a restaurant reservation with customer details',
    {
      restaurantId: z.string().describe('The unique ID of the restaurant'),
      customerName: z.string().describe('Full name of the customer'),
      customerEmail: z.string().email().describe('Customer email address'),
      customerPhone: z.string().describe('Customer phone number'),
      date: z.string().describe('Reservation date (e.g., "2024-08-15")'),
      time: z.string().describe('Reservation time (e.g., "7:00 PM")'),
      partySize: z.number().min(1).max(20).describe('Number of people in the party'),
      specialRequests: z.string().optional().describe('Any special requests or dietary restrictions')
    },
    async ({ restaurantId, customerName, customerEmail, customerPhone, date, time, partySize, specialRequests }) => {
      try {
        const restaurant = await restaurantService.getRestaurantById(restaurantId);
        if (!restaurant) {
          return {
            content: [{
              type: "text",
              text: "❌ Restaurant not found. Please check the restaurant ID."
            }]
          };
        }

        const availability = await reservationService.checkAvailability({
          restaurantId,
          date,
          time,
          partySize
        });

        if (!availability.isAvailable) {
          return {
            content: [{
              type: "text",
              text: `❌ **${restaurant.name}** ${availability.message}`
            }]
          };
        }

        const reservation = await reservationService.makeReservation({
          restaurantId,
          customerName,
          customerEmail,
          customerPhone,
          date,
          time,
          partySize,
          specialRequests
        });

        const confirmationMessage = `🎉 **Reservation Confirmed!**\n\n` +
                                   `${reservationService.formatReservation(reservation)}\n\n` +
                                   `📍 **${restaurant.name}**\n` +
                                   `${restaurant.address}\n` +
                                   `${restaurant.phone ? `📞 ${restaurant.phone}` : ''}\n\n` +
                                   `💡 Please arrive 15 minutes early and bring a valid ID.`;

        return {
          content: [{
            type: "text",
            text: confirmationMessage
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ Error making reservation: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }
  );

  // Tool to cancel a reservation
  server.tool(
    'cancel_reservation',
    'Cancel an existing restaurant reservation',
    {
      reservationId: z.string().describe('The unique ID of the reservation to cancel')
    },
    async ({ reservationId }) => {
      try {
        const reservation = await reservationService.getReservation(reservationId);
        if (!reservation) {
          return {
            content: [{
              type: "text",
              text: "❌ Reservation not found. Please check the reservation ID."
            }]
          };
        }

        if (reservation.status === 'cancelled') {
          return {
            content: [{
              type: "text",
              text: "ℹ️ This reservation has already been cancelled."
            }]
          };
        }

        const success = await reservationService.cancelReservation(reservationId);
        
        if (success) {
          return {
            content: [{
              type: "text",
              text: `✅ **Reservation Cancelled Successfully**\n\n${reservationService.formatReservation(reservation)}\n\n💡 You will receive a cancellation confirmation email shortly.`
            }]
          };
        } else {
          return {
            content: [{
              type: "text",
              text: "❌ Failed to cancel reservation. Please try again or contact support."
            }]
          };
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ Error cancelling reservation: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
        };
      }
    }
  );
}
```

### Step 7: Create Type Definitions

Create `src/types/index.ts`:

```typescript
export interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  location: string;
  priceLevel: number;
  rating: number;
  phone?: string;
  address?: string;
  imageUrl?: string;
  reviewCount?: number;
}

export interface SearchFilters {
  location?: string;
  cuisine?: string;
  priceLevel?: number;
  minRating?: number;
}

export interface Reservation {
  id: string;
  restaurantId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  date: string;
  time: string;
  partySize: number;
  specialRequests?: string;
  status: 'confirmed' | 'cancelled' | 'pending';
  createdAt: string;
}

export interface AvailabilityRequest {
  restaurantId: string;
  date: string;
  time: string;
  partySize: number;
}

export interface AvailabilityResponse {
  isAvailable: boolean;
  message: string;
  alternativeTimes?: string[];
}
```

## 🏪 Step 10: Create Restaurant Service

Create `src/services/restaurant-service.ts`:

```typescript
import { Restaurant, SearchFilters } from '../types';

export class RestaurantService {
  private apiKey: string;
  private baseUrl = 'https://api.yelp.com/v3';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchRestaurants(filters: SearchFilters): Promise<Restaurant[]> {
    try {
      const params = new URLSearchParams({
        categories: 'restaurants',
        limit: '20',
        sort_by: 'rating'
      });

      if (filters.location) params.append('location', filters.location);
      if (filters.cuisine) params.append('categories', `restaurants,${filters.cuisine.toLowerCase()}`);
      if (filters.priceLevel) params.append('price', '1,2,3,4'.split(',').slice(0, filters.priceLevel).join(','));

      const response = await fetch(`${this.baseUrl}/businesses/search?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Yelp API error: ${response.status}`);
      }

      const data = await response.json();
      const restaurants = data.businesses?.map((business: any) => ({
        id: business.id,
        name: business.name,
        cuisine: business.categories?.[0]?.title || 'Restaurant',
        location: business.location?.display_address?.join(', ') || 'Unknown',
        priceLevel: business.price?.length || 2,
        rating: business.rating || 0,
        phone: business.phone,
        address: business.location?.display_address?.join(', '),
        imageUrl: business.image_url,
        reviewCount: business.review_count
      })) || [];

      // Apply rating filter
      return filters.minRating 
        ? restaurants.filter((r: Restaurant) => r.rating >= filters.minRating!)
        : restaurants;

    } catch (error) {
      console.error('Error searching restaurants:', error);
      throw new Error(
        `Failed to search restaurants: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async getRestaurantById(id: string): Promise<Restaurant | null> {
    try {
      const response = await fetch(`${this.baseUrl}/businesses/${id}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return null;
      }

      const business = await response.json();
      return {
        id: business.id,
        name: business.name,
        cuisine: business.categories?.[0]?.title || 'Restaurant',
        location: business.location?.display_address?.join(', ') || 'Unknown',
        priceLevel: business.price?.length || 2,
        rating: business.rating || 0,
        phone: business.phone,
        address: business.location?.display_address?.join(', '),
        imageUrl: business.image_url,
        reviewCount: business.review_count
      };

    } catch (error) {
      console.error('Error fetching restaurant details:', error);
      return null;
    }
  }

  formatRestaurant(restaurant: Restaurant): string {
    const priceSymbols = '$'.repeat(restaurant.priceLevel);
    const stars = '⭐'.repeat(Math.floor(restaurant.rating));
    
    return `🍽️ **${restaurant.name}**
📍 ${restaurant.location}
🍴 ${restaurant.cuisine} | ${priceSymbols} | ${stars} (${restaurant.rating}/5)
${restaurant.phone ? `📞 ${restaurant.phone}` : ''}
${restaurant.reviewCount ? `👥 ${restaurant.reviewCount} reviews` : ''}
🆔 ID: ${restaurant.id}`;
  }

  /**
   * Format restaurant details for detailed view
   */
  formatRestaurantDetails(restaurant: Restaurant): string {
    return (
      `🍽️ ${restaurant.name}\n\n` +
      `🍴 Cuisine: ${restaurant.cuisine}\n` +
      `📍 Location: ${restaurant.location}\n` +
      `⭐ Rating: ${restaurant.rating}/5\n` +
      `💰 Price Level: ${'$'.repeat(restaurant.priceLevel)}\n` +
      `📞 Phone: ${restaurant.phone || 'Not available'}\n` +
      `🌐 Website: ${restaurant.website || 'Not available'}\n\n` +
      `📝 Description: ${restaurant.description || 'No description available'}`
    );
  }
}
```

## 📅 Step 11: Create Reservation Service

Create `src/services/reservation-service.ts`:

```typescript
import { Reservation, AvailabilityRequest, ReservationRequest } from '../types';

/**
 * Service for managing restaurant reservations
 * In production, this would integrate with restaurant booking systems
 */
export class ReservationService {
  private static instance: ReservationService;
  private mockReservations: Reservation[] = [];
  
  /**
   * Private constructor to prevent direct instantiation
   */
  private constructor() {}
  
  /**
   * Get the singleton instance of ReservationService
   */
  public static getInstance(): ReservationService {
    if (!ReservationService.instance) {
      ReservationService.instance = new ReservationService();
    }
    return ReservationService.instance;
  }

  /**
   * Check availability for a restaurant at specific date/time
   */
  async checkAvailability(request: AvailabilityRequest): Promise<{
    isAvailable: boolean;
    alternativeTimes: string[];
    message: string;
  }> {
    // Mock availability logic - 70% chance of availability
    const isAvailable = Math.random() > 0.3;
    const alternativeTimes = ["6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM", "8:00 PM"];

    if (isAvailable) {
      return {
        isAvailable: true,
        alternativeTimes,
        message: `✅ Available at ${request.time} for ${request.partySize} people`
      };
    } else {
      return {
        isAvailable: false,
        alternativeTimes,
        message: `❌ Not available at ${request.time}. Alternative times available: ${alternativeTimes.join(", ")}`
      };
    }
  }

  /**
   * Make a new reservation
   */
  async makeReservation(request: ReservationRequest): Promise<Reservation> {
    const reservationId = `res_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const reservation: Reservation = {
      id: reservationId,
      restaurantId: request.restaurantId,
      restaurantName: "", // Will be filled by the tool handler
      date: request.date,
      time: request.time,
      partySize: request.partySize,
      customerName: request.customerName,
      customerEmail: request.customerEmail,
      customerPhone: request.customerPhone,
      status: "confirmed",
      specialRequests: request.specialRequests,
    };

    this.mockReservations.push(reservation);
    return reservation;
  }

  /**
   * Get reservations by customer email
   */
  async getReservationsByEmail(customerEmail: string): Promise<Reservation[]> {
    return this.mockReservations.filter(r => 
      r.customerEmail.toLowerCase() === customerEmail.toLowerCase()
    );
  }

  /**
   * Get reservation by ID and email (for security)
   */
  async getReservationByIdAndEmail(reservationId: string, customerEmail: string): Promise<Reservation | null> {
    return this.mockReservations.find(r => 
      r.id === reservationId && 
      r.customerEmail.toLowerCase() === customerEmail.toLowerCase()
    ) || null;
  }

  /**
   * Cancel a reservation
   */
  async cancelReservation(reservationId: string, customerEmail: string): Promise<Reservation | null> {
    const reservationIndex = this.mockReservations.findIndex(r => 
      r.id === reservationId && 
      r.customerEmail.toLowerCase() === customerEmail.toLowerCase()
    );

    if (reservationIndex === -1) {
      return null;
    }

    const reservation = this.mockReservations[reservationIndex];
    reservation.status = "cancelled";
    
    return reservation;
  }

  /**
   * Format reservation for display
   */
  formatReservation(reservation: Reservation): string {
    return `🍽️ **${reservation.restaurantName}**\n` +
           `   📋 ID: ${reservation.id}\n` +
           `   📅 Date: ${reservation.date}\n` +
           `   🕐 Time: ${reservation.time}\n` +
           `   👥 Party Size: ${reservation.partySize}\n` +
           `   ✅ Status: ${reservation.status}\n` +
           `   ${reservation.specialRequests ? `📝 Special Requests: ${reservation.specialRequests}\n` : ""}`;
  }

  /**
   * Format reservation confirmation
   */
  formatReservationConfirmation(reservation: Reservation, restaurantPhone?: string): string {
    return `🎉 **Reservation Confirmed!**\n\n` +
           `📋 **IMPORTANT - YOUR RESERVATION ID: ${reservation.id}**\n\n` +
           `🍽️ Restaurant: ${reservation.restaurantName}\n` +
           `📅 Date: ${reservation.date}\n` +
           `🕐 Time: ${reservation.time}\n` +
           `👥 Party Size: ${reservation.partySize}\n` +
           `👤 Name: ${reservation.customerName}\n` +
           `📧 Email: ${reservation.customerEmail}\n` +
           `📞 Phone: ${reservation.customerPhone}\n` +
           `${reservation.specialRequests ? `📝 Special Requests: ${reservation.specialRequests}\n` : ""}` +
           `\n✅ Status: ${reservation.status}\n\n` +
           `Please arrive 15 minutes early. ${restaurantPhone ? `Call ${restaurantPhone} if you need to make changes.` : ""}\n\n` +
           `To view or cancel your reservation, use your reservation ID and email address.`;
  }

  /**
   * Format cancellation confirmation
   */
  formatCancellationConfirmation(reservation: Reservation): string {
    return `✅ **Reservation Cancelled**\n\n` +
           `📋 Confirmation #: ${reservation.id}\n` +
           `🍽️ Restaurant: ${reservation.restaurantName}\n` +
           `📅 Date: ${reservation.date}\n` +
           `🕐 Time: ${reservation.time}\n\n` +
           `Your reservation has been successfully cancelled.`;
  }
}
```


## 🚀 Deployment

### Step 5: Deploy to Cloudflare Workers

```bash
# Deploy the worker
npm run deploy

# Your MCP server will be deployed to: `https://restaurant-reservation-mcp.<your-account>.workers.dev`

# Set environment variables
wrangler secret bulk .dev.vars
```

### Step 6: Connect to MCP Clients

#### Connect to Cloudflare AI Playground

1. Go to https://playground.ai.cloudflare.com/
2. Enter your deployed URL: `https://restaurant-reservation-mcp.<your-account>.workers.dev/sse`
3. Start using the restaurant tools!

#### Connect to Claude Desktop

1. Open Claude Desktop settings
2. Go to **Settings > Developer > Edit Config**
3. Add this configuration:

```json
{
  "mcpServers": {
    "restaurant-reservation": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://restaurant-reservation-mcp.<your-account>.workers.dev/sse"
      ]
    }
  }
}
```

4. Restart Claude Desktop

## 🎯 Available Tools

Your MCP server provides these tools to the AI assistants:

- **`search_restaurants`**: Find restaurants by location, cuisine, price, rating
- **`get_restaurant_details`**: Get detailed info about a specific restaurant
- **`check_availability`**: Check if a restaurant has availability
- **`make_reservation`**: Book a restaurant reservation
- **`cancel_reservation`**: Cancel an existing reservation

## 💬 Example Usage

Try these commands with Claude:

- "Find Italian restaurants in downtown with at least 4 stars"
- "Check availability at restaurant Michiu Amsterdam for 4 people on December 25th at 7 PM"
- "Make a reservation at restaurant Michiu Amsterdam for John Doe on Friday at 8 PM for 2 people"
- "Cancel reservation for restaurant Michiu Amsterdam for John Doe on Friday at 8 PM"


## 🔔 Troubleshooting

### Common Issues

1. **"YELP_API_KEY environment variable is required"**
   - Ensure you've set the API key: `wrangler secret put YELP_API_KEY`

2. **"Restaurant not found"**
   - Use restaurant IDs from search results

3. **"Reservation not found or email doesn't match"**
   - Make sure you're using the exact reservation ID provided when booking
   - Use the same email address used during reservation creation
   - Note that reservations are stored in memory and will be lost if the server restarts

4. **Can't view or cancel reservations**
   - The ReservationService uses a singleton pattern to persist reservations in memory
   - If you're testing locally and restarting the server often, reservations will be lost
   - In production, you would use a database to store reservations permanently

5. **Claude Desktop not connecting**
   - Verify your URL includes `/sse` endpoint

6. **Build errors**
   - Run `npm run type-check` to verify TypeScript
   - Ensure all dependencies are installed: `npm install`

## 🎉 Next Steps

Congratulations! You've built a complete restaurant reservation MCP server. 

## 📚 Additional Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Cloudflare MCP Documentation](https://developers.cloudflare.com/agents/model-context-protocol/)
- [Yelp Fusion API Documentation](https://www.yelp.com/developers/documentation/v3) 
