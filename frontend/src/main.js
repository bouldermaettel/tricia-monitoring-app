import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppRouter } from './app/router';
import { AppProviders } from './app/providers';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(AppProviders, { children: _jsx(AppRouter, {}) }) }));
