// src/app/actions/get-salon-by-id.ts
import { API_BASE_URL } from "../../../config/constants";

export interface SaloonImage {
  id: string;
  saloonId: string;
  url: string;
  createdAt: string;
  updatedAt: string;
}

export interface Saloon {
  id: string;
  name: string;
  description: string;
  shortIntro: string;
  rating: number;
  address: string;
  latitude?: number;
  longitude?: number;
  images?: SaloonImage[];
  createdAt: string;
  updatedAt: string;
}

export interface SaloonService {
  saloonId: string;
  serviceId: string;
  price: number;
  durationMinutes: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  saloon: Saloon;
}

export interface ServiceWithSaloons {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  parentServiceId: string | null;
  isPopular: boolean;
  createdAt: string;
  updatedAt: string;
  saloonServices: SaloonService[];
}

export interface SaloonData {
  id: string;
  name: string;
  shortIntro: string;
  price: number;
  durationMinutes: number;
  isAvailable: boolean;
  rating: number;
  address: string;
  latitude?: number;
  longitude?: number;
  imageUrl?: string;
  images?: string[];
}

const getSalonById = async (salonId: string, serviceId: string): Promise<SaloonData[]> => {
  try {
    console.log('Fetching specific salon:', salonId, 'for service:', serviceId);

    // First get the salon details
    const salonResponse = await fetch(`${API_BASE_URL}/public/saloons/${salonId}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!salonResponse.ok) {
      throw new Error(`HTTP error! status: ${salonResponse.status}`);
    }

    const salonData = await salonResponse.json();
    console.log('Raw API response for salon:', JSON.stringify(salonData, null, 2));

    // Filter saloon services to only include the specific service
    const filteredServices = salonData.saloonServices.filter((saloonService: any) =>
      saloonService.service.id === serviceId && saloonService.isAvailable
    );

    if (filteredServices.length === 0) {
      console.log('No services found for this salon and service combination');
      return [];
    }

    // Extract saloon data from the filtered services
    const saloonsData: SaloonData[] = filteredServices.map((saloonService: any) => {
      return {
        id: salonData.id,
        name: salonData.name,
        shortIntro: salonData.shortIntro || salonData.description || '',
        price: saloonService.price,
        durationMinutes: saloonService.durationMinutes,
        isAvailable: saloonService.isAvailable,
        rating: salonData.averageRating || salonData.rating || 0,
        address: salonData.address || '',
        latitude: salonData.latitude,
        longitude: salonData.longitude,
        imageUrl: salonData.images && salonData.images.length > 0
          ? salonData.images[0].url
          : undefined,
        images: salonData.images ? salonData.images.map((img: any) => img.url) : undefined,
      };
    });

    console.log('Filtered salon data:', saloonsData);
    return saloonsData;
  } catch (error) {
    console.error('Error fetching salon by ID:', error);
    throw error;
  }
};

export default getSalonById;
