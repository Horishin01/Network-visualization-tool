import './utils/terminalLogger.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import AboutPage from './pages/AboutPage.jsx';
import '../CSS/style.css';
import '../CSS/about.css';

const root = document.getElementById('root');
createRoot(root).render(<AboutPage />);
