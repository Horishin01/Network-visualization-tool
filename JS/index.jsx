import './utils/terminalLogger.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import IndexPage from './pages/IndexPage.jsx';
import '../CSS/style.css';
import '../CSS/index.css';

const root = document.getElementById('root');
createRoot(root).render(<IndexPage />);
