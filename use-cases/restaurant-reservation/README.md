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

**Get your Yelp API Key:**

1. Visit [Yelp Fusion](https://business.yelp.com/data/products/fusion/)
2. Create a free account and app, you get 30days free trial 
3. Copy your API key and Client ID to `.dev.vars`

Add your Yelp API key and client ID to the `.dev.vars` file:

```
YELP_API_KEY=your_actual_yelp_api_key
YELP_CLIENT_ID=your_actual_yelp_client_id
```

## 📁 Implementation Code

### Step 4: Open `src/index.ts` and replace with the following:

```typescript
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from './tools';

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

  // Tool to search restaurants
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

        const formattedResults = restaurants.map(r => restaurantService.formatRestaurant(r)).join("\n");

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

  // Tool to get detailed restaurant information
  server.tool(
    'get_restaurant_details',
    'Get detailed information about a specific restaurant including contact info and description',
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
            text: restaurantService.formatRestaurantDetails(restaurant)
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ Error getting restaurant details: ${error instanceof Error ? error.message : 'Unknown error'}`
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
                       `👥 Party Size: ${partySize}\n\n` +
                       `Other available times: ${availability.alternativeTimes.join(", ")}`;

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

  // Tool to make a reservation
  server.tool(
    'make_reservation',
    'Make a restaurant reservation with customer details and special requests',
    {
      restaurantId: z.string().describe('The unique ID of the restaurant'),
      date: z.string().describe('Reservation date (e.g., "2024-08-15")'),
      time: z.string().describe('Reservation time (e.g., "7:00 PM")'),
      partySize: z.number().min(1).max(20).describe('Number of people in the party'),
      customerName: z.string().describe('Customer full name'),
      customerEmail: z.string().describe('Customer email address'),
      customerPhone: z.string().describe('Customer phone number'),
      specialRequests: z.string().optional().describe('Any special requests or dietary restrictions')
    },
    async ({ restaurantId, date, time, partySize, customerName, customerEmail, customerPhone, specialRequests }) => {
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

        const reservation = await reservationService.makeReservation({
          restaurantId,
          date,
          time,
          partySize,
          customerName,
          customerEmail,
          customerPhone,
          specialRequests
        });

        // Update the reservation with restaurant name
        reservation.restaurantName = restaurant.name;

        return {
          content: [{
            type: "text",
            text: reservationService.formatReservationConfirmation(reservation, restaurant.phone)
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

  // Tool to view customer reservations
  server.tool(
    'view_reservations',
    'View all reservations for a customer by their email address',
    {
      customerEmail: z.string().describe('Customer email address to look up reservations')
    },
    async ({ customerEmail }) => {
      try {
        const reservations = await reservationService.getReservationsByEmail(customerEmail);

        if (reservations.length === 0) {
          return {
            content: [{
              type: "text",
              text: `📋 No reservations found for ${customerEmail}`
            }]
          };
        }

        // For each reservation, fetch the restaurant details to ensure we have the name
        for (const reservation of reservations) {
          if (!reservation.restaurantName) {
            const restaurant = await restaurantService.getRestaurantById(reservation.restaurantId);
            if (restaurant) {
              reservation.restaurantName = restaurant.name;
            } else {
              reservation.restaurantName = "Unknown Restaurant";
            }
          }
        }

        const formattedReservations = reservations.map(r => 
          reservationService.formatReservation(r)
        ).join("\n\n");

        return {
          content: [{
            type: "text",
            text: `📋 **Your Reservations:**\n\n${formattedReservations}`
          }]
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `❌ Error retrieving reservations: ${error instanceof Error ? error.message : 'Unknown error'}`
          }]
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
      customerEmail: z.string().describe('Customer email address for verification')
    },
    async ({ reservationId, customerEmail }) => {
      try {
        // First, get the reservation to check if it exists
        const existingReservation = await reservationService.getReservationByIdAndEmail(reservationId, customerEmail);
        
        if (!existingReservation) {
          return {
            content: [{
              type: "text",
              text: "❌ Reservation not found or email doesn't match. Please check your reservation ID and email address."
            }]
          };
        }
        
        // If the restaurant name is missing, try to get it
        if (!existingReservation.restaurantName) {
          const restaurant = await restaurantService.getRestaurantById(existingReservation.restaurantId);
          if (restaurant) {
            existingReservation.restaurantName = restaurant.name;
          } else {
            existingReservation.restaurantName = "Unknown Restaurant";
          }
        }
        
        // Now cancel the reservation
        const cancelledReservation = await reservationService.cancelReservation(reservationId, customerEmail);

        if (!cancelledReservation) {
          return {
            content: [{
              type: "text",
              text: "❌ Error cancelling reservation. Please try again."
            }]
          };
        }

        return {
          content: [{
            type: "text",
            text: reservationService.formatCancellationConfirmation(cancelledReservation)
          }]
        };
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
// Restaurant data types
export interface Restaurant {
	id: string;
	name: string;
	cuisine: string;
	location: string;
	rating: number;
	priceLevel: number;
	phone?: string;
	website?: string;
	imageUrl?: string;
	description?: string;
}

export interface Reservation {
	id: string;
	restaurantId: string;
	restaurantName: string;
	date: string;
	time: string;
	partySize: number;
	customerName: string;
	customerEmail: string;
	customerPhone: string;
	status: "confirmed" | "pending" | "cancelled";
	specialRequests?: string;
}

// Search and filter types
export interface RestaurantSearchFilters {
	location?: string;
	cuisine?: string;
	priceLevel?: number;
	minRating?: number;
}

export interface AvailabilityRequest {
	restaurantId: string;
	date: string;
	time: string;
	partySize: number;
}

export interface ReservationRequest {
	restaurantId: string;
	date: string;
	time: string;
	partySize: number;
	customerName: string;
	customerEmail: string;
	customerPhone: string;
	specialRequests?: string;
}

// Yelp API response types
export interface YelpBusiness {
	id: string;
	alias: string;
	name: string;
	image_url: string;
	is_closed: boolean;
	url: string;
	review_count: number;
	categories: Array<{
		alias: string;
		title: string;
	}>;
	rating: number;
	coordinates: {
		latitude: number;
		longitude: number;
	};
	transactions: string[];
	price?: string;
	location: {
		address1: string;
		address2?: string;
		address3?: string;
		city: string;
		zip_code: string;
		country: string;
		state: string;
		display_address: string[];
	};
	phone: string;
	display_phone: string;
	distance?: number;
}

export interface YelpSearchResponse {
	businesses: YelpBusiness[];
	total: number;
	region: {
		center: {
			longitude: number;
			latitude: number;
		};
	};
}

export interface YelpBusinessDetails extends YelpBusiness {
	hours?: Array<{
		open: Array<{
			is_overnight: boolean;
			start: string;
			end: string;
			day: number;
		}>;
		hours_type: string;
		is_open_now: boolean;
	}>;
	photos: string[];
}
```

## 🏪 Step 10: Create Restaurant Service

Create `src/services/restaurant-service.ts`:

```typescript
import type {
  Restaurant,
  RestaurantSearchFilters,
  YelpBusiness,
  YelpSearchResponse,
  YelpBusinessDetails,
} from '../types';

/**
 * Service for restaurant discovery and management using Yelp Fusion API
 */
export class RestaurantService {
  private apiKey: string;
  private baseUrl = 'https://api.yelp.com/v3';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Make authenticated request to Yelp API
   */
  private async makeYelpRequest(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Yelp API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  /**
   * Convert Yelp business to our Restaurant interface
   */
  private convertYelpToRestaurant(yelpBusiness: YelpBusiness): Restaurant {
    // Extract primary cuisine from categories
    const primaryCuisine =
      yelpBusiness.categories.length > 0
        ? yelpBusiness.categories[0].title
        : 'Restaurant';

    // Convert Yelp price ($, $$, $$$, $$$$) to numeric level (1-4)
    const priceLevel = yelpBusiness.price ? yelpBusiness.price.length : 2;

    // Create location string from address
    const location = yelpBusiness.location.display_address.join(', ');

    return {
      id: yelpBusiness.id,
      name: yelpBusiness.name,
      cuisine: primaryCuisine,
      location: location,
      rating: yelpBusiness.rating,
      priceLevel: priceLevel,
      phone: yelpBusiness.display_phone,
      website: yelpBusiness.url,
      imageUrl: yelpBusiness.image_url,
      description: `${primaryCuisine} restaurant with ${yelpBusiness.review_count} reviews`,
    };
  }

  /**
   * Search restaurants with optional filters using Yelp API
   */
  async searchRestaurants(
    filters: RestaurantSearchFilters
  ): Promise<Restaurant[]> {
    try {
      // Build Yelp API search parameters
      const params = new URLSearchParams();

      // Default search parameters
      params.append('categories', 'restaurants');
      params.append('limit', '20');
      params.append('sort_by', 'best_match');

      // Location is required for Yelp API
      const location = filters.location || 'San Francisco, CA';
      params.append('location', location);

      // Add cuisine filter if specified
      if (filters.cuisine) {
        // Map common cuisine types to Yelp categories
        const cuisineMap: { [key: string]: string } = {
          italian: 'italian',
          japanese: 'japanese',
          french: 'french',
          indian: 'indpak',
          chinese: 'chinese',
          mexican: 'mexican',
          american: 'newamerican',
          thai: 'thai',
          mediterranean: 'mediterranean',
        };

        const yelpCategory =
          cuisineMap[filters.cuisine.toLowerCase()] ||
          filters.cuisine.toLowerCase();
        params.set('categories', yelpCategory);
      }

      // Add price filter if specified
      if (filters.priceLevel) {
        // Convert our 1-4 scale to Yelp's 1-4 scale
        const priceFilter = Array.from(
          { length: filters.priceLevel },
          (_, i) => i + 1
        ).join(',');
        params.append('price', priceFilter);
      }

      const response: YelpSearchResponse = await this.makeYelpRequest(
        `/businesses/search?${params.toString()}`
      );

      // Convert Yelp businesses to our Restaurant format
      let restaurants = response.businesses.map((business) =>
        this.convertYelpToRestaurant(business)
      );

      // Apply minimum rating filter (Yelp API doesn't support this directly)
      if (filters.minRating) {
        restaurants = restaurants.filter((r) => r.rating >= filters.minRating!);
      }

      return restaurants;
    } catch (error) {
      console.error('Error searching restaurants:', error);
      throw new Error(
        `Failed to search restaurants: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  /**
   * Get restaurant by ID using Yelp API
   */
  async getRestaurantById(restaurantId: string): Promise<Restaurant | null> {
    try {
      const response: YelpBusinessDetails = await this.makeYelpRequest(
        `/businesses/${restaurantId}`
      );
      return this.convertYelpToRestaurant(response);
    } catch (error) {
      console.error('Error getting restaurant by ID:', error);
      return null;
    }
  }

  /**
   * Get restaurants by location (default search)
   */
  async getAllRestaurants(
    location: string = 'San Francisco, CA'
  ): Promise<Restaurant[]> {
    return this.searchRestaurants({ location });
  }

  /**
   * Format restaurant for display
   */
  formatRestaurant(restaurant: Restaurant): string {
    return (
      `🍽️ ${restaurant.name}\n\n` +
      `Id: ${restaurant.id}\n` +
      `Cuisine: ${restaurant.cuisine}\n` +
      `Location: ${restaurant.location}\n` +
      `Rating: ${restaurant.rating}/5 ⭐\n` +
      `Price: $${'$'.repeat(restaurant.priceLevel)}\n` +
      `${restaurant.description || ''}`
    );
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
import type { Reservation, AvailabilityRequest, ReservationRequest } from '../types';

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

### Step 6: Connect to MCP Client

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


## 📚 Additional Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Cloudflare MCP Documentation](https://developers.cloudflare.com/agents/model-context-protocol/)
- [Yelp Fusion API Documentation](https://www.yelp.com/developers/documentation/v3) 

Congratulations! You've built a complete restaurant reservation MCP server. 
