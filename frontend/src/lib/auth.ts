import axios, { AxiosInstance } from 'axios';
import { getAPIBaseURL } from './config';

const TOKEN_KEY = 'vc_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

class RPApi {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Attach the saved token (if any) to every request automatically
    this.client.interceptors.request.use((config) => {
      const token = getStoredToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = `Bearer ${token}`;
      }
      return config;
    });
  }

  private getBaseURL() {
    return getAPIBaseURL();
  }

  async getCurrentUser() {
    const token = getStoredToken();
    if (!token) {
      return null;
    }
    try {
      const response = await this.client.get(`${this.getBaseURL()}/api/v1/auth/me`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        clearStoredToken();
        return null;
      }
      throw new Error(error.response?.data?.detail || 'Failed to get user info');
    }
  }

  async register(email: string, password: string, name?: string, captchaToken?: string) {
    try {
      const response = await this.client.post(`${this.getBaseURL()}/api/v1/auth/register`, {
        email,
        password,
        name,
        captcha_token: captchaToken,
        // The caller only invokes register() after the "soy mayor de 18
        // años" checkbox has been validated client-side — see Login.tsx.
        age_confirmed: true,
      });
      setStoredToken(response.data.token);
      return response.data.user;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'No se pudo crear la cuenta');
    }
  }

  async login(email: string, password: string) {
    try {
      const response = await this.client.post(`${this.getBaseURL()}/api/v1/auth/login`, {
        email,
        password,
      });
      setStoredToken(response.data.token);
      return response.data.user;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Email o contraseña incorrectos');
    }
  }

  async logout() {
    clearStoredToken();
  }
}

export const authApi = new RPApi();
