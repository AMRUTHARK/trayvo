import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { clearAuth, isAuthenticated } from './auth';
import { SESSION_CONFIG } from './constants';
import toast from 'react-hot-toast';

interface UseSessionTimeoutReturn {
  showWarning: boolean;
  timeRemaining: number;
  resetSession: () => void;
  logoutNow: () => void;
}

export function useSessionTimeout(): UseSessionTimeoutReturn {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Update last activity time
  const updateLastActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    localStorage.setItem(SESSION_CONFIG.LAST_ACTIVITY_KEY, now.toString());
  }, []);

  // Reset session timer
  const resetSession = useCallback(() => {
    // Clear existing timeouts and intervals
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // Hide warning modal
    setShowWarning(false);
    setTimeRemaining(0);

    // Update activity time
    updateLastActivity();

    // Set warning timeout (28 minutes)
    const warningTime = SESSION_CONFIG.INACTIVITY_TIMEOUT - SESSION_CONFIG.WARNING_TIME;
    warningTimeoutRef.current = setTimeout(() => {
      setShowWarning(true);
      setTimeRemaining(SESSION_CONFIG.WARNING_TIME);
      
      // Start countdown
      countdownIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1000) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }, warningTime);

    // Set logout timeout (30 minutes)
    timeoutRef.current = setTimeout(() => {
      // Clear auth data and activity
      clearAuth();
      localStorage.removeItem(SESSION_CONFIG.LAST_ACTIVITY_KEY);
      toast.error('Session expired due to inactivity');
      router.push('/login');
    }, SESSION_CONFIG.INACTIVITY_TIMEOUT);
  }, [updateLastActivity, router]);

  // Handle logout
  const handleLogout = useCallback(() => {
    // Clear all timeouts and intervals
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // Clear auth data and activity
    clearAuth();
    localStorage.removeItem(SESSION_CONFIG.LAST_ACTIVITY_KEY);
    
    // Show logout message
    toast.error('Session expired due to inactivity');
    
    // Redirect to login
    router.push('/login');
  }, [router]);

  // Logout immediately
  const logoutNow = useCallback(() => {
    handleLogout();
  }, [handleLogout]);

  // Activity event handlers
  useEffect(() => {
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    const handleActivity = () => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;
      
      // Only reset if user has been inactive for at least 1 minute
      // This prevents constant resets on every tiny movement
      if (timeSinceLastActivity > 60000) {
        resetSession();
      } else {
        updateLastActivity();
      }
    };

    // Only initialize if user is authenticated
    if (!isAuthenticated()) {
      return;
    }

    // Add event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Initialize session on mount
    const lastActivity = localStorage.getItem(SESSION_CONFIG.LAST_ACTIVITY_KEY);
    if (lastActivity) {
      const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
      if (timeSinceLastActivity < SESSION_CONFIG.INACTIVITY_TIMEOUT) {
        // Resume session with remaining time
        const remainingTime = SESSION_CONFIG.INACTIVITY_TIMEOUT - timeSinceLastActivity;
        if (remainingTime <= SESSION_CONFIG.WARNING_TIME) {
          // Already past warning time
          setShowWarning(true);
          setTimeRemaining(remainingTime);
          
          // Start countdown immediately
          countdownIntervalRef.current = setInterval(() => {
            setTimeRemaining((prev) => {
              if (prev <= 1000) {
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current);
                  countdownIntervalRef.current = null;
                }
                return 0;
              }
              return prev - 1000;
            });
          }, 1000);
        } else {
          // Set warning and logout timers based on remaining time
          const warningTime = remainingTime - SESSION_CONFIG.WARNING_TIME;
          warningTimeoutRef.current = setTimeout(() => {
            setShowWarning(true);
            setTimeRemaining(SESSION_CONFIG.WARNING_TIME);
            
            countdownIntervalRef.current = setInterval(() => {
              setTimeRemaining((prev) => {
                if (prev <= 1000) {
                  if (countdownIntervalRef.current) {
                    clearInterval(countdownIntervalRef.current);
                    countdownIntervalRef.current = null;
                  }
                  return 0;
                }
                return prev - 1000;
              });
            }, 1000);
          }, warningTime);
        }
        
        timeoutRef.current = setTimeout(() => {
          clearAuth();
          localStorage.removeItem(SESSION_CONFIG.LAST_ACTIVITY_KEY);
          toast.error('Session expired due to inactivity');
          router.push('/login');
        }, remainingTime);
      } else {
        // Session already expired
        clearAuth();
        localStorage.removeItem(SESSION_CONFIG.LAST_ACTIVITY_KEY);
        toast.error('Session expired due to inactivity');
        router.push('/login');
      }
    } else {
      // First time, start fresh session
      resetSession();
    }

    // Cleanup
    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [resetSession, router, updateLastActivity]);

  return {
    showWarning,
    timeRemaining,
    resetSession,
    logoutNow,
  };
}

