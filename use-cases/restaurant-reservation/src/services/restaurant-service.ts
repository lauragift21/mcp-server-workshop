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
