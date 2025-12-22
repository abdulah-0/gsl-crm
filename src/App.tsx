/**
 * @fileoverview Main Application Component
 * 
 * This is the root component of the GSL CRM application. It serves as the entry point
 * for the React component tree and renders the application's routing configuration.
 * 
 * The application is a comprehensive CRM system for managing:
 * - Leads and student enrollments
 * - Teachers and consultants
 * - Cases and daily tasks
 * - Financial records
 * - University applications
 * - HR management and employee records
 * 
 * @module App
 */

import React from 'react';
import Routes from './Routes';

/**
 * App Component
 * 
 * The root component that initializes the application and renders the routing system.
 * All application routes and protected routes are configured in the Routes component.
 * 
 * @component
 * @returns {JSX.Element} The application root with routing configuration
 * 
 * @example
 * ```tsx
 * // In main.tsx
 * ReactDOM.createRoot(document.getElementById('root')!).render(
 *   <React.StrictMode>
 *     <App />
 *   </React.StrictMode>
 * );
 * ```
 */
const App: React.FC = () => {
  return (
    <Routes />
  );
};

export default App;
