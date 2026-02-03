import './utils/terminalLogger.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import CompanyPage from './pages/CompanyPage.jsx';
import '../CSS/style.css';
import '../CSS/company.css';

const root = document.getElementById('root');
createRoot(root).render(<CompanyPage />);
