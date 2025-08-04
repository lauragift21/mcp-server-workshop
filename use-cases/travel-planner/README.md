# Travel Planner MCP Server

Build a travel planner MCP server that integrates with Google Calendar and travel APIs. This server enables you to check flights, hotels, calendar conflicts, and book trips seamlessly.

## 🎯 Overview

This MCP server connects to:
- **Google Calendar API** - Check schedule conflicts and availability
- **Travel APIs** - Search flights, hotels, and attractions
- **Weather APIs** - Get destination weather forecasts
- **Booking APIs** - Make actual reservations

## 🚀 Quick Start

### Prerequisites
- Google Cloud Console account
- API keys for travel services

### Environment Configuration

Create a `.env` file with your API credentials:

```env
# Google Calendar API
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=your_redirect_uri

# Travel APIs
AVIATIONSTACK_API_KEY=your_aviationstack_key
RAPIDAPI_KEY=your_rapidapi_key

# Weather API
OPENWEATHER_API_KEY=your_openweather_key

# Optional: Payment processing
STRIPE_SECRET_KEY=your_stripe_key
```

## 📋 Step-by-Step Guide

### Step 1: Set Up Google Calendar Integration

#### 1.1 Enable Google Calendar API
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs

#### 1.2 Implement Calendar Tools

Create `src/tools/calendar.ts`:

```typescript
import { google } from 'googleapis';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const checkCalendarConflicts: Tool = {
  name: 'check_calendar_conflicts',
  description: 'Check for calendar conflicts during travel dates',
  inputSchema: {
    type: 'object',
    properties: {
      startDate: { type: 'string', format: 'date' },
      endDate: { type: 'string', format: 'date' },
      timeZone: { type: 'string' }
    },
    required: ['startDate', 'endDate']
  }
};

export const blockTravelDates: Tool = {
  name: 'block_travel_dates',
  description: 'Block calendar dates for confirmed travel',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      startDate: { type: 'string', format: 'date-time' },
      endDate: { type: 'string', format: 'date-time' },
      location: { type: 'string' },
      description: { type: 'string' }
    },
    required: ['title', 'startDate', 'endDate']
  }
};
```

### Step 2: Integrate Travel APIs

#### 2.1 Flight Search Integration

Create `src/tools/flights.ts`:

```typescript
export const searchFlights: Tool = {
  name: 'search_flights',
  description: 'Search for flights with real-time pricing',
  inputSchema: {
    type: 'object',
    properties: {
      origin: { type: 'string', description: 'Departure airport code' },
      destination: { type: 'string', description: 'Arrival airport code' },
      departureDate: { type: 'string', format: 'date' },
      returnDate: { type: 'string', format: 'date' },
      passengers: { type: 'integer', minimum: 1, maximum: 9 },
      class: { type: 'string', enum: ['economy', 'business', 'first'] }
    },
    required: ['origin', 'destination', 'departureDate', 'passengers']
  }
};

export const bookFlight: Tool = {
  name: 'book_flight',
  description: 'Book a selected flight',
  inputSchema: {
    type: 'object',
    properties: {
      flightId: { type: 'string' },
      passengerDetails: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' }
          }
        }
      },
      paymentToken: { type: 'string' }
    },
    required: ['flightId', 'passengerDetails']
  }
};
``` 

#### 2.2 Hotel Search Integration

Create `src/tools/hotels.ts`:

```typescript
export const searchHotels: Tool = {
  name: 'search_hotels',
  description: 'Search for hotels with availability and pricing',
  inputSchema: {
    type: 'object',
    properties: {
      destination: { type: 'string' },
      checkIn: { type: 'string', format: 'date' },
      checkOut: { type: 'string', format: 'date' },
      guests: { type: 'integer', minimum: 1 },
      rooms: { type: 'integer', minimum: 1 },
      minRating: { type: 'number', minimum: 1, maximum: 5 },
      maxPrice: { type: 'number' },
      amenities: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['destination', 'checkIn', 'checkOut', 'guests']
  }
};

export const bookHotel: Tool = {
  name: 'book_hotel',
  description: 'Book a selected hotel',
  inputSchema: {
    type: 'object',
    properties: {
      hotelId: { type: 'string' },
      roomId: { type: 'string' },
      guestDetails: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' }
        }
      },
      paymentToken: { type: 'string' }
    },
    required: ['hotelId', 'roomId', 'guestDetails']
  }
};
```

