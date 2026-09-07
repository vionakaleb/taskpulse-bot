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

// Wraps an axios error into a plain Error, preserving the HTTP status code
// (used by reesuAuth's withReesuAuth to detect an expired access token and
// transparently retry after a refresh).
function wrapError(error: any, action: string): Error {
  const wrapped = new Error(describeError(error, action));
  (wrapped as any).status = error.response?.status;
  return wrapped;
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
      throw wrapError(error, 'Reesu resume creation');
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
      throw wrapError(error, 'Reesu resume update');
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
      throw wrapError(error, 'Reesu resume fetch');
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
      throw wrapError(error, 'Reesu list resumes');
    }
  },

  async deleteResume(token: string, resumeId: string) {
    try {
      await client.delete(
        `/resumes/${resumeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return true;
    } catch (error: any) {
      throw wrapError(error, 'Reesu resume deletion');
    }
  },
};
