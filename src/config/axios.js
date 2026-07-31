import axios from 'axios';

// Secure Axios client for external API integrations
export const apiClient = axios.create({
  timeout: 10000, // 10s default timeout
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Sanitize headers or attach authorization if needed
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling & response normalization
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const errorResponse = {
      status: error.response?.status || 500,
      message: error.response?.data?.message || 'External service call failed',
    };
    return Promise.reject(errorResponse);
  }
);
