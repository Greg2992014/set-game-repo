import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

console.log('[DIAG] main.jsx: mounting app');
const root = document.getElementById('root');
console.log('[DIAG] root element:', root);
ReactDOM.createRoot(root).render(<App />);