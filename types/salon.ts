export interface Salon {
  id: string;
  name: string;
  description?: string;
  shortIntro?: string;
  address?: string;
  latitude: number;
  longitude: number;
  rating: number;
  images: Array<{
    id: string;
    url: string;
  }>;
  averageRating: number;
  reviewCount: number;
  saloonServices: Array<{
    service: {
      id: string;
      name: string;
      description?: string;
      category: {
        id: string;
        name: string;
      };
      parentService?: {
        id: string;
        name: string;
      };
    };
    price: number;
    durationMinutes: number;
    isAvailable: boolean;
    availableDays: number[];
  }>;
  user: {
    id: string;
    name?: string;
    email: string;
  };
  reviews: Array<{
    id: string;
    rating: number;
    comment?: string;
    createdAt: string;
    user: {
      name?: string;
    };
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface SalonService {
  id: string;
  name: string;
  description?: string;
  price: number;
  durationMinutes: number;
  isAvailable: boolean;
  category: {
    id: string;
    name: string;
  };
  parentService?: {
    id: string;
    name: string;
  };
}

export interface SalonReview {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  user: {
    name?: string;
  };
}

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
}

export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}


