// src/app/actions/get-services-by-salon.ts
import { Service } from "@/app/types";
import { API_BASE_URL } from "../../../config/constants";

const getServicesBySalon = async (salonId: string): Promise<Service[]> => {
    try {
        console.log('Fetching services for salon:', salonId);
        
        const res = await fetch(`${API_BASE_URL}/public/saloons/${salonId}/services`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        });
        
        if (!res.ok) {
            throw new Error(`Failed to fetch salon services: ${res.status} ${res.statusText}`);
        }
        
        const data = await res.json();
        console.log('Salon services fetched successfully:', data.length, 'items');
        console.log('First service sample:', JSON.stringify(data[0], null, 2));
        
        // Ensure each service has its saloonServices array populated
        // The API should return services with saloonServices included
        return data;
    } catch (error) {
        console.error('Error in getServicesBySalon:', error);
        throw error;
    }
};

export default getServicesBySalon;
