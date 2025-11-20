import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';

// Clear old OSM cache on startup to prevent quota issues
try {
  const keys = Object.keys(sessionStorage);
  const osmKeys = keys.filter(key => key.startsWith('osm-cache-'));
  if (osmKeys.length > 0) {
    osmKeys.forEach(key => sessionStorage.removeItem(key));
    console.log(`🗑️ Cleared ${osmKeys.length} old OSM cache entries on startup`);
  }
} catch (e) {
  console.warn('Could not clear OSM cache on startup:', e);
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);