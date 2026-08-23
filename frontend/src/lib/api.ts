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

    // The base endpoint (no "/all") requires auth and is automatically
    // scoped to the logged-in user on the backend, so this returns only
    // "my" products / favorites / messages, etc.
    async mine(options: QueryOptions = {}) {
      const params: Record<string, string | number> = {};
      if (options.query) params.query = JSON.stringify(options.query);
      if (options.sort) params.sort = options.sort;
      if (options.limit !== undefined) params.limit = options.limit;
      if (options.skip !== undefined) params.skip = options.skip;
      if (options.fields) params.fields = options.fields;

      const response = await http.get(`${baseUrl()}/api/v1/entities/${entityName}`, { params });
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
  professionalProfiles: {
    async getSpecialties() {
      const response = await http.get(`${baseUrl()}/api/v1/entities/professional_profiles/specialties`);
      return { data: response.data as string[] };
    },
    async list(params: { specialty?: string; province?: string; search?: string; skip?: number; limit?: number } = {}) {
      const response = await http.get(`${baseUrl()}/api/v1/entities/professional_profiles`, { params });
      return { data: response.data as { items: ProfessionalProfile[]; total: number } };
    },
    async get(id: number) {
      const response = await http.get(`${baseUrl()}/api/v1/entities/professional_profiles/${id}`);
      return { data: response.data as ProfessionalProfile };
    },
    async getMine() {
      const response = await http.get(`${baseUrl()}/api/v1/entities/professional_profiles/mine`);
      return { data: response.data as ProfessionalProfile | null };
    },
    async create(payload: Partial<ProfessionalProfile>) {
      const response = await http.post(`${baseUrl()}/api/v1/entities/professional_profiles`, payload);
      return { data: response.data as ProfessionalProfile };
    },
    async update(id: number, payload: Partial<ProfessionalProfile>) {
      const response = await http.put(`${baseUrl()}/api/v1/entities/professional_profiles/${id}`, payload);
      return { data: response.data as ProfessionalProfile };
    },
    async remove(id: number) {
      const response = await http.delete(`${baseUrl()}/api/v1/entities/professional_profiles/${id}`);
      return { data: response.data as { message: string; id: number } };
    },
  },
  users: {
    async getProfile() {
      const response = await http.get(`${baseUrl()}/api/v1/users/profile`);
      return { data: response.data };
    },
    async updateProfile(data: { name?: string; avatar_url?: string }) {
      const response = await http.put(`${baseUrl()}/api/v1/users/profile`, data);
      return { data: response.data };
    },
    async suspendAccount(reasons?: string, feedback?: string) {
      const response = await http.post(`${baseUrl()}/api/v1/users/account/suspend`, { reasons, feedback });
      return { data: response.data };
    },
    async deleteAccount(reasons?: string, feedback?: string) {
      const response = await http.post(`${baseUrl()}/api/v1/users/account/delete`, { reasons, feedback });
      return { data: response.data };
    },
  },
  storage: {
    /**
     * Uploads a single image file directly to Cloudflare R2 using a
     * short-lived presigned URL obtained from our backend, and returns the
     * public URL where the image will be accessible.
     */
    async uploadImage(file: File, folder: 'products' | 'avatars' | 'ads'): Promise<string> {
      const presignResponse = await http.post(`${baseUrl()}/api/v1/storage/presigned-upload`, {
        filename: file.name,
        content_type: file.type,
        folder,
      });
      const { upload_url, public_url } = presignResponse.data;

      // Upload directly to R2 (not through our backend) using plain fetch,
      // since this request must NOT include our own Authorization header.
      const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('No se pudo subir la imagen');
      }

      return public_url;
    },
  },
  conversations: {
    async list() {
      const response = await http.get(`${baseUrl()}/api/v1/messages/conversations`);
      return { data: response.data };
    },
    async unreadCount() {
      const response = await http.get(`${baseUrl()}/api/v1/messages/unread-count`);
      return { data: response.data as { count: number } };
    },
    async getThread(productId: number | string, otherUserId: string) {
      const response = await http.get(`${baseUrl()}/api/v1/messages/conversations/${productId}/${otherUserId}`);
      return { data: response.data };
    },
  },
  payments: {
    async createCheckout(plan: 'basico' | 'profesional') {
      const response = await http.post(`${baseUrl()}/api/v1/payments/checkout`, { plan });
      return { data: response.data as { url: string } };
    },
    async getFeaturePrices() {
      const response = await http.get(`${baseUrl()}/api/v1/payments/feature-listing/prices`);
      return { data: response.data as Record<string, number> };
    },
    async featureListing(productId: number, days: 3 | 7 | 30) {
      const response = await http.post(`${baseUrl()}/api/v1/payments/feature-listing`, {
        product_id: productId,
        days,
      });
      return { data: response.data as { url: string } };
    },
    async cancelSubscription() {
      const response = await http.post(`${baseUrl()}/api/v1/payments/subscription/cancel`, {});
      return { data: response.data as SubscriptionActionResult };
    },
    async resumeSubscription() {
      const response = await http.post(`${baseUrl()}/api/v1/payments/subscription/resume`, {});
      return { data: response.data as SubscriptionActionResult };
    },
    async changePlan(plan: 'basico' | 'profesional') {
      const response = await http.post(`${baseUrl()}/api/v1/payments/subscription/change-plan`, { plan });
      return { data: response.data as SubscriptionActionResult };
    },
  },
  houseAds: {
    async getForSlot(slot: string) {
      const response = await http.get(`${baseUrl()}/api/v1/house-ads/${slot}`);
      return { data: response.data as { slot: string; title: string; image_url: string; link_url: string } | null };
    },
  },
  reviews: {
    async list(sellerProfileId: number) {
      const response = await http.get(`${baseUrl()}/api/v1/entities/reviews`, {
        params: { seller_profile_id: sellerProfileId },
      });
      return { data: response.data as { items: Review[]; total: number; average_rating: number } };
    },
    async submit(sellerProfileId: number, rating: number, comment?: string) {
      const response = await http.post(`${baseUrl()}/api/v1/entities/reviews`, {
        seller_profile_id: sellerProfileId,
        rating,
        comment,
      });
      return { data: response.data as Review };
    },
  },
  waitlist: {
    async join(email: string) {
      const response = await http.post(`${baseUrl()}/api/v1/waitlist/join`, { email });
      return { data: response.data as { success: boolean; message: string } };
    },
  },
  admin: {
    async listSellers(search?: string) {
      const response = await http.get(`${baseUrl()}/api/v1/admin/sellers`, {
        params: search ? { search } : {},
      });
      return { data: response.data as AdminSeller[] };
    },
    async grantFreeAccess(sellerProfileId: number, months: number | null) {
      const response = await http.post(`${baseUrl()}/api/v1/admin/sellers/${sellerProfileId}/free-access`, {
        months,
      });
      return { data: response.data as AdminSeller };
    },
    async listInvitations() {
      const response = await http.get(`${baseUrl()}/api/v1/admin/invitations`);
      return { data: response.data as AdminInvitation[] };
    },
    async createInvitation(email: string, months: number) {
      const response = await http.post(`${baseUrl()}/api/v1/admin/invitations`, { email, months });
      return { data: response.data as AdminInvitation };
    },
    async listStaff() {
      const response = await http.get(`${baseUrl()}/api/v1/admin/staff`);
      return { data: response.data as StaffMember[] };
    },
    async getDashboard() {
      const response = await http.get(`${baseUrl()}/api/v1/admin/dashboard`);
      return { data: response.data as DashboardStats };
    },
    async listUsers(params: { search?: string; status?: string; skip?: number; limit?: number } = {}) {
      const response = await http.get(`${baseUrl()}/api/v1/admin/users`, { params });
      return { data: response.data as { items: AdminUser[]; total: number } };
    },
    async banUser(userId: string, reason?: string) {
      const response = await http.post(`${baseUrl()}/api/v1/admin/users/${userId}/ban`, { reason });
      return { data: response.data as AdminUser };
    },
    async unbanUser(userId: string) {
      const response = await http.post(`${baseUrl()}/api/v1/admin/users/${userId}/unban`, {});
      return { data: response.data as AdminUser };
    },
    async listProducts(params: { search?: string; status?: string; skip?: number; limit?: number } = {}) {
      const response = await http.get(`${baseUrl()}/api/v1/admin/products`, { params });
      return { data: response.data as { items: AdminProduct[]; total: number } };
    },
    async removeProduct(productId: number) {
      const response = await http.post(`${baseUrl()}/api/v1/admin/products/${productId}/remove`, {});
      return { data: response.data as AdminProduct };
    },
    async restoreProduct(productId: number) {
      const response = await http.post(`${baseUrl()}/api/v1/admin/products/${productId}/restore`, {});
      return { data: response.data as AdminProduct };
    },
    async deleteProductAdmin(productId: number) {
      const response = await http.delete(`${baseUrl()}/api/v1/admin/products/${productId}`);
      return { data: response.data as { message: string; id: number } };
    },
    async listConversationsAdmin(search?: string) {
      const response = await http.get(`${baseUrl()}/api/v1/admin/conversations`, {
        params: search ? { search } : {},
      });
      return { data: response.data as AdminConversation[] };
    },
    async getSupportThread(userId: string) {
      const response = await http.get(`${baseUrl()}/api/v1/admin/users/${userId}/messages`);
      return { data: response.data as AdminChatMessage[] };
    },
    async sendSupportMessage(userId: string, content: string) {
      const response = await http.post(`${baseUrl()}/api/v1/admin/users/${userId}/messages`, { content });
      return { data: response.data as AdminChatMessage };
    },
    async getAuditLog(skip = 0, limit = 100) {
      const response = await http.get(`${baseUrl()}/api/v1/admin/audit-log`, { params: { skip, limit } });
      return { data: response.data as AuditLogEntry[] };
    },
    async getSecurityOverview() {
      const response = await http.get(`${baseUrl()}/api/v1/admin/security`);
      return { data: response.data as SecurityOverview };
    },
    async listHouseAds() {
      const response = await http.get(`${baseUrl()}/api/v1/admin/house-ads`);
      return { data: response.data as HouseAdAdmin[] };
    },
    async upsertHouseAd(slot: string, payload: { title: string; image_url: string; link_url: string; active: boolean }) {
      const response = await http.put(`${baseUrl()}/api/v1/admin/house-ads/${slot}`, payload);
      return { data: response.data as HouseAdAdmin };
    },
    async deleteHouseAd(slot: string) {
      const response = await http.delete(`${baseUrl()}/api/v1/admin/house-ads/${slot}`);
      return { data: response.data as { message: string; slot: string } };
    },
    async assignRole(email: string, role: string) {
      const response = await http.post(`${baseUrl()}/api/v1/admin/staff/assign-role`, { email, role });
      return { data: response.data as StaffMember };
    },
  },
};

