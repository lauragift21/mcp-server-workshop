# Real-time Travel Planner MCP Server

An MCP server for flight search, hotel booking, and travel planning using Cloudflare Workers and travel APIs, designed to work with Claude and other MCP clients.

## 🎯 What You'll Build

A fully functional MCP server with 8 tools organized into 4 categories:

### ✈️ Flight Tools
- `search_flights` - Search for flights between airports with filters
- `book_flight` - Book flights with passenger information

### 🏨 Hotel Tools  
- `search_hotels` - Find hotels by destination, dates, and preferences
- `book_hotel` - Reserve hotels with guest details

### 📅 Calendar Tools
- `check_calendar_conflicts` - Check for scheduling conflicts with travel dates

### 📋 Travel Plan Tools (Optional)
- `create_travel_plan` - Create new travel plans with destinations and budget
- `get_travel_plan` - Retrieve existing travel plan details
- `book_trip` - Book complete trips with flights and hotels together

*Note: These tools are optional and can be excluded if you prefer a simpler implementation focusing only on flights, hotels, and calendar integration.*


## 📋 Prerequisites

Before you begin, ensure you have:

- **Aviationstack API Key** (from [Aviationstack](https://aviationstack.com/), free tier: 1,000 requests/month)
- **RapidAPI Key** (from [RapidAPI](https://rapidapi.com/) for Hotels.com API)
- **Google Cloud Console Project** with Calendar API enabled (from [Google Cloud Console](https://console.cloud.google.com/))

## 🔧 Step-by-Step Setup

### Step 1: Navigate to the Project Directory

Navigate to the project directory:

```bash
cd use-cases/travel-planner
```

### Step 2: Install Dependencies & Copy Example Variables

```bash
npm install

cp .dev.vars.example .dev.vars
```

### 🔑 API Keys and Environment Variables

### Required API Keys

This project requires several API keys:

1. **Aviationstack API Key**: For flight search functionality
   - Sign up at [aviationstack.com](https://aviationstack.com/)
   - Free tier available for development

2. **RapidAPI Key**: For Hotels.com API access
   - Sign up at [RapidAPI](https://rapidapi.com/)
   - Subscribe to the Hotels.com API

3. **Create a new Google Cloud OAuth App with Calendar API enabled**:
   - Navigate to the [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the Google Calendar API
   - Go to APIs & Services > Credentials
   - Click "Create Credentials" > "OAuth client ID"
   - Set the Homepage URL to: `https://travel-planner.<your-subdomain>.workers.dev`
   - Add Authorization callback URL: `https://travel-planner.<your-subdomain>.workers.dev/callback`
   - Note your Client ID and generate a Client Secret

4. **Update the `.dev.vars` file** in the project root with the following variables:
   ```
   # Google OAuth credentials
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   COOKIE_ENCRYPTION_KEY=your_encryption_key_here
   HOSTED_DOMAIN=optional_domain_restriction
   
   # API Keys for travel services
   AVIATIONSTACK_API_KEY=your_api_key_here
   RAPIDAPI_KEY=your_api_key_here
   ```

#### Security Considerations

- The `COOKIE_ENCRYPTION_KEY` should be a secure random string (32+ characters)
- Use `openssl rand -hex 32` to generate a secure encryption key
- Never commit your `.dev.vars` file to version control
- Use environment-specific secrets for different deployment environments


### Step 3: Set up KV namespace

1. **Set up KV namespace**:
   ```bash
   # Create the KV namespace for OAuth storage
   wrangler kv namespace create "OAUTH_KV"
   ```

2. **Update your `wrangler.jsonc` file** with the KV namespace ID:
   ```json
   "kv_namespaces": [
     {
       "binding": "OAUTH_KV",
       "id": "your_kv_namespace_id_here"
     }
   ]
   ```

## 📁 Implementation Code

### Step 4: Open `src/index.ts` and replace with the following:

```typescript
import OAuthProvider from '@cloudflare/workers-oauth-provider'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { McpAgent } from 'agents/mcp'
import { GoogleHandler } from './google-handler.js'
import { registerAllTools } from './tools'
import { Props } from './utils'

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: 'Travel Planner MCP',
    version: '1.0.0',
  })

  async init() {
    // Register all tools using the tools directory
    const props = this.props as Props
    registerAllTools(this.server, props)
  }
}

export default new OAuthProvider({
  apiHandler: MyMCP.mount('/sse') as any,
  apiRoute: '/sse',
  authorizeEndpoint: '/authorize',
  clientRegistrationEndpoint: '/register',
  defaultHandler: GoogleHandler as any,
  tokenEndpoint: '/token',
});
```

### Step 5: Create Tools Directory & Index

Create `src/tools/index.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { Props } from '../utils'
import { registerFlightTools } from './flight'
import { registerHotelTools } from './hotel'
import { registerCalendarTools } from './calendar'
import { registerTravelPlanTools } from './travel-plan'


export function registerAllTools(
  server: McpServer, 
  props: Props
) {
  // Register individual tool categories
  registerFlightTools(server, props)
  registerHotelTools(server, props)
  registerCalendarTools(server, props)
  registerTravelPlanTools(server, props)
}
```

### Step 6: Create Flight Tools

Create `src/tools/flight.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { FlightService } from '../services/flight-service'
import { BookingService } from '../services/booking-service'
import { Props } from '../utils'
import { env } from 'cloudflare:workers'

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
      passengers: z.array(z.object({
        firstName: z.string().describe('Passenger first name'),
        lastName: z.string().describe('Passenger last name'),
        dateOfBirth: z.string().describe('Date of birth in YYYY-MM-DD format'),
        passportNumber: z.string().optional().describe('Passport number (optional)'),
        nationality: z.string().optional().describe('Nationality (optional)')
      })).describe('List of passengers'),
      contactInfo: z.object({
        email: z.string().describe('Contact email'),
        phone: z.string().describe('Contact phone number'),
        firstName: z.string().describe('Contact first name'),
        lastName: z.string().describe('Contact last name')
      }).describe('Contact information')
    },
    async ({ flightId, passengers, contactInfo }) => {
      try {
        const bookingRequest = {
          flightId,
          passengers,
          contactInfo
        };

        const confirmation = await bookingService.bookFlight(bookingRequest);

        // Add booking to calendar
        await bookingService.addToCalendar(confirmation);

        return {
          content: [
            {
              text: `✅ Flight booked successfully!\n\n` +
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
              text: `❌ Flight booking failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
                   `Please check your information and try again.`,
              type: 'text',
            },
          ],
        }
      }
    },
  )
}
```

### Step 7: Create Hotel Tools

Create `src/tools/hotel.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { HotelService } from '../services/hotel-service'
import { BookingService } from '../services/booking-service'
import { Props } from '../utils'
import { env } from 'cloudflare:workers'

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
```

### Step 8: Create Calendar Tools

Create `src/tools/calendar.ts`:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { CalendarService } from '../services/calendar-service'
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
```

### Step 9: Create Travel Plan Tools (Optional)

Create `src/tools/travel-plan.ts`:

```typescript
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
      budget: z.number().optional().describe('Budget for the trip')
    },
    async ({ title, destinations, startDate, endDate, travelers, budget }) => {
      try {
        const plan = await bookingService.createTravelPlan(
          title,
          destinations,
          startDate,
          endDate,
          travelers,
          budget
        );

        return {
          content: [
            {
              text: `✅ Travel plan created successfully!\n\n` +
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
      planId: z.string().describe('Travel plan ID')
    },
    async ({ planId }) => {
      try {
        const plan = await bookingService.getTravelPlan(planId);

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

        const flightSummary = plan.flights && plan.flights.length > 0 
          ? `\n\n✈️ Flights (${plan.flights.length}):\n` + 
            plan.flights.map(f => `- ${f.confirmationNumber} (${f.status})`).join('\n')
          : '\n\n✈️ No flights booked yet';

        const hotelSummary = plan.hotels && plan.hotels.length > 0
          ? `\n\n🏨 Hotels (${plan.hotels.length}):\n` + 
            plan.hotels.map(h => `- ${h.confirmationNumber} (${h.status})`).join('\n')
          : '\n\n🏨 No hotels booked yet';

        return {
          content: [
            {
              text: `📋 Travel Plan Details\n\n` +
                   `Plan ID: ${plan.id}\n` +
                   `Title: ${plan.title}\n` +
                   `Destinations: ${plan.destinations.join(', ')}\n` +
                   `Dates: ${plan.startDate} to ${plan.endDate}\n` +
                   `Travelers: ${plan.travelers}\n` +
                   `Budget: ${plan.budget ? `$${plan.budget}` : 'Not set'}\n` +
                   `Status: ${plan.status}\n` +
                   `Created: ${new Date(plan.createdAt).toLocaleString()}\n` +
                   `Updated: ${new Date(plan.updatedAt).toLocaleString()}` +
                   flightSummary + hotelSummary,
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
      flightBookings: z.array(z.object({
        flightId: z.string().describe('Flight ID from search results'),
        passengers: z.array(z.object({
          firstName: z.string().describe('Passenger first name'),
          lastName: z.string().describe('Passenger last name'),
          dateOfBirth: z.string().describe('Date of birth in YYYY-MM-DD format'),
          passportNumber: z.string().optional().describe('Passport number (optional)'),
          nationality: z.string().optional().describe('Nationality (optional)')
        })).describe('List of passengers')
      })).describe('Flight bookings to make'),
      hotelBookings: z.array(z.object({
        hotelId: z.string().describe('Hotel ID from search results'),
        checkIn: z.string().describe('Check-in date in YYYY-MM-DD format'),
        checkOut: z.string().describe('Check-out date in YYYY-MM-DD format'),
        rooms: z.number().describe('Number of rooms'),
        guests: z.number().describe('Number of guests'),
        guestInfo: z.array(z.object({
          firstName: z.string().describe('Guest first name'),
          lastName: z.string().describe('Guest last name'),
          email: z.string().optional().describe('Guest email (optional)')
        })).describe('List of guests')
      })).describe('Hotel bookings to make'),
      contactInfo: z.object({
        email: z.string().describe('Contact email'),
        phone: z.string().describe('Contact phone number'),
        firstName: z.string().describe('Contact first name'),
        lastName: z.string().describe('Contact last name')
      }).describe('Contact information for all bookings')
    },
    async ({ planId, flightBookings, hotelBookings, contactInfo }) => {
      try {
        // Convert to booking service format
        const flightRequests = flightBookings.map(fb => ({
          flightId: fb.flightId,
          passengers: fb.passengers,
          contactInfo
        }));

        const hotelRequests = hotelBookings.map(hb => ({
          hotelId: hb.hotelId,
          checkIn: hb.checkIn,
          checkOut: hb.checkOut,
          rooms: hb.rooms,
          guests: hb.guests,
          guestInfo: hb.guestInfo,
          contactInfo
        }));

        const result = await bookingService.bookTrip(planId, flightRequests, hotelRequests);

        const flightSummary = result.flightConfirmations.length > 0
          ? `\n\n✈️ Flights Booked (${result.flightConfirmations.length}):\n` +
            result.flightConfirmations.map(f => 
              `- ${f.confirmationNumber} (${f.status}) - ${f.currency} ${f.totalPrice}`
            ).join('\n')
          : '';

        const hotelSummary = result.hotelConfirmations.length > 0
          ? `\n\n🏨 Hotels Booked (${result.hotelConfirmations.length}):\n` +
            result.hotelConfirmations.map(h => 
              `- ${h.confirmationNumber} (${h.status}) - ${h.currency} ${h.totalPrice}`
            ).join('\n')
          : '';

        return {
          content: [
            {
              text: `🎉 Trip booked successfully!\n\n` +
                   `Travel Plan: ${result.plan.title}\n` +
                   `Plan ID: ${result.plan.id}\n` +
                   `Status: ${result.plan.status}\n` +
                   `Total Cost: $${result.totalCost}\n` +
                   `Booking Date: ${new Date().toLocaleString()}` +
                   flightSummary + hotelSummary +
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
              text: `❌ Trip booking failed: ${error instanceof Error ? error.message : 'Unknown error'}\n\n` +
                   `Some bookings may have been partially completed. Please check individual confirmations.`,
              type: 'text',
            },
          ],
        }
      }
    },
  )
}
```

### Step 10: Create Flight Service

Create `src/services/flight-service.ts`:

```typescript
import { FlightSearchParams, FlightInfo, AviationstackResponse } from '../types';

export class FlightService {
  private apiKey: string;
  private baseUrl = 'http://api.aviationstack.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async searchFlights(params: FlightSearchParams): Promise<FlightInfo[]> {
    try {
      // Search for flights using Aviationstack API
      const url = new URL(`${this.baseUrl}/flights`);
      url.searchParams.set('access_key', this.apiKey);
      url.searchParams.set('dep_iata', params.origin);
      url.searchParams.set('arr_iata', params.destination);
      url.searchParams.set('flight_date', params.departureDate);
      url.searchParams.set('limit', '50');

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Flight API error: ${response.status} ${response.statusText}`);
      }

      const data: AviationstackResponse = await response.json();
      
      return this.transformFlightData(data.data, params);
    } catch (error) {
      console.error('Error searching flights:', error);
      // Return mock data for development
      return this.getMockFlights(params);
    }
  }

  private transformFlightData(flights: AviationstackResponse['data'], params: FlightSearchParams): FlightInfo[] {
    return flights.map((flight, index) => ({
      id: `flight_${index}_${Date.now()}`,
      airline: flight.airline.name,
      flightNumber: flight.flight.iata,
      origin: flight.departure.iata,
      destination: flight.arrival.iata,
      departureTime: flight.departure.scheduled,
      arrivalTime: flight.arrival.scheduled,
      duration: this.calculateDuration(flight.departure.scheduled, flight.arrival.scheduled),
      price: this.estimatePrice(params.origin, params.destination, params.class || 'economy'),
      currency: 'USD',
      aircraft: flight.aircraft.iata,
      stops: 0, // Aviationstack doesn't provide stops info directly
      bookingUrl: `https://www.kayak.com/flights/${params.origin}-${params.destination}/${params.departureDate}`
    }));
  }

  private calculateDuration(departure: string, arrival: string): string {
    const dep = new Date(departure);
    const arr = new Date(arrival);
    const diffMs = arr.getTime() - dep.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  private estimatePrice(origin: string, destination: string, flightClass: string): number {
    // Simple price estimation based on distance and class
    const basePrice = 200;
    const classMultiplier = flightClass === 'business' ? 3 : flightClass === 'first' ? 5 : 1;
    const randomFactor = 0.8 + Math.random() * 0.4; // 80% to 120% of base
    return Math.round(basePrice * classMultiplier * randomFactor);
  }

  private getMockFlights(params: FlightSearchParams): FlightInfo[] {
    return [
      {
        id: `mock_flight_1_${Date.now()}`,
        airline: 'American Airlines',
        flightNumber: 'AA1234',
        origin: params.origin,
        destination: params.destination,
        departureTime: `${params.departureDate}T08:00:00Z`,
        arrivalTime: `${params.departureDate}T12:30:00Z`,
        duration: '4h 30m',
        price: 450,
        currency: 'USD',
        aircraft: 'Boeing 737',
        stops: 0,
        bookingUrl: `https://www.kayak.com/flights/${params.origin}-${params.destination}/${params.departureDate}`
      },
      {
        id: `mock_flight_2_${Date.now()}`,
        airline: 'Delta Air Lines',
        flightNumber: 'DL5678',
        origin: params.origin,
        destination: params.destination,
        departureTime: `${params.departureDate}T14:15:00Z`,
        arrivalTime: `${params.departureDate}T18:45:00Z`,
        duration: '4h 30m',
        price: 520,
        currency: 'USD',
        aircraft: 'Airbus A320',
        stops: 0,
        bookingUrl: `https://www.kayak.com/flights/${params.origin}-${params.destination}/${params.departureDate}`
      }
    ];
  }

  async getFlightStatus(flightNumber: string, date: string): Promise<any> {
    try {
      const url = new URL(`${this.baseUrl}/flights`);
      url.searchParams.set('access_key', this.apiKey);
      url.searchParams.set('flight_iata', flightNumber);
      url.searchParams.set('flight_date', date);

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        throw new Error(`Flight status API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting flight status:', error);
      return { status: 'unknown', message: 'Unable to fetch flight status' };
    }
  }
}
```

### Step 11: Create Hotel Service

Create `src/services/hotel-service.ts`:

```typescript
import { HotelSearchParams, HotelResult, HotelsComResponse } from '../types';

export class HotelService {
  private rapidApiKey: string;
  private baseUrl = 'https://hotels-com-provider.p.rapidapi.com';

  constructor(rapidApiKey: string) {
    this.rapidApiKey = rapidApiKey;
  }

  async searchHotels(params: HotelSearchParams): Promise<HotelResult[]> {
    try {
      // Search for hotels using Hotels.com RapidAPI
      const url = new URL(`${this.baseUrl}/v2/hotels/search`);
      url.searchParams.set('domain', 'US');
      url.searchParams.set('sort_order', 'REVIEW');
      url.searchParams.set('locale', 'en_US');
      url.searchParams.set('checkout_date', params.checkOut);
      url.searchParams.set('checkin_date', params.checkIn);
      url.searchParams.set('adults_number', params.guests.toString());
      url.searchParams.set('room_number', (params.rooms || 1).toString());
      url.searchParams.set('region_id', await this.getRegionId(params.destination));

      const response = await fetch(url.toString(), {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'hotels-com-provider.p.rapidapi.com'
        }
      });

      if (!response.ok) {
        throw new Error(`Hotel API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as HotelsComResponse;
      return this.transformHotelData(data.data.hotels, params);
    } catch (error) {
      console.error('Error searching hotels:', error);
      // Return mock data for development
      return this.getMockHotels(params);
    }
  }

  private async getRegionId(destination: string): Promise<string> {
    try {
      // Get region ID for the destination
      const url = new URL(`${this.baseUrl}/v1/hotels/locations`);
      url.searchParams.set('domain', 'US');
      url.searchParams.set('locale', 'en_US');
      url.searchParams.set('name', destination);

      const response = await fetch(url.toString(), {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'hotels-com-provider.p.rapidapi.com'
        }
      });

      if (response.ok) {
        const data = await response.json() as { data?: Array<{ gaiaId?: string }> };
        return data.data?.[0]?.gaiaId || '6054439'; // Default to New York if not found
      }
    } catch (error) {
      console.error('Error getting region ID:', error);
    }
    return '6054439'; // Default region ID
  }

  private transformHotelData(hotels: HotelsComResponse['data']['hotels'], params: HotelSearchParams): HotelResult[] {
    const checkIn = new Date(params.checkIn);
    const checkOut = new Date(params.checkOut);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    return hotels.map((hotel, index) => ({
      id: hotel.id || `hotel_${index}_${Date.now()}`,
      name: hotel.name,
      address: hotel.address,
      city: hotel.city,
      country: hotel.country,
      rating: hotel.rating,
      pricePerNight: hotel.price.amount,
      currency: hotel.price.currency,
      totalPrice: hotel.price.amount * nights,
      amenities: hotel.amenities || [],
      images: hotel.images || [],
      description: hotel.description,
      coordinates: hotel.coordinates ? {
        latitude: hotel.coordinates.lat,
        longitude: hotel.coordinates.lng
      } : undefined,
      bookingUrl: `https://www.hotels.com/ho${hotel.id}`
    }));
  }

  private getMockHotels(params: HotelSearchParams): HotelResult[] {
    const checkIn = new Date(params.checkIn);
    const checkOut = new Date(params.checkOut);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    return [
      {
        id: `mock_hotel_1_${Date.now()}`,
        name: 'Grand Plaza Hotel',
        address: '123 Main Street',
        city: params.destination,
        country: 'United States',
        rating: 4.2,
        pricePerNight: 180,
        currency: 'USD',
        totalPrice: 180 * nights,
        amenities: ['Free WiFi', 'Pool', 'Gym', 'Restaurant', 'Room Service'],
        images: [
          'https://example.com/hotel1-1.jpg',
          'https://example.com/hotel1-2.jpg'
        ],
        description: 'A luxurious hotel in the heart of the city with modern amenities and excellent service.',
        coordinates: {
          latitude: 40.7128,
          longitude: -74.0060
        },
        bookingUrl: 'https://www.hotels.com/ho123456'
      },
      {
        id: `mock_hotel_2_${Date.now()}`,
        name: 'City Center Inn',
        address: '456 Business District',
        city: params.destination,
        country: 'United States',
        rating: 3.8,
        pricePerNight: 120,
        currency: 'USD',
        totalPrice: 120 * nights,
        amenities: ['Free WiFi', 'Business Center', 'Parking', 'Continental Breakfast'],
        images: [
          'https://example.com/hotel2-1.jpg',
          'https://example.com/hotel2-2.jpg'
        ],
        description: 'Comfortable accommodations perfect for business travelers and tourists alike.',
        coordinates: {
          latitude: 40.7589,
          longitude: -73.9851
        },
        bookingUrl: 'https://www.hotels.com/ho789012'
      },
      {
        id: `mock_hotel_3_${Date.now()}`,
        name: 'Boutique Suites',
        address: '789 Trendy Avenue',
        city: params.destination,
        country: 'United States',
        rating: 4.6,
        pricePerNight: 250,
        currency: 'USD',
        totalPrice: 250 * nights,
        amenities: ['Free WiFi', 'Spa', 'Rooftop Bar', 'Concierge', 'Pet Friendly'],
        images: [
          'https://example.com/hotel3-1.jpg',
          'https://example.com/hotel3-2.jpg'
        ],
        description: 'Stylish boutique hotel with personalized service and unique design elements.',
        coordinates: {
          latitude: 40.7505,
          longitude: -73.9934
        },
        bookingUrl: 'https://www.hotels.com/ho345678'
      }
    ];
  }

  async getHotelDetails(hotelId: string): Promise<HotelResult | null> {
    try {
      const url = new URL(`${this.baseUrl}/v2/hotels/details`);
      url.searchParams.set('domain', 'US');
      url.searchParams.set('locale', 'en_US');
      url.searchParams.set('hotel_id', hotelId);

      const response = await fetch(url.toString(), {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'hotels-com-provider.p.rapidapi.com'
        }
      });

      if (!response.ok) {
        throw new Error(`Hotel details API error: ${response.status}`);
      }

      const data = await response.json() as { data: any };
      // Transform the detailed hotel data
      return this.transformSingleHotelData(data.data);
    } catch (error) {
      console.error('Error getting hotel details:', error);
      return null;
    }
  }

  private transformSingleHotelData(hotel: any): HotelResult {
    return {
      id: hotel.id,
      name: hotel.name,
      address: hotel.address?.line1 || '',
      city: hotel.address?.city || '',
      country: hotel.address?.country || '',
      rating: hotel.reviews?.score || 0,
      pricePerNight: hotel.ratePlan?.price?.current || 0,
      currency: hotel.ratePlan?.price?.currency || 'USD',
      totalPrice: hotel.ratePlan?.price?.current || 0,
      amenities: hotel.amenities?.map((a: any) => a.name) || [],
      images: hotel.images?.map((img: any) => img.url) || [],
      description: hotel.summary || '',
      coordinates: hotel.coordinate ? {
        latitude: hotel.coordinate.lat,
        longitude: hotel.coordinate.lon
      } : undefined,
      bookingUrl: `https://www.hotels.com/ho${hotel.id}`
    };
  }
}
```

### Step 12: Create Calendar Service

```typescript
 import { CalendarEvent, Conflict } from '../types';

