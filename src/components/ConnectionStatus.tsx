"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ConnectionStatus() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error'>('loading');
  const [details, setDetails] = useState<any>(null);
  const [expanded, setExpanded] = useState(false);
  
  useEffect(() => {
    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);
  
  const checkConnection = async () => {
    try {
      const response = await fetch('/api/db-status');
      const data = await response.json();
      
      if (data.healthy) {
        setStatus('connected');
      } else {
        setStatus('error');
      }
      
      setDetails(data);
    } catch (err) {
      setStatus('error');
      setDetails(null);
    }
  };
  
  if (status === 'loading') {
    return null;
  }
  
  if (status === 'connected') {
    return null;
  }
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-lg max-w-md">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium">
              Database connection issues detected
            </p>
            
            <div className="mt-2">
              <button 
                className="text-sm text-red-800 underline"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? 'Hide details' : 'Show details'}
              </button>
              
              {expanded && details && (
                <div className="mt-2 text-xs">
                  <p><strong>Connection:</strong> {details.connection?.message}</p>
                  {details.connection?.error && (
                    <p className="mt-1"><strong>Error:</strong> {details.connection.error}</p>
                  )}
                  <div className="mt-3">
                    <Link 
                      href="/api/db-diagnostic" 
                      className="bg-red-700 text-white px-3 py-1 rounded text-xs"
                    >
                      Open Database Diagnostic
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}