export interface AdminSeller {
  id: number;
  user_id: string;
  email?: string | null;
  name?: string | null;
  shop_name: string;
  subscription_status?: string | null;
  free_listing_used: boolean;
  free_access_until?: string | null;
}

export interface AdminInvitation {
  id: number;
  email: string;
  months: number;
  status: string;
  created_at?: string | null;
  redeemed_at?: string | null;
}

export interface StaffMember {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  role_label: string;
}

export interface DashboardStats {
  total_users: number;
  new_users_last_7_days: number;
  total_sellers: number;
  active_subscriptions: number;
  basico_count: number;
  profesional_count: number;
  estimated_mrr: number;
  total_products: number;
  active_products: number;
  waitlist_count: number;
  invitations_sent: number;
  invitations_redeemed: number;
  google_accounts: number;
  password_accounts: number;
}

export interface AdminUser {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  account_status: string;
  created_at?: string | null;
  last_login?: string | null;
}

export interface AdminProduct {
  id: number;
  user_id: string;
  seller_email?: string | null;
  title: string;
  price: number;
  status?: string | null;
  images?: string | null;
  created_at?: string | null;
}

export interface AdminConversation {
  product_id: number;
  product_title: string;
  buyer_email?: string | null;
  seller_email?: string | null;
  last_message: string;
  last_message_at?: string | null;
  message_count: number;
}

