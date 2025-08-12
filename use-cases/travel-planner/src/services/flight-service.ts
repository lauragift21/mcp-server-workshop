import { FlightSearchParams, FlightInfo, AviationstackResponse } from '../types'

export class FlightService {
  private apiKey: string
  private baseUrl = 'http://api.aviationstack.com/v1'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async searchFlights(params: FlightSearchParams): Promise<FlightInfo[]> {
    try {
      // Search for flights using Aviationstack API
      const url = new URL(`${this.baseUrl}/flights`)
      url.searchParams.set('access_key', this.apiKey)
      url.searchParams.set('dep_iata', params.origin)
      url.searchParams.set('arr_iata', params.destination)
      url.searchParams.set('flight_date', params.departureDate)
      url.searchParams.set('limit', '50')

      const response = await fetch(url.toString())

      if (!response.ok) {
        throw new Error(`Flight API error: ${response.status} ${response.statusText}`)
      }

      const data: AviationstackResponse = await response.json()

      return this.transformFlightData(data.data, params)
    } catch (error) {
      console.error('Error searching flights:', error)
      // Return mock data for development
      return this.getMockFlights(params)
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
      bookingUrl: `https://www.kayak.com/flights/${params.origin}-${params.destination}/${params.departureDate}`,
    }))
  }

  private calculateDuration(departure: string, arrival: string): string {
    const dep = new Date(departure)
    const arr = new Date(arrival)
    const diffMs = arr.getTime() - dep.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  private estimatePrice(origin: string, destination: string, flightClass: string): number {
    // Simple price estimation based on distance and class
    const basePrice = 200
    const classMultiplier = flightClass === 'business' ? 3 : flightClass === 'first' ? 5 : 1
    const randomFactor = 0.8 + Math.random() * 0.4 // 80% to 120% of base
    return Math.round(basePrice * classMultiplier * randomFactor)
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
        bookingUrl: `https://www.kayak.com/flights/${params.origin}-${params.destination}/${params.departureDate}`,
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
        bookingUrl: `https://www.kayak.com/flights/${params.origin}-${params.destination}/${params.departureDate}`,
      },
    ]
  }

  async getFlightStatus(flightNumber: string, date: string): Promise<any> {
    try {
      const url = new URL(`${this.baseUrl}/flights`)
      url.searchParams.set('access_key', this.apiKey)
      url.searchParams.set('flight_iata', flightNumber)
      url.searchParams.set('flight_date', date)

      const response = await fetch(url.toString())

      if (!response.ok) {
        throw new Error(`Flight status API error: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error getting flight status:', error)
      return { status: 'unknown', message: 'Unable to fetch flight status' }
    }
  }
}
