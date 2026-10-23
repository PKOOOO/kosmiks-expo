import { create } from 'zustand';
import { adminRequest } from '@/lib/admin-api';

// Admin catalog (categories → services → options), shared by the category
// grid and each category's page.

type GetToken = () => Promise<string | null>;

export const WORK_TYPES = ['UUDET', 'POISTO', 'HUOLTO', 'EI_LISAKKEITA', 'LYHYET', 'KESKIPITKAT', 'PITKAT'] as const;
export type WorkType = typeof WORK_TYPES[number];

export type Category = { id: string; name: string; popular: boolean };

export type Service = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  parentServiceId: string | null;
  workTypes: WorkType[];
  category: { name: string };
  parentService: { id: string; name: string } | null;
  subServices: { id: string; name: string }[];
};

export type ServiceInput = {
  name: string;
  description: string | null;
  categoryId: string;
  parentServiceId: string | null;
  workTypes: WorkType[];
};

type CatalogState = {
  categories: Category[];
  services: Service[];
  loaded: boolean;
  load: (getToken: GetToken) => Promise<void>;
  saveCategory: (getToken: GetToken, input: { name: string; popular: boolean }, id?: string) => Promise<Category>;
  deleteCategory: (getToken: GetToken, id: string) => Promise<void>;
  saveService: (getToken: GetToken, input: ServiceInput, existing?: Service) => Promise<void>;
  deleteService: (getToken: GetToken, id: string) => Promise<void>;
};

export const useCatalogStore = create<CatalogState>((set, get) => ({
  categories: [],
  services: [],
  loaded: false,

  load: async (getToken) => {
    try {
      const [categories, services] = await Promise.all([
        adminRequest<Category[]>(getToken, '/admin/categories'),
        adminRequest<Service[]>(getToken, '/admin/services'),
      ]);
      set({
        categories: Array.isArray(categories) ? categories : [],
        services: Array.isArray(services) ? services : [],
        loaded: true,
      });
    } catch (e) {
      set({ loaded: true });
      throw e;
    }
  },

  saveCategory: async (getToken, input, id) => {
    const body = { name: input.name.trim(), popular: input.popular };
    if (id) {
      const updated = await adminRequest<Category>(getToken, `/admin/categories/${id}`, { method: 'PATCH', body });
      set({ categories: get().categories.map(c => (c.id === id ? updated : c)) });
      return updated;
    }
    const created = await adminRequest<Category>(getToken, '/admin/categories', { method: 'POST', body });
    set({ categories: [...get().categories, created] });
    return created;
  },

  deleteCategory: async (getToken, id) => {
    await adminRequest(getToken, `/admin/categories/${id}`, { method: 'DELETE' });
    set({ categories: get().categories.filter(c => c.id !== id) });
  },

  saveService: async (getToken, input, existing) => {
    if (existing) {
      const updated = await adminRequest<Service>(getToken, `/admin/services/${existing.id}`, {
        method: 'PATCH',
        body: {
          name: input.name.trim(),
          description: input.description?.trim() || null,
          workTypes: input.workTypes.length > 0 ? input.workTypes : undefined,
        },
      });
      // The PATCH response has no relations — keep the ones we already have.
      const merged = { ...existing, ...updated, category: existing.category, parentService: existing.parentService, subServices: existing.subServices };
      set({ services: get().services.map(s => (s.id === existing.id ? merged : s)) });
      return;
    }
    const body: Record<string, unknown> = {
      name: input.name.trim(),
      categoryId: input.categoryId,
      description: input.description?.trim() || null,
    };
    if (input.parentServiceId) {
      body.parentServiceId = input.parentServiceId;
      if (input.workTypes.length > 0) body.workTypes = input.workTypes;
    }
    await adminRequest(getToken, '/admin/services', { method: 'POST', body });
    // Re-fetch so relations (category, parent, sub-services) are filled in.
    const services = await adminRequest<Service[]>(getToken, '/admin/services');
    set({ services: Array.isArray(services) ? services : get().services });
  },

  deleteService: async (getToken, id) => {
    await adminRequest(getToken, `/admin/services/${id}`, { method: 'DELETE' });
    set({ services: get().services.filter(s => s.id !== id) });
    // Refresh so the parent's option list/count is accurate.
    const services = await adminRequest<Service[]>(getToken, '/admin/services').catch(() => null);
    if (Array.isArray(services)) set({ services });
  },
}));
