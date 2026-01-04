import './utils/terminalLogger.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import HomePage from './pages/HomePage.jsx';
import '../CSS/style.css';
import '../CSS/home.css';

const root = document.getElementById('root');
createRoot(root).render(<HomePage />);
