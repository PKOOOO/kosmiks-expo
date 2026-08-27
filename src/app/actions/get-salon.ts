// src/app/actions/get-salon.ts
import { API_BASE_URL } from "../../../config/constants";

export interface SalonDetails {
  id: string;
  name: string;
  description?: string;
  shortIntro?: string;
  rating?: number;
  address?: string;
}

export const getSalon = async (salonId: string, authToken?: string): Promise<SalonDetails | null> => {
    try {
        console.log('Fetching salon details for ID:', salonId);
        
        const headers: Record<string, string> = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };
        
        // Add authorization header if token is available
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        
        // Try to fetch salon details - this endpoint might not exist yet
        const res = await fetch(`${API_BASE_URL}/saloons/${salonId}`, {
            method: 'GET',
            headers,
        });
        
        if (!res.ok) {
            console.log('Salon endpoint not found, returning null');
            return null;
        }
        
        const data = await res.json();
        console.log('Salon fetched successfully:', data.name);
        return data;
    } catch (error) {
        console.error('Error fetching salon:', error);
        return null;
    }
};

export default getSalon;
