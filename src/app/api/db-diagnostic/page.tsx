"use client";

import { useState, useEffect } from 'react';

export default function DbDiagnosticPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);
  const [resetResponse, setResetResponse] = useState<any>(null);
  const [resetCommand, setResetCommand] = useState<string>('push');
  const [confirmation, setConfirmation] = useState<string>('');
  const [resetLoading, setResetLoading] = useState(false);
  
  useEffect(() => {
    fetchStatus();
  }, []);
  
  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/db-status');
      const data = await response.json();
      setStatus(data);
    } catch (err: any) {
      setError(`Failed to fetch database status: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (confirmation !== 'CONFIRM_RESET_DB') {
      setError('You must type CONFIRM_RESET_DB to confirm');
      return;
    }
    
    setResetLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/db-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: resetCommand,
          confirm: confirmation
        }),
      });
      
      const data = await response.json();
      setResetResponse(data);
      
      // Refresh status after reset
      if (response.ok) {
        setTimeout(fetchStatus, 2000);
      }
    } catch (err: any) {
      setError(`Failed to reset database: ${err.message}`);
    } finally {
      setResetLoading(false);
    }
  };
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Database Diagnostic Tool</h1>
      
      <div className="flex space-x-4 mb-6">
        <button 
          onClick={fetchStatus}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Check Database Status'}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {status && (
        <div className="bg-gray-100 p-4 rounded mb-6">
          <h2 className="text-xl font-semibold mb-2">Database Status</h2>
          <div className="grid grid-cols-2 gap-2">
            <div>Status:</div>
            <div className={status.healthy ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
              {status.healthy ? 'Healthy' : 'Issues Detected'}
            </div>
            
            <div>Connection:</div>
            <div className={status.connection.success ? 'text-green-600' : 'text-red-600'}>
              {status.connection.success ? 'Connected' : 'Failed'}
            </div>
            
            <div>Schema:</div>
            <div className={status.schema?.success ? 'text-green-600' : 'text-red-600'}>
              {status.schema?.success ? 'Valid' : 'Invalid/Missing'}
            </div>
            
            {status.tables && (
              <>
                <div>Users:</div>
                <div>{status.tables.userCount}</div>
                
                <div>Sessions:</div>
                <div>{status.tables.sessionCount}</div>
              </>
            )}
            
            <div>Timestamp:</div>
            <div>{new Date(status.timestamp).toLocaleString()}</div>
          </div>
          
          {!status.connection.success && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <h3 className="font-semibold">Connection Error:</h3>
              <pre className="text-sm overflow-auto p-2">{status.connection.error}</pre>
            </div>
          )}
          
          {status.connection.success && !status.schema?.success && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
              <h3 className="font-semibold">Schema Error:</h3>
              <pre className="text-sm overflow-auto p-2">{status.schema?.error}</pre>
            </div>
          )}
        </div>
      )}
      
      <div className="bg-yellow-50 p-4 border border-yellow-200 rounded mb-6">
        <h2 className="text-xl font-semibold mb-2">Database Reset Tools</h2>
        <p className="text-red-600 font-bold mb-4">WARNING: These operations will modify your database!</p>
        
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="block mb-2">Select Action:</label>
            <select 
              value={resetCommand}
              onChange={(e) => setResetCommand(e.target.value)}
              className="w-full p-2 border rounded"
            >
              <option value="push">Push Schema (Apply schema without data loss)</option>
              <option value="migrate">Run Migrations (Create migration files)</option>
              <option value="reset">Reset Database (Delete all data)</option>
            </select>
          </div>
          
          <div>
            <label className="block mb-2">Type "CONFIRM_RESET_DB" to confirm:</label>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="CONFIRM_RESET_DB"
            />
          </div>
          
          <button
            type="submit"
            disabled={resetLoading}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            {resetLoading ? 'Processing...' : 'Execute Command'}
          </button>
        </form>
        
        {resetResponse && (
          <div className={`mt-4 p-3 rounded ${resetResponse.message?.includes('successfully') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <h3 className="font-semibold">Reset Result:</h3>
            <pre className="text-sm overflow-auto p-2">{JSON.stringify(resetResponse, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
} 