/**
 * Generic API client using native fetch with timeout, token injection, and error handling
 */
export const request = async (url, options = {}) => {
  const timeoutMs = options.timeout || 10000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type');
    let responseData;
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      const message =
        responseData && typeof responseData === 'object' && responseData.message
          ? responseData.message
          : typeof responseData === 'string'
          ? responseData
          : `Request failed with status ${response.status}`;

      const error = new Error(message);
      error.status = response.status;
      error.data = responseData;
      throw error;
    }

    return {
      status: response.status,
      ok: response.ok,
      data: responseData
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      const timeoutErr = new Error(`Request timed out after ${timeoutMs / 1000}s. Check your backend server connection.`);
      timeoutErr.status = 408;
      throw timeoutErr;
    }
    throw error;
  }
};
