import axios from 'axios';
import { getAPIBaseURL } from './config';
import { getStoredToken } from './auth';

// This file used to import the proprietary "@metagptx/web-sdk" (Atoms/MGX
// platform SDK), which talks to Atoms' own hosted database and only works
// inside their platform. It has been replaced with a small facade that
// keeps the exact same shape (client.auth.*, client.entities.X.query/get/create)
// but talks to our own backend on Railway instead.

const http = axios.create();

http.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

function baseUrl() {
  return getAPIBaseURL();
}

interface QueryOptions {
  query?: Record<string, unknown>;
  sort?: string;
  limit?: number;
  skip?: number;
  fields?: string;
}

function makeEntity(entityName: string) {
  return {
    async query(options: QueryOptions = {}) {
      const params: Record<string, string | number> = {};
      if (options.query) params.query = JSON.stringify(options.query);
      if (options.sort) params.sort = options.sort;
      if (options.limit !== undefined) params.limit = options.limit;
      if (options.skip !== undefined) params.skip = options.skip;
      if (options.fields) params.fields = options.fields;

      // "/all" is the public, unauthenticated listing endpoint on our
      // backend (anyone can browse products/categories without logging in).
      const response = await http.get(`${baseUrl()}/api/v1/entities/${entityName}/all`, { params });
      return { data: response.data };
    },

    async get({ id }: { id: string | number }) {
      const response = await http.get(`${baseUrl()}/api/v1/entities/${entityName}/${id}`);
      return { data: response.data };
    },

    async create({ data }: { data: Record<string, unknown> }) {
      const response = await http.post(`${baseUrl()}/api/v1/entities/${entityName}`, data);
      return { data: response.data };
    },

    async update({ id, data }: { id: string | number; data: Record<string, unknown> }) {
      const response = await http.put(`${baseUrl()}/api/v1/entities/${entityName}/${id}`, data);
      return { data: response.data };
    },

    async delete({ id }: { id: string | number }) {
      const response = await http.delete(`${baseUrl()}/api/v1/entities/${entityName}/${id}`);
      return { data: response.data };
    },
  };
}

export const client = {
  auth: {
    async me() {
      const token = getStoredToken();
      if (!token) return { data: null };
      try {
        const response = await http.get(`${baseUrl()}/api/v1/auth/me`);
        return { data: response.data };
      } catch {
        return { data: null };
      }
    },
    toLogin() {
      window.location.href = '/login';
    },
  },
  entities: {
    categories: makeEntity('categories'),
    products: makeEntity('products'),
    favorites: makeEntity('favorites'),
    messages: makeEntity('messages'),
    seller_profiles: makeEntity('seller_profiles'),
  },
};
