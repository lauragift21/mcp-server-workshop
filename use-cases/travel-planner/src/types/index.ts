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