import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

// ============================================================================
// APPLICATION ENTRY POINT
// ============================================================================

/**
 * Bootstraps the React application.
 * Wraps the root App component in StrictMode to highlight potential problems
 * in an application during development.
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Failed to find the root element to mount the React application.");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
