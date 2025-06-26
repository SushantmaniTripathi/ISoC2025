// AuthContext.js - Updated with proper cookie handling
import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

// Configure axios globally with enhanced settings
axios.defaults.withCredentials = true; // This is crucial for cookies
axios.defaults.baseURL = 'https://isoc-backend-e2s8.onrender.com';

// Add request interceptor for debugging
axios.interceptors.request.use(
  (config) => {
    console.log('Making request:', {
      url: config.url,
      method: config.method,
      withCredentials: config.withCredentials,
      headers: config.headers
    });
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for debugging
axios.interceptors.response.use(
  (response) => {
    console.log('Response received:', {
      url: response.config.url,
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    console.error('Response interceptor error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message
    });
    return Promise.reject(error);
  }
);

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async (retryCount = 0) => {
    try {
      console.log(`Fetching auth status (attempt ${retryCount + 1})...`);
      
      const res = await axios.get("/api/auth/status", {
        timeout: 15000,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
        // Explicitly set withCredentials for this request
        withCredentials: true
      });
      
      console.log("Auth status response:", res.data);
      
      const newUser = res.data.loggedIn ? res.data.user : null;
      const alreadyWelcomed = sessionStorage.getItem("hasWelcomed");

      // Check if we just came from GitHub auth
      const urlParams = new URLSearchParams(window.location.search);
      const authSuccess = urlParams.get('auth') === 'success';

      if (!user && newUser && (!alreadyWelcomed || authSuccess)) {
        toast.success(`Welcome, ${newUser.displayName || newUser.username}!`);
        sessionStorage.setItem("hasWelcomed", "true");
        
        // Clean up URL params
        if (authSuccess) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      setUser(newUser);
      
      // If we expected to be authenticated but aren't, and this is after a redirect
      if (!newUser && authSuccess && retryCount < 2) {
        console.log("Auth expected but not found, retrying...");
        setTimeout(() => fetchStatus(retryCount + 1), 2000);
        return;
      }
      
    } catch (err) {
      console.error("Error fetching auth status:", err);
      
      // Only retry on network errors, not auth failures
      if (retryCount === 0 && err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        console.log("Network error, retrying auth status check...");
        setTimeout(() => fetchStatus(1), 2000);
        return;
      }
      
      setUser(null);
    } finally {
      if (retryCount > 0 || !window.location.search.includes('auth=success')) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    // Check if we're coming back from GitHub OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const authSuccess = urlParams.get('auth') === 'success';
    
    if (authSuccess) {
      // Add a delay for GitHub OAuth callback
      setTimeout(() => {
        fetchStatus();
      }, 1000);
    } else {
      fetchStatus();
    }
  }, []);

  const login = () => {
    // Clear any existing session storage
    sessionStorage.removeItem("hasWelcomed");
    
    // Redirect to GitHub OAuth
    window.location.href = "https://isoc-backend-e2s8.onrender.com/api/auth/github";
  };

  const logout = async () => {
    try {
      sessionStorage.removeItem("hasWelcomed");
      setUser(null);
      
      // Make logout request
      await axios.get("/api/auth/logout", { withCredentials: true });
      
      // Redirect after logout
      window.location.href = "https://www.ieeesoc.xyz/repos";
    } catch (error) {
      console.error("Logout error:", error);
      // Force redirect even if logout request fails
      window.location.href = "https://isoc-backend-e2s8.onrender.com/api/auth/logout";
    }
  };

  // Function to manually refresh auth status
  const refreshAuth = () => {
    setLoading(true);
    fetchStatus();
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      logout, 
      fetchStatus: refreshAuth 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};