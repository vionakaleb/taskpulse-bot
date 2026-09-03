import axios from 'axios';

const API_URL = process.env.REESU_API_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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
      throw new Error(`Reesu registration failed: ${error.response?.data?.detail || error.message}`);
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
      throw new Error(`Reesu login failed: ${error.response?.data?.detail || error.message}`);
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
