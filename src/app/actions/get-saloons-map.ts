import { Salon } from '../../../types/salon';
import { API_BASE_URL } from '../../../config/constants';

export interface MapSalonRequest {
  lat?: number;
  lng?: number;
  radius?: number;
}

export default async function getSaloonsMap(params?: MapSalonRequest): Promise<Salon[]> {
  try {
    let url = `${API_BASE_URL}/saloons/map`;

    if (params) {
      const queryParams = new URLSearchParams();
      if (params.lat) queryParams.append('lat', params.lat.toString());
      if (params.lng) queryParams.append('lng', params.lng.toString());
      if (params.radius) queryParams.append('radius', params.radius.toString());

      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }
    }

    console.log('Fetching salons from:', url);
    console.log('API_BASE_URL:', API_BASE_URL);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Response error text:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
    }

    const data = await response.json();
    console.log('Salons fetched successfully:', data.length, 'items');

    // If no salons found nearby, try to get all salons without location filter
    if (data.length === 0 && params) {
      console.log('No nearby salons found, fetching all salons...');
      const allSalonsUrl = `${API_BASE_URL}/saloons/map`;
      const allResponse = await fetch(allSalonsUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (allResponse.ok) {
        const allData = await allResponse.json();
        console.log('All salons fetched:', allData.length, 'items');
        return allData;
      }
    }

    return data;
  } catch (error) {
    console.error('Error fetching salons for map:', error);
    throw error;
  }
}