export interface AdminChatMessage {
  id: number;
  user_id: string;
  sender_email?: string | null;
  content: string;
  created_at?: string | null;
  is_from_staff: boolean;
}

export interface AuditLogEntry {
  id: number;
  actor_email?: string | null;
  action: string;
  target?: string | null;
  details?: string | null;
  created_at?: string | null;
}

export interface LoginAttemptEntry {
  id: number;
  email: string;
  method: string;
  success: boolean;
  reason?: string | null;
  ip_address?: string | null;
  created_at?: string | null;
}

export interface SecurityOverview {
  recent_attempts: LoginAttemptEntry[];
  failed_last_24h: number;
  suspicious_emails: string[];
}

export interface SubscriptionActionResult {
  subscription_status?: string | null;
  plan?: string | null;
  cancel_at_period_end?: boolean | null;
  subscription_end_date?: string | null;
}

export interface Review {
  id: number;
  seller_profile_id: number;
  reviewer_user_id: string;
  reviewer_name?: string | null;
  rating: number;
  comment?: string | null;
  created_at?: string | null;
}

export interface HouseAdAdmin {
  id?: number | null;
  slot: string;
  title?: string | null;
  image_url?: string | null;
  link_url?: string | null;
  active: boolean;
}

export interface ProfessionalProfile {
  id: number;
  user_id: string;
  business_name: string;
  specialty: string;
  description?: string | null;
  province: string;
  city?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  portfolio_images?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
}
