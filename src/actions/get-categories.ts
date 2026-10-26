import { Category } from "@/types";
import { API_ENDPOINTS } from "@/config/constants";
import { apiFetch, ApiError } from '@/lib/api';

const getCategories = async (): Promise<Category[]> => {
    try {
        console.log('Fetching categories from:', API_ENDPOINTS.CATEGORIES);
        
        const res = await apiFetch(API_ENDPOINTS.CATEGORIES, {
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
        console.log('Categories fetched successfully:', data.length, 'items');
        return data;
    } catch (error) {
        console.error('Error in getCategories:', error);
        throw error;
    }
};

export default getCategories;
