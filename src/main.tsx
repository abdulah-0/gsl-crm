/**
 * @fileoverview Application Entry Point
 * 
 * This is the main entry point for the GSL CRM React application.
 * It initializes the React application and mounts it to the DOM.
 * 
 * The application is rendered in React.StrictMode which:
 * - Identifies components with unsafe lifecycles
 * - Warns about legacy string ref API usage
 * - Warns about deprecated findDOMNode usage
 * - Detects unexpected side effects
 * - Detects legacy context API
 * 
 * @module main
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './styles/index.css';

/**
 * Initialize and render the React application
 * 
 * Creates a React root and renders the App component wrapped in StrictMode.
 * The application is mounted to the DOM element with id 'root'.
 * 
 * @see {@link https://react.dev/reference/react-dom/client/createRoot|React createRoot}
 * @see {@link https://react.dev/reference/react/StrictMode|React StrictMode}
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
