import type {
  Reservation,
  AvailabilityRequest,
  ReservationRequest,
} from '../types';

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
    const alternativeTimes = [
      '6:00 PM',
      '6:30 PM',
      '7:00 PM',
      '7:30 PM',
      '8:00 PM',
    ];

    if (isAvailable) {
      return {
        isAvailable: true,
        alternativeTimes,
        message: `✅ Available at ${request.time} for ${request.partySize} people`,
      };
    } else {
      return {
        isAvailable: false,
        alternativeTimes,
        message: `❌ Not available at ${
          request.time
        }. Alternative times available: ${alternativeTimes.join(', ')}`,
      };
    }
  }

  /**
   * Make a new reservation
   */
  async makeReservation(request: ReservationRequest): Promise<Reservation> {
    const reservationId = `res_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const reservation: Reservation = {
      id: reservationId,
      restaurantId: request.restaurantId,
      restaurantName: '', // Will be filled by the tool handler
      date: request.date,
      time: request.time,
      partySize: request.partySize,
      customerName: request.customerName,
      customerEmail: request.customerEmail,
      customerPhone: request.customerPhone,
      status: 'confirmed',
      specialRequests: request.specialRequests,
    };

    this.mockReservations.push(reservation);
    return reservation;
  }

  /**
   * Get reservations by customer email
   */
  async getReservationsByEmail(customerEmail: string): Promise<Reservation[]> {
    return this.mockReservations.filter(
      (r) => r.customerEmail.toLowerCase() === customerEmail.toLowerCase()
    );
  }

  /**
   * Get reservation by ID and email (for security)
   */
  async getReservationByIdAndEmail(
    reservationId: string,
    customerEmail: string
  ): Promise<Reservation | null> {
    return (
      this.mockReservations.find(
        (r) =>
          r.id === reservationId &&
          r.customerEmail.toLowerCase() === customerEmail.toLowerCase()
      ) || null
    );
  }

  /**
   * Cancel a reservation
   */
  async cancelReservation(
    reservationId: string,
    customerEmail: string
  ): Promise<Reservation | null> {
    const reservationIndex = this.mockReservations.findIndex(
      (r) =>
        r.id === reservationId &&
        r.customerEmail.toLowerCase() === customerEmail.toLowerCase()
    );

    if (reservationIndex === -1) {
      return null;
    }

    const reservation = this.mockReservations[reservationIndex];
    reservation.status = 'cancelled';

    return reservation;
  }

  /**
   * Format reservation for display
   */
  formatReservation(reservation: Reservation): string {
    return (
      `🍽️ **${reservation.restaurantName}**\n` +
      `   📋 ID: ${reservation.id}\n` +
      `   📅 Date: ${reservation.date}\n` +
      `   🕐 Time: ${reservation.time}\n` +
      `   👥 Party Size: ${reservation.partySize}\n` +
      `   ✅ Status: ${reservation.status}\n` +
      `   ${
        reservation.specialRequests
          ? `📝 Special Requests: ${reservation.specialRequests}\n`
          : ''
      }`
    );
  }

  /**
   * Format reservation confirmation
   */
  formatReservationConfirmation(
    reservation: Reservation,
    restaurantPhone?: string
  ): string {
    return (
      `🎉 **Reservation Confirmed!**\n\n` +
      `📋 **IMPORTANT - YOUR RESERVATION ID: ${reservation.id}**\n\n` +
      `🍽️ Restaurant: ${reservation.restaurantName}\n` +
      `📅 Date: ${reservation.date}\n` +
      `🕐 Time: ${reservation.time}\n` +
      `👥 Party Size: ${reservation.partySize}\n` +
      `👤 Name: ${reservation.customerName}\n` +
      `📧 Email: ${reservation.customerEmail}\n` +
      `📞 Phone: ${reservation.customerPhone}\n` +
      `${
        reservation.specialRequests
          ? `📝 Special Requests: ${reservation.specialRequests}\n`
          : ''
      }` +
      `\n✅ Status: ${reservation.status}\n\n` +
      `Please arrive 15 minutes early. ${
        restaurantPhone
          ? `Call ${restaurantPhone} if you need to make changes.`
          : ''
      }\n\n` +
      `To view or cancel your reservation, use your reservation ID and email address.`
    );
  }

  /**
   * Format cancellation confirmation
   */
  formatCancellationConfirmation(reservation: Reservation): string {
    return (
      `✅ **Reservation Cancelled**\n\n` +
      `📋 Confirmation #: ${reservation.id}\n` +
      `🍽️ Restaurant: ${reservation.restaurantName}\n` +
      `📅 Date: ${reservation.date}\n` +
      `🕐 Time: ${reservation.time}\n\n` +
      `Your reservation has been successfully cancelled.`
    );
  }
}
