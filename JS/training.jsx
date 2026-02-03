import './utils/terminalLogger.js';
import React from 'react';
import { createRoot } from 'react-dom/client';
import TrainingPage from './pages/TrainingPage.jsx';
import 'leaflet/dist/leaflet.css';
import '../CSS/style.css';
import '../CSS/training.css';

const root = document.getElementById('root');
createRoot(root).render(<TrainingPage />);
