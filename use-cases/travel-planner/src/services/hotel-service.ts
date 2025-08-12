import { HotelSearchParams, HotelResult, HotelsComResponse } from '../types'

export class HotelService {
  private rapidApiKey: string
  private baseUrl = 'https://hotels-com-provider.p.rapidapi.com'

  constructor(rapidApiKey: string) {
    this.rapidApiKey = rapidApiKey
  }

  async searchHotels(params: HotelSearchParams): Promise<HotelResult[]> {
    try {
      // Search for hotels using Hotels.com RapidAPI
      const url = new URL(`${this.baseUrl}/v2/hotels/search`)
      url.searchParams.set('domain', 'US')
      url.searchParams.set('sort_order', 'REVIEW')
      url.searchParams.set('locale', 'en_US')
      url.searchParams.set('checkout_date', params.checkOut)
      url.searchParams.set('checkin_date', params.checkIn)
      url.searchParams.set('adults_number', params.guests.toString())
      url.searchParams.set('room_number', (params.rooms || 1).toString())
      url.searchParams.set('region_id', await this.getRegionId(params.destination))

      const response = await fetch(url.toString(), {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'hotels-com-provider.p.rapidapi.com',
        },
      })

      if (!response.ok) {
        throw new Error(`Hotel API error: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as HotelsComResponse
      return this.transformHotelData(data.data.hotels, params)
    } catch (error) {
      console.error('Error searching hotels:', error)
      // Return mock data for development
      return this.getMockHotels(params)
    }
  }

  private async getRegionId(destination: string): Promise<string> {
    try {
      // Get region ID for the destination
      const url = new URL(`${this.baseUrl}/v1/hotels/locations`)
      url.searchParams.set('domain', 'US')
      url.searchParams.set('locale', 'en_US')
      url.searchParams.set('name', destination)

      const response = await fetch(url.toString(), {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'hotels-com-provider.p.rapidapi.com',
        },
      })

      if (response.ok) {
        const data = (await response.json()) as { data?: Array<{ gaiaId?: string }> }
        return data.data?.[0]?.gaiaId || '6054439' // Default to New York if not found
      }
    } catch (error) {
      console.error('Error getting region ID:', error)
    }
    return '6054439' // Default region ID
  }

  private transformHotelData(hotels: HotelsComResponse['data']['hotels'], params: HotelSearchParams): HotelResult[] {
    const checkIn = new Date(params.checkIn)
    const checkOut = new Date(params.checkOut)
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

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
      coordinates: hotel.coordinates
        ? {
            latitude: hotel.coordinates.lat,
            longitude: hotel.coordinates.lng,
          }
        : undefined,
      bookingUrl: `https://www.hotels.com/ho${hotel.id}`,
    }))
  }

  private getMockHotels(params: HotelSearchParams): HotelResult[] {
    const checkIn = new Date(params.checkIn)
    const checkOut = new Date(params.checkOut)
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24))

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
        images: ['https://example.com/hotel1-1.jpg', 'https://example.com/hotel1-2.jpg'],
        description: 'A luxurious hotel in the heart of the city with modern amenities and excellent service.',
        coordinates: {
          latitude: 40.7128,
          longitude: -74.006,
        },
        bookingUrl: 'https://www.hotels.com/ho123456',
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
        images: ['https://example.com/hotel2-1.jpg', 'https://example.com/hotel2-2.jpg'],
        description: 'Comfortable accommodations perfect for business travelers and tourists alike.',
        coordinates: {
          latitude: 40.7589,
          longitude: -73.9851,
        },
        bookingUrl: 'https://www.hotels.com/ho789012',
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
        images: ['https://example.com/hotel3-1.jpg', 'https://example.com/hotel3-2.jpg'],
        description: 'Stylish boutique hotel with personalized service and unique design elements.',
        coordinates: {
          latitude: 40.7505,
          longitude: -73.9934,
        },
        bookingUrl: 'https://www.hotels.com/ho345678',
      },
    ]
  }

  async getHotelDetails(hotelId: string): Promise<HotelResult | null> {
    try {
      const url = new URL(`${this.baseUrl}/v2/hotels/details`)
      url.searchParams.set('domain', 'US')
      url.searchParams.set('locale', 'en_US')
      url.searchParams.set('hotel_id', hotelId)

      const response = await fetch(url.toString(), {
        headers: {
          'X-RapidAPI-Key': this.rapidApiKey,
          'X-RapidAPI-Host': 'hotels-com-provider.p.rapidapi.com',
        },
      })

      if (!response.ok) {
        throw new Error(`Hotel details API error: ${response.status}`)
      }

      const data = (await response.json()) as { data: any }
      // Transform the detailed hotel data
      return this.transformSingleHotelData(data.data)
    } catch (error) {
      console.error('Error getting hotel details:', error)
      return null
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
      coordinates: hotel.coordinate
        ? {
            latitude: hotel.coordinate.lat,
            longitude: hotel.coordinate.lon,
          }
        : undefined,
      bookingUrl: `https://www.hotels.com/ho${hotel.id}`,
    }
  }
}