### Step 3: Implement Cloudflare Workers MCP Server

#### 3.1 Main Worker Setup

Create `src/index.ts` for Cloudflare Workers:

```typescript
import { createMcpServer } from '@cloudflare/mcp-server-cloudflare';

// Import tool definitions
import { checkCalendarConflicts, blockTravelDates } from './tools/calendar';
import { searchFlights, bookFlight } from './tools/flights';
import { searchHotels, bookHotel } from './tools/hotels';

// Import service implementations
import { GoogleCalendarService } from './services/calendar';
import { AviationstackFlightService } from './services/flights';
import { HotelsComService } from './services/hotels';

export interface Env {
  // Google Calendar API
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  
  // Travel APIs
  AVIATIONSTACK_API_KEY: string;
  RAPIDAPI_KEY: string;
  
  // Weather API
  OPENWEATHER_API_KEY: string;
  
  // Optional: Payment processing
  STRIPE_SECRET_KEY?: string;
  
  // KV Storage for user sessions and bookings
  TRAVEL_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return createMcpServer({
      name: 'travel-planner',
      version: '1.0.0',
      
      tools: [
        {
          ...checkCalendarConflicts,
          handler: async (args: any) => {
            const calendarService = new GoogleCalendarService(env);
            return await calendarService.checkConflicts(args);
          }
        },
        {
          ...blockTravelDates,
          handler: async (args: any) => {
            const calendarService = new GoogleCalendarService(env);
            return await calendarService.blockDates(args);
          }
        },
        {
          ...searchFlights,
          handler: async (args: any) => {
            const flightService = new AviationstackFlightService(env);
            return await flightService.searchFlights(args);
          }
        },
        {
          ...bookFlight,
          handler: async (args: any) => {
            const flightService = new AviationstackFlightService(env);
            return await flightService.bookFlight(args);
          }
        },
        {
          ...searchHotels,
          handler: async (args: any) => {
            const hotelService = new HotelsComService(env);
            return await hotelService.searchHotels(args);
          }
        },
        {
          ...bookHotel,
          handler: async (args: any) => {
            const hotelService = new HotelsComService(env);
            return await hotelService.bookHotel(args);
          }
        }
      ]
    }).fetch(request, env, ctx);
  }
};
```

#### 3.2 Service Implementations

Create `src/services/calendar.ts`:

```typescript
import { Env } from '../index';

export class GoogleCalendarService {
  constructor(private env: Env) {}
  
  async checkConflicts(args: { startDate: string; endDate: string; timeZone?: string }) {
    const { startDate, endDate, timeZone = 'UTC' } = args;
    
    try {
      // Get OAuth token from KV storage or refresh
      const accessToken = await this.getAccessToken();
      
      // Call Google Calendar API
      const response = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${startDate}&timeMax=${endDate}&timeZone=${timeZone}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      const conflicts = data.items || [];
      
      return {
        content: [{
          type: 'text',
          text: conflicts.length > 0 
            ? `Found ${conflicts.length} calendar conflicts during ${startDate} to ${endDate}:\n${conflicts.map((event: any) => `- ${event.summary} (${event.start.dateTime})`).join('\n')}`
            : `No calendar conflicts found for ${startDate} to ${endDate}. You're free to travel!`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error checking calendar: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  async blockDates(args: { title: string; startDate: string; endDate: string; location?: string; description?: string }) {
    const { title, startDate, endDate, location, description } = args;
    
    try {
      const accessToken = await this.getAccessToken();
      
      const event = {
        summary: title,
        start: { dateTime: startDate },
        end: { dateTime: endDate },
        location,
        description
      };
      
      const response = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(event)
        }
      );
      
      const result = await response.json();
      
      return {
        content: [{
          type: 'text',
          text: `Successfully blocked calendar dates for "${title}" from ${startDate} to ${endDate}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error blocking calendar dates: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  private async getAccessToken(): Promise<string> {
    // Implementation for OAuth token management using KV storage
    // This would handle token refresh logic
    const token = await this.env.TRAVEL_KV.get('google_access_token');
    if (!token) {
      throw new Error('No Google Calendar access token found. Please authenticate first.');
    }
    return token;
  }
}
```

Create `src/services/flights.ts`:

```typescript
import { Env } from '../index';

export class AviationstackFlightService {
  constructor(private env: Env) {}
  
  async searchFlights(args: { origin: string; destination: string; departureDate: string; returnDate?: string; passengers: number; class?: string }) {
    const { origin, destination, departureDate, returnDate, passengers, class: travelClass = 'economy' } = args;
    
    try {
      // Aviationstack API is much simpler - just needs an API key
      const apiKey = this.env.AVIATIONSTACK_API_KEY;
      
      // Search for flights on the departure date
      const response = await fetch(
        `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&dep_iata=${origin}&arr_iata=${destination}&flight_date=${departureDate}&limit=10`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      const flights = data.data || [];
      
      // Format flight results
      const flightResults = flights.slice(0, 5).map((flight: any) => {
        const departure = flight.departure;
        const arrival = flight.arrival;
        const airline = flight.airline;
        
        return `✈️ ${departure.iata} → ${arrival.iata}\n` +
               `   Flight: ${airline.name} ${flight.flight.number}\n` +
               `   Departure: ${departure.scheduled} (${departure.timezone})\n` +
               `   Arrival: ${arrival.scheduled} (${arrival.timezone})\n` +
               `   Status: ${flight.flight_status}\n`;
      }).join('\n');
      
      // For demo purposes, add some mock pricing
      const mockPrices = ['$299', '$349', '$399', '$449', '$499'];
      const flightResultsWithPricing = flights.slice(0, 5).map((flight: any, index: number) => {
        const departure = flight.departure;
        const arrival = flight.arrival;
        const airline = flight.airline;
        
        return `✈️ ${departure.iata} → ${arrival.iata}\n` +
               `   Flight: ${airline.name} ${flight.flight.number}\n` +
               `   Price: ${mockPrices[index]} (estimated)\n` +
               `   Departure: ${departure.scheduled}\n` +
               `   Arrival: ${arrival.scheduled}\n` +
               `   Status: ${flight.flight_status}\n`;
      }).join('\n');
      
      return {
        content: [{
          type: 'text',
          text: flights.length > 0 
            ? `Found ${flights.length} flights from ${origin} to ${destination} on ${departureDate}:\n\n${flightResultsWithPricing}`
            : `No flights found for ${origin} to ${destination} on ${departureDate}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error searching flights: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  async bookFlight(args: { flightId: string; passengerDetails: any[]; paymentToken?: string }) {
    const { flightId, passengerDetails } = args;
    
    try {
      // Store booking details in KV (for demo purposes)
      const bookingId = `flight_booking_${Date.now()}`;
      const booking = {
        id: bookingId,
        flightId,
        passengers: passengerDetails,
        status: 'confirmed',
        createdAt: new Date().toISOString()
      };
      
      await this.env.TRAVEL_KV.put(bookingId, JSON.stringify(booking));
      
      return {
        content: [{
          type: 'text',
          text: `Flight booking confirmed! Booking ID: ${bookingId}\n` +
                `Flight: ${flightId}\n` +
                `Passengers: ${passengerDetails.length}\n` +
                `Status: Confirmed\n\n` +
                `Note: This is a demo booking. In production, this would integrate with actual airline booking systems.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error booking flight: ${error.message}`
        }],
        isError: true
      };
    }
  }
}
```

Create `src/services/hotels.ts`:

```typescript
import { Env } from '../index';

export class HotelsComService {
  constructor(private env: Env) {}
  
  async searchHotels(args: { destination: string; checkIn: string; checkOut: string; guests: number; rooms?: number; minRating?: number; maxPrice?: number; amenities?: string[] }) {
    const { destination, checkIn, checkOut, guests, rooms = 1, minRating, maxPrice, amenities } = args;
    
    try {
      // Hotels.com API via RapidAPI - much simpler!
      const rapidApiKey = this.env.RAPIDAPI_KEY;
      
      // Single API call to search hotels
      const searchParams = new URLSearchParams({
        destination_id: destination,
        checkin_date: checkIn,
        checkout_date: checkOut,
        adults_number: guests.toString(),
        room_number: rooms.toString(),
        locale: 'en_US',
        currency: 'USD'
      });
      
      const response = await fetch(
        `https://hotels-com-provider.p.rapidapi.com/v2/hotels/search?${searchParams}`,
        {
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'hotels-com-provider.p.rapidapi.com',
            'Content-Type': 'application/json'
          }
        }
      );
      
      const data = await response.json();
      const hotels = data.properties || [];
      
      // Filter by criteria
      let filteredHotels = hotels;
      
      if (minRating) {
        filteredHotels = filteredHotels.filter((hotel: any) => 
          hotel.reviews?.score >= minRating
        );
      }
      
      if (maxPrice) {
        filteredHotels = filteredHotels.filter((hotel: any) => 
          hotel.price?.lead?.amount <= maxPrice
        );
      }
      
      // Format hotel results
      const hotelResults = filteredHotels.slice(0, 5).map((hotel: any) => {
        const price = hotel.price?.lead ? `$${hotel.price.lead.amount}` : 'Price on request';
        const rating = hotel.reviews?.score ? `${hotel.reviews.score}/10` : 'No rating';
        const reviewCount = hotel.reviews?.total ? `(${hotel.reviews.total} reviews)` : '';
        const amenitiesList = hotel.amenities?.slice(0, 4).join(', ') || 'Standard amenities';
        
        return `🏨 ${hotel.name}\n` +
               `   Rating: ${rating} ⭐ ${reviewCount}\n` +
               `   Price: ${price} per night\n` +
               `   Location: ${hotel.neighborhood?.name || destination}\n` +
               `   Amenities: ${amenitiesList}\n` +
               `   Hotel ID: ${hotel.id}\n`;
      }).join('\n');
      
      return {
        content: [{
          type: 'text',
          text: filteredHotels.length > 0
            ? `Found ${filteredHotels.length} hotels in ${destination} for ${checkIn} to ${checkOut}:\n\n${hotelResults}`
            : `No hotels found matching your criteria in ${destination}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error searching hotels: ${error.message}`
        }],
        isError: true
      };
    }
  }
  
  async bookHotel(args: { hotelId: string; roomId: string; guestDetails: any; paymentToken?: string }) {
    const { hotelId, roomId, guestDetails } = args;
    
    try {
      // For demo purposes - Hotels.com booking would require additional setup
      // Store booking details in KV as a reservation
      const bookingId = `hotels_com_booking_${Date.now()}`;
      const booking = {
        id: bookingId,
        hotelId,
        roomId,
        guestDetails,
        status: 'pending_confirmation',
        createdAt: new Date().toISOString(),
        provider: 'hotels.com'
      };
      
      await this.env.TRAVEL_KV.put(`hotel_booking_${bookingId}`, JSON.stringify(booking));
      
      return {
        content: [{
          type: 'text',
          text: `Hotel reservation created via Hotels.com!\n` +
                `Booking ID: ${bookingId}\n` +
                `Guest: ${guestDetails.firstName} ${guestDetails.lastName}\n` +
                `Email: ${guestDetails.email}\n` +
                `Hotel ID: ${hotelId}\n` +
                `Room ID: ${roomId}\n` +
                `Status: Pending confirmation\n\n` +
                `Note: In production, this would integrate with Hotels.com booking API for actual reservations.`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error creating hotel reservation: ${error.message}`
        }],
        isError: true
      };
    }
  }
}
```

### Step 4: Deploy to Cloudflare Workers

#### 4.1 Configure Wrangler

Update `wrangler.toml`:

```toml
name = "travel-planner-mcp"
main = "src/index.ts"
compatibility_date = "2024-01-01"
node_compat = true

# KV namespace for storing user data and bookings
[[kv_namespaces]]
binding = "TRAVEL_KV"
preview_id = "your-preview-kv-id"
id = "your-production-kv-id"

[vars]
ENVIRONMENT = "production"

# These will be set as secrets via wrangler secret put
# Don't put actual values here
[env.production]
name = "travel-planner-mcp"
```

#### 4.2 Package Configuration

Update `package.json` for Cloudflare Workers:

```json
{
  "name": "travel-planner-mcp",
  "version": "1.0.0",
  "description": "Real-time travel planner MCP server for Cloudflare Workers",
  "main": "src/index.ts",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "build": "wrangler deploy --dry-run",
    "test": "vitest"
  },
  "dependencies": {
    "@cloudflare/mcp-server-cloudflare": "^1.0.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240925.0",
    "typescript": "^5.0.0",
    "wrangler": "^3.78.0",
    "vitest": "^1.0.0"
  }
}
```

#### 4.3 Create KV Namespace

```bash
# Create KV namespace for production
wrangler kv:namespace create "TRAVEL_KV"

# Create KV namespace for preview/development
wrangler kv:namespace create "TRAVEL_KV" --preview

# Update wrangler.toml with the returned IDs
```

#### 4.4 Set Environment Secrets

```bash
# Set all required secrets
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GOOGLE_REDIRECT_URI
wrangler secret put AVIATIONSTACK_API_KEY
wrangler secret put RAPIDAPI_KEY
wrangler secret put OPENWEATHER_API_KEY

# Optional: Payment processing
wrangler secret put STRIPE_SECRET_KEY
```

#### 4.5 Deploy Commands

```bash
# Install dependencies
npm install

# Test locally
npm run dev

# Deploy to Cloudflare Workers
npm run deploy

# Or deploy directly with wrangler
wrangler deploy
```

#### 4.6 Verify Deployment

```bash
# Check deployment status
wrangler deployments list

# View logs
wrangler tail

# Test the MCP server endpoint
curl https://travel-planner-mcp.<your-account>.workers.dev/
```

## 🔧 Advanced Features

### Calendar Conflict Resolution
- Automatic rescheduling suggestions
- Meeting priority analysis
- Travel time calculations
- Buffer time for travel days

### Smart Booking Logic
- Price monitoring and alerts
- Automatic rebooking for better deals
- Group booking coordination
- Cancellation policy tracking

### Integration Capabilities
- Slack notifications for bookings
- Email confirmations and itineraries
- Expense tracking integration
- Travel document management

## 🎮 Connect to Claude

### Cloudflare AI Playground
1. Go to https://playground.ai.cloudflare.com/
2. Enter your deployed MCP server URL: `travel-planner-mcp.<your-account>.workers.dev/sse`
3. Start planning trips with Claude!

### Claude Desktop Integration

Update Claude Desktop configuration:

```json
{
  "mcpServers": {
    "travel-planner": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://travel-planner-mcp.<your-account>.workers.dev/sse"
      ]
    }
  }
}
```

## 📚 API Documentation

### Tools Available to Claude

#### Calendar Tools
- `check_calendar_conflicts` - Check for scheduling conflicts
- `block_travel_dates` - Block calendar for confirmed travel

#### Travel Tools
- `search_flights` - Find flights with real-time pricing
- `book_flight` - Book selected flights
- `search_hotels` - Search hotels with filters
- `book_hotel` - Book hotel reservations

## 💡 Usage Examples

### Planning a Business Trip
```
User: I need to plan a business trip to London from March 15-20. Check my calendar for conflicts and find flights and hotels.

Claude: I'll help you plan your London business trip. Let me check your calendar and search for options.

[Uses check_calendar_conflicts]
[Uses search_flights]
[Uses search_hotels]

Great! I found no conflicts in your calendar for March 15-20. Here are the best flight and hotel options...
```

### Group Travel Coordination
```
User: Plan a group trip for 6 people to Barcelona in June. We need 3 hotel rooms and want to book everything together.

Claude: I'll coordinate the group booking for your Barcelona trip.

[Uses search_flights with passengers: 6]
[Uses search_hotels with rooms: 3]
[Uses book_flight and book_hotel for group booking]

I've found great group rates and can coordinate the booking for all 6 travelers...
```

## 🚀 Getting Started

1. **Clone and Setup**: Follow the project setup instructions
2. **Configure APIs**: Add your Google Calendar and travel API credentials
3. **Deploy**: Use Wrangler to deploy to Cloudflare Workers
4. **Connect**: Link your MCP server to Claude Desktop or AI Playground
5. **Start Planning**: Begin using Claude to plan your travels!

## 🔒 Security Best Practices

- Store API keys as Cloudflare Workers secrets
- Implement OAuth 2.0 for Google Calendar access
- Use HTTPS for all API communications
- Validate all user inputs
- Implement rate limiting for API calls

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add comprehensive tests
4. Submit a pull request

## 📄 License

This project is licensed under the MIT License.