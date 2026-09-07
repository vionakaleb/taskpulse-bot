import axios from 'axios';

const API_URL = process.env.REESU_API_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 429 comes from the API's own rate limiter (5 login / 10 register attempts
// per minute per IP) - surface the Retry-After it sends instead of the raw
// axios message, and skip the generic "<action> failed:" prefix for it.
function describeError(error: any, action: string): string {
  if (error.response?.status === 429) {
    const retryAfter = Number(error.response.headers?.['retry-after']);
    const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? `${retryAfter}s` : 'a minute';
    return `Too many attempts, please wait ${wait} and try again.`;
  }
  return `${action} failed: ${error.response?.data?.detail || error.message}`;
}

export const ReesuClient = {
  async registerUser(email: string, username: string, password: string) {
    try {
      const response = await client.post('/auth/register', {
        email,
        username,
        password,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(describeError(error, 'Reesu registration'));
    }
  },

  async loginUser(email: string, password: string) {
    try {
      const response = await client.post('/auth/login', {
        email,
        password,
      });
      return response.data; // { access_token, refresh_token }
    } catch (error: any) {
      throw new Error(describeError(error, 'Reesu login'));
    }
  },

  async refreshAccessToken(refreshToken: string) {
    try {
      const response = await client.post('/auth/refresh', {
        refresh_token: refreshToken,
      });
      return response.data; // { access_token, refresh_token }
    } catch (error: any) {
      throw new Error(`Reesu token refresh failed: ${error.response?.data?.detail || error.message}`);
    }
  },

  async createResume(token: string, title: string, content: any) {
    try {
      const response = await client.post(
        '/resumes',
        { title, content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Reesu resume creation failed: ${error.response?.data?.detail || error.message}`);
    }
  },

  async updateResume(token: string, resumeId: string, payload: any) {
    try {
      const response = await client.patch(
        `/resumes/${resumeId}`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Reesu resume update failed: ${error.response?.data?.detail || error.message}`);
    }
  },

  async getResume(token: string, resumeId: string) {
    try {
      const response = await client.get(
        `/resumes/${resumeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Reesu resume fetch failed: ${error.response?.data?.detail || error.message}`);
    }
  },

  async listResumes(token: string) {
    try {
      const response = await client.get(
        '/resumes',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return response.data;
    } catch (error: any) {
      throw new Error(`Reesu list resumes failed: ${error.response?.data?.detail || error.message}`);
    }
  },
};