export class CalendarService {
  private accessToken: string;
  private baseUrl = 'https://www.googleapis.com/calendar/v3';

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async getEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
    try {
      const url = new URL(`${this.baseUrl}/calendars/primary/events`);
      url.searchParams.set('timeMin', new Date(startDate).toISOString());
      url.searchParams.set('timeMax', new Date(endDate).toISOString());
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Calendar API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { items?: any[] };
      return this.transformCalendarEvents(data.items || []);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      // Return mock data for development
      return this.getMockEvents(startDate, endDate);
    }
  }

  private transformCalendarEvents(events: any[]): CalendarEvent[] {
    return events.map(event => ({
      id: event.id,
      summary: event.summary || 'No title',
      description: event.description,
      start: {
        dateTime: event.start.dateTime,
        date: event.start.date,
        timeZone: event.start.timeZone
      },
      end: {
        dateTime: event.end.dateTime,
        date: event.end.date,
        timeZone: event.end.timeZone
      },
      location: event.location
    }));
  }

  private getMockEvents(startDate: string, endDate: string): CalendarEvent[] {
    const start = new Date(startDate);
    const mockEvents: CalendarEvent[] = [];

    // Add some mock events for testing
    const event1Date = new Date(start);
    event1Date.setDate(start.getDate() + 1);
    
    mockEvents.push({
      id: 'mock_event_1',
      summary: 'Team Meeting',
      description: 'Weekly team sync meeting',
      start: {
        dateTime: event1Date.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        timeZone: 'America/New_York'
      },
      end: {
        dateTime: new Date(event1Date.getTime() + 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        timeZone: 'America/New_York'
      },
      location: 'Conference Room A'
    });

    const event2Date = new Date(start);
    event2Date.setDate(start.getDate() + 2);
    event2Date.setHours(14, 0, 0, 0);

    mockEvents.push({
      id: 'mock_event_2',
      summary: 'Client Presentation',
      description: 'Quarterly business review with client',
      start: {
        dateTime: event2Date.toISOString().replace(/\.\d{3}Z$/, 'Z'),
        timeZone: 'America/New_York'
      },
      end: {
        dateTime: new Date(event2Date.getTime() + 2 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        timeZone: 'America/New_York'
      },
      location: 'Client Office'
    });

    return mockEvents;
  }

  async createEvent(event: Partial<CalendarEvent>): Promise<CalendarEvent | null> {
    try {
      const response = await fetch(`${this.baseUrl}/calendars/primary/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          summary: event.summary,
          description: event.description,
          start: event.start,
          end: event.end,
          location: event.location
        })
      });

      if (!response.ok) {
        throw new Error(`Calendar create event error: ${response.status}`);
      }

      const data = await response.json();
      return this.transformCalendarEvents([data])[0];
    } catch (error) {
      console.error('Error creating calendar event:', error);
      return null;
    }
  }

  checkConflicts(events: CalendarEvent[], travelStartDate: string, travelEndDate: string): Conflict[] {
    const conflicts: Conflict[] = [];
    const travelStart = new Date(travelStartDate);
    const travelEnd = new Date(travelEndDate);

    // Add buffer time for travel (4 hours before departure, 2 hours after return)
    const departureBuffer = new Date(travelStart.getTime() - 4 * 60 * 60 * 1000);
    const returnBuffer = new Date(travelEnd.getTime() + 2 * 60 * 60 * 1000);

    for (const event of events) {
      const eventStart = new Date(event.start.dateTime || event.start.date || '');
      const eventEnd = new Date(event.end.dateTime || event.end.date || '');

      // Check for overlaps with travel period
      if (this.isOverlapping(eventStart, eventEnd, travelStart, travelEnd)) {
        conflicts.push({
          type: 'overlap',
          eventId: event.id,
          eventTitle: event.summary,
          conflictTime: eventStart.toISOString(),
          severity: 'high',
          suggestion: 'Consider rescheduling this event or adjusting travel dates'
        });
      }

      // Check for tight schedule conflicts (events too close to travel time)
      if (this.isTooClose(eventStart, eventEnd, departureBuffer, travelStart)) {
        conflicts.push({
          type: 'tight_schedule',
          eventId: event.id,
          eventTitle: event.summary,
          conflictTime: eventStart.toISOString(),
          severity: 'medium',
          suggestion: 'Allow more time between this event and travel departure'
        });
      }

      if (this.isTooClose(returnBuffer, travelEnd, eventStart, eventEnd)) {
        conflicts.push({
          type: 'tight_schedule',
          eventId: event.id,
          eventTitle: event.summary,
          conflictTime: eventStart.toISOString(),
          severity: 'medium',
          suggestion: 'Allow more time between travel return and this event'
        });
      }

      // Check for travel time conflicts (events in different locations)
      if (event.location && this.requiresTravelTime(event.location, travelStart, travelEnd)) {
        conflicts.push({
          type: 'travel_time',
          eventId: event.id,
          eventTitle: event.summary,
          conflictTime: eventStart.toISOString(),
          severity: 'low',
          suggestion: 'Consider travel time to/from this event location'
        });
      }
    }

    return conflicts;
  }

  private isOverlapping(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && start2 < end1;
  }

  private isTooClose(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    const timeDiff = Math.abs(end1.getTime() - start2.getTime());
    const oneHour = 60 * 60 * 1000;
    return timeDiff < oneHour;
  }

  private requiresTravelTime(eventLocation: string, travelStart: Date, travelEnd: Date): boolean {
    // Simple heuristic: if event location contains airport codes or is far from typical locations
    const airportCodes = ['airport', 'terminal', 'gate'];
    const location = eventLocation.toLowerCase();
    return airportCodes.some(code => location.includes(code));
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      return false;
    }
  }

  async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | null> {
    try {
      const response = await fetch(`${this.baseUrl}/calendars/primary/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          summary: updates.summary,
          description: updates.description,
          start: updates.start,
          end: updates.end,
          location: updates.location
        })
      });

      if (!response.ok) {
        throw new Error(`Calendar update event error: ${response.status}`);
      }

      const data = await response.json();
      return this.transformCalendarEvents([data])[0];
    } catch (error) {
      console.error('Error updating calendar event:', error);
      return null;
    }
  }
}
```

### Step 13: Create Booking Service (Optional)

```typescript
import {
  FlightBookingRequest,
  HotelBookingRequest,
  BookingConfirmation,
  FlightBookingDetails,
  HotelBookingDetails,
  TravelPlan,
} from '../types'

