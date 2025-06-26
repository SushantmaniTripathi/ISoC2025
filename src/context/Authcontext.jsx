import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

axios.defaults.baseURL = 'https://isoc-backend-e2s8.onrender.com';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('authToken'));


  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        const currentToken = localStorage.getItem('authToken');
        if (currentToken) {
          config.headers.Authorization = `Bearer ${currentToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(interceptor);
    };
  }, []);

  // Check for token in URL (from GitHub callback)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    
    if (urlToken) {
      localStorage.setItem('authToken', urlToken);
      setToken(urlToken);
      
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Fetch user data
      fetchStatus();
    } else if (token) {
      fetchStatus();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchStatus = async () => {
    try {
      const currentToken = localStorage.getItem('authToken');
      if (!currentToken) {
        setUser(null);
        setLoading(false);
        return;
      }

      console.log("Fetching auth status with JWT...");
      
      const res = await axios.get("/api/auth/status", {
        headers: {
          Authorization: `Bearer ${currentToken}`
        }
      });
      
      console.log("Auth status response:", res.data);
      
      if (res.data.loggedIn) {
        const alreadyWelcomed = sessionStorage.getItem("hasWelcomed");
        
        if (!user && !alreadyWelcomed) {
          toast.success(`Welcome, ${res.data.user.displayName || res.data.user.username}!`);
          sessionStorage.setItem("hasWelcomed", "true");
        }
        
        setUser(res.data.user);
      } else {
        // Token might be expired
        localStorage.removeItem('authToken');
        setToken(null);
        setUser(null);
      }
    } catch (err) {
      console.error("Error fetching auth status", err);
      
      if (err.response?.status === 401) {
        // Token expired or invalid
        localStorage.removeItem('authToken');
        setToken(null);
      }
      
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    window.location.href = "https://isoc-backend-e2s8.onrender.com/api/auth/github";
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    sessionStorage.removeItem("hasWelcomed");
    setToken(null);
    setUser(null);
    
   
    window.location.href = "https://isoc-backend-e2s8.onrender.com/api/auth/logout";
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);