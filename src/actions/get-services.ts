// src/app/actions/get-services.ts
import { Service } from "@/types";
import { API_ENDPOINTS } from "@/config/constants";
import { apiFetch, ApiError } from '@/lib/api';

const getServicesByCategory = async (categoryName: string): Promise<Service[]> => {
    try {
        console.log('Fetching services for category:', categoryName);
        
        const res = await apiFetch(`${API_ENDPOINTS.SERVICES}?category=${encodeURIComponent(categoryName)}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        });
        
        if (!res.ok) {
            throw ApiError.http(res.status);
        }
        
        const data = await res.json();
        console.log('Services fetched successfully:', data.length, 'items');
        return data;
    } catch (error) {
        console.error('Error in getServicesByCategory:', error);
        throw error;
    }
};

export default getServicesByCategory;