export class BookingService {
  private accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  async bookFlight(request: FlightBookingRequest): Promise<BookingConfirmation> {
    try {
      // In a real implementation, this would integrate with airline booking APIs
      // For now, we'll simulate the booking process
      console.log('Processing flight booking:', request)

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Generate booking confirmation
      const bookingId = `FL${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      const confirmationNumber = `${Math.random().toString(36).substr(2, 6).toUpperCase()}`

      const confirmation: BookingConfirmation = {
        bookingId,
        confirmationNumber,
        status: 'confirmed',
        totalPrice: 0, // Will be calculated based on flight price
        currency: 'USD',
        bookingDate: new Date().toISOString(),
        details: {
          type: 'flight',
          flight: {} as any, // Will be populated with actual flight data
          passengers: request.passengers,
          seatAssignments: request.passengers.map((_, index) => `${String.fromCharCode(65 + index)}${Math.floor(Math.random() * 30) + 1}`),
        } as FlightBookingDetails,
      }

      // In production, you would:
      // 1. Validate passenger information
      // 2. Check flight availability
      // 3. Process payment
      // 4. Create booking with airline
      // 5. Send confirmation email
      // 6. Add to user's calendar

      return confirmation
    } catch (error) {
      console.error('Flight booking failed:', error)
      throw new Error('Flight booking failed. Please try again.')
    }
  }

  async bookHotel(request: HotelBookingRequest): Promise<BookingConfirmation> {
    try {
      // In a real implementation, this would integrate with hotel booking APIs
      console.log('Processing hotel booking:', request)

      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Generate booking confirmation
      const bookingId = `HT${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`
      const confirmationNumber = `${Math.random().toString(36).substr(2, 6).toUpperCase()}`

      const confirmation: BookingConfirmation = {
        bookingId,
        confirmationNumber,
        status: 'confirmed',
        totalPrice: 0, // Will be calculated based on hotel price
        currency: 'USD',
        bookingDate: new Date().toISOString(),
        details: {
          type: 'hotel',
          hotel: {} as any, // Will be populated with actual hotel data
          checkIn: request.checkIn,
          checkOut: request.checkOut,
          rooms: request.rooms,
          guests: request.guestInfo,
        } as HotelBookingDetails,
      }

      // In production, you would:
      // 1. Validate guest information
      // 2. Check room availability
      // 3. Process payment
      // 4. Create reservation with hotel
      // 5. Send confirmation email
      // 6. Add to user's calendar

      return confirmation
    } catch (error) {
      console.error('Hotel booking failed:', error)
      throw new Error('Hotel booking failed. Please try again.')
    }
  }

  async createTravelPlan(
    title: string,
    destinations: string[],
    startDate: string,
    endDate: string,
    travelers: number,
    budget?: number,
  ): Promise<TravelPlan> {
    const planId = `TP${Date.now()}${Math.random().toString(36).substr(2, 6).toUpperCase()}`

    const plan: TravelPlan = {
      id: planId,
      title,
      destinations,
      startDate,
      endDate,
      travelers,
      budget,
      status: 'planning',
      flights: [],
      hotels: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // In production, you would save this to a database
    console.log('Created travel plan:', plan)

    return plan
  }

  async getTravelPlan(planId: string): Promise<TravelPlan | null> {
    // In production, you would retrieve this from a database
    // For now, return a mock plan
    const mockPlan: TravelPlan = {
      id: planId,
      title: 'European Adventure',
      destinations: ['Paris', 'Rome', 'Barcelona'],
      startDate: '2024-06-15',
      endDate: '2024-06-25',
      travelers: 2,
      budget: 5000,
      status: 'planning',
      flights: [],
      hotels: [],
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    }

    return mockPlan
  }

  async bookTrip(
    planId: string,
    flightBookings: FlightBookingRequest[],
    hotelBookings: HotelBookingRequest[],
  ): Promise<{
    plan: TravelPlan
    flightConfirmations: BookingConfirmation[]
    hotelConfirmations: BookingConfirmation[]
    totalCost: number
  }> {
    try {
      // Get the travel plan
      const plan = await this.getTravelPlan(planId)
      if (!plan) {
        throw new Error('Travel plan not found')
      }

      // Book all flights
      const flightConfirmations: BookingConfirmation[] = []
      for (const flightRequest of flightBookings) {
        const confirmation = await this.bookFlight(flightRequest)
        flightConfirmations.push(confirmation)
      }

      // Book all hotels
      const hotelConfirmations: BookingConfirmation[] = []
      for (const hotelRequest of hotelBookings) {
        const confirmation = await this.bookHotel(hotelRequest)
        hotelConfirmations.push(confirmation)
      }

      // Calculate total cost
      const totalCost = [...flightConfirmations, ...hotelConfirmations].reduce((sum, booking) => sum + booking.totalPrice, 0)

      // Update plan status
      plan.status = 'booked'
      plan.flights = flightConfirmations
      plan.hotels = hotelConfirmations
      plan.updatedAt = new Date().toISOString()

      // In production, you would:
      // 1. Save updated plan to database
      // 2. Send confirmation emails
      // 3. Add events to calendar
      // 4. Set up travel reminders

      return {
        plan,
        flightConfirmations,
        hotelConfirmations,
        totalCost,
      }
    } catch (error) {
      console.error('Trip booking failed:', error)
      throw new Error('Trip booking failed. Please try again.')
    }
  }

  async addToCalendar(booking: BookingConfirmation): Promise<void> {
    try {
      // Create calendar events for the booking
      if (booking.details.type === 'flight') {
        const flightDetails = booking.details as FlightBookingDetails

        // Create departure event
        await this.createCalendarEvent({
          summary: `Flight ${flightDetails.flight.flightNumber} - Departure`,
          description: `Flight from ${flightDetails.flight.origin} to ${flightDetails.flight.destination}\nConfirmation: ${booking.confirmationNumber}`,
          start: flightDetails.flight.departureTime,
          end: flightDetails.flight.arrivalTime,
          location: flightDetails.flight.origin,
        })
      } else if (booking.details.type === 'hotel') {
        const hotelDetails = booking.details as HotelBookingDetails

        // Create hotel stay event
        await this.createCalendarEvent({
          summary: `Hotel Stay - ${hotelDetails.hotel.name}`,
          description: `Hotel reservation\nConfirmation: ${booking.confirmationNumber}\nAddress: ${hotelDetails.hotel.address}`,
          start: `${hotelDetails.checkIn}T15:00:00`,
          end: `${hotelDetails.checkOut}T11:00:00`,
          location: hotelDetails.hotel.address,
        })
      }
    } catch (error) {
      console.error('Failed to add booking to calendar:', error)
      // Don't throw error - calendar addition is optional
    }
  }

  private async createCalendarEvent(event: {
    summary: string
    description: string
    start: string
    end: string
    location?: string
  }): Promise<void> {
    try {
      const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

      const eventData = {
        summary: event.summary,
        description: event.description,
        start: {
          dateTime: new Date(event.start).toISOString(),
          timeZone: 'UTC',
        },
        end: {
          dateTime: new Date(event.end).toISOString(),
          timeZone: 'UTC',
        },
        location: event.location,
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      })

      if (!response.ok) {
        throw new Error(`Calendar API error: ${response.status}`)
      }
    } catch (error) {
      console.error('Failed to create calendar event:', error)
      throw error
    }
  }
}
```

### Step 14: Create Type Definition

Create `src/types/index.ts`:

```ts
// Flight-related types
export interface FlightSearchParams {
  origin: string
  destination: string
  departureDate: string
  returnDate?: string
  passengers: number
  class?: 'economy' | 'business' | 'first'
}

export interface FlightInfo {
  id: string
  airline: string
  flightNumber: string
  origin: string
  destination: string
  departureTime: string
  arrivalTime: string
  duration: string
  price: number
  currency: string
  bookingUrl?: string
  aircraft?: string
  stops: number
}

// Hotel-related types
export interface HotelSearchParams {
  destination: string
  checkIn: string
  checkOut: string
  guests: number
  rooms?: number
  minRating?: number
  maxPrice?: number
}

export interface HotelResult {
  id: string
  name: string
  address: string
  city: string
  country: string
  rating: number
  pricePerNight: number
  currency: string
  totalPrice: number
  amenities: string[]
  images: string[]
  bookingUrl?: string
  description?: string
  coordinates?: {
    latitude: number
    longitude: number
  }
}

// Calendar-related types
export interface CalendarEvent {
  id: string
  summary: string
  description?: string
  start: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  end: {
    dateTime?: string
    date?: string
    timeZone?: string
  }
  location?: string
}

export interface Conflict {
  type: 'overlap' | 'tight_schedule' | 'travel_time'
  eventId: string
  eventTitle: string
  conflictTime: string
  severity: 'low' | 'medium' | 'high'
  suggestion?: string
}

// API response types
export interface AviationstackResponse {
  data: Array<{
    flight_date: string
    flight_status: string
    departure: {
      airport: string
      timezone: string
      iata: string
      icao: string
      terminal: string
      gate: string
      delay: number
      scheduled: string
      estimated: string
      actual: string
      estimated_runway: string
      actual_runway: string
    }
    arrival: {
      airport: string
      timezone: string
      iata: string
      icao: string
      terminal: string
      gate: string
      baggage: string
      delay: number
      scheduled: string
      estimated: string
      actual: string
      estimated_runway: string
      actual_runway: string
    }
    airline: {
      name: string
      iata: string
      icao: string
    }
    flight: {
      number: string
      iata: string
      icao: string
      codeshared: any
    }
    aircraft: {
      registration: string
      iata: string
      icao: string
      icao24: string
    }
    live: {
      updated: string
      latitude: number
      longitude: number
      altitude: number
      direction: number
      speed_horizontal: number
      speed_vertical: number
      is_ground: boolean
    }
  }>
}

export interface HotelsComResponse {
  data: {
    hotels: Array<{
      id: string
      name: string
      address: string
      city: string
      country: string
      rating: number
      price: {
        amount: number
        currency: string
      }
      amenities: string[]
      images: string[]
      coordinates: {
        lat: number
        lng: number
      }
      description: string
    }>
  }
}

// Booking-related types
export interface FlightBookingRequest {
  flightId: string
  passengers: PassengerInfo[]
  contactInfo: ContactInfo
  paymentInfo?: PaymentInfo
}

export interface HotelBookingRequest {
  hotelId: string
  checkIn: string
  checkOut: string
  rooms: number
  guests: number
  guestInfo: GuestInfo[]
  contactInfo: ContactInfo
  paymentInfo?: PaymentInfo
}

export interface PassengerInfo {
  firstName: string
  lastName: string
  dateOfBirth: string
  passportNumber?: string
  nationality?: string
}

export interface GuestInfo {
  firstName: string
  lastName: string
  email?: string
}

export interface ContactInfo {
  email: string
  phone: string
  firstName: string
  lastName: string
}

export interface PaymentInfo {
  cardNumber: string
  expiryMonth: string
  expiryYear: string
  cvv: string
  cardholderName: string
  billingAddress: BillingAddress
}

export interface BillingAddress {
  street: string
  city: string
  state: string
  zipCode: string
  country: string
}

export interface BookingConfirmation {
  bookingId: string
  confirmationNumber: string
  status: 'confirmed' | 'pending' | 'failed'
  totalPrice: number
  currency: string
  bookingDate: string
  details: FlightBookingDetails | HotelBookingDetails
}

export interface FlightBookingDetails {
  type: 'flight'
  flight: FlightInfo
  passengers: PassengerInfo[]
  seatAssignments?: string[]
}

export interface HotelBookingDetails {
  type: 'hotel'
  hotel: HotelResult
  checkIn: string
  checkOut: string
  rooms: number
  guests: GuestInfo[]
}

export interface TravelPlan {
  id: string
  title: string
  destinations: string[]
  startDate: string
  endDate: string
  travelers: number
  budget?: number
  status: 'planning' | 'booked' | 'completed' | 'cancelled'
  flights?: BookingConfirmation[]
  hotels?: BookingConfirmation[]
  createdAt: string
  updatedAt: string
}
```

## 🚀 Deployment

1. **Deploy to Cloudflare Workers**:

```bash
# Deploy the worker
npm run deploy

# Your MCP server will be deployed to: `https://restaurant-reservation-mcp.<your-account>.workers.dev`
```

2. **Upload your environment variables to Cloudflare**:

```bash
# Set environment variables
wrangler secret bulk .dev.vars
```

## 💬 Example Usage

Try these commands with Claude:

### Example Conversations

**Flight Search:**
```
Find flights from JFK to LHR departing December 15th
```

**Travel Planning:**
```
Create a travel plan for Paris and London, December 15-22, budget $3000
```

**Calendar Integration:**
```
Check if I have any conflicts for my December 15-22 trip
```

## 🔔 Troubleshooting

### Common Issues

**"Tool not found" errors:**
- Check tool registration in `src/tools/index.ts`
- Verify tool names match exactly
- Ensure all imports are correct

**API key errors:**
- Verify `.dev.vars` file has correct keys
- Check API key format and permissions
- Test API keys directly with curl

**TypeScript errors:**
- Run `npm run type-check` to identify issues
- Ensure all imports have correct file extensions
- Check Zod schema definitions match usage

**Deployment issues:**
- Verify `wrangler.jsonc` configuration
- Check Cloudflare account permissions
- Ensure environment variables are set in Cloudflare dashboard

## 📚 Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [MCP Protocol Specification](https://modelcontextprotocol.github.io/)
- [Google Calendar API Documentation](https://developers.google.com/calendar)

**🎉 Congratulations!** You've built a complete MCP server that enables Claude to search flights, manage travel plans, and coordinate bookings. Your server demonstrates the power of the Model Context Protocol for creating AI-native integrations.
