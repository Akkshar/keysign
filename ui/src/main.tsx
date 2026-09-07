import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import 'material-symbols/outlined.css';        // icon font bundled locally: the demo must work offline
import '@fontsource-variable/jetbrains-mono';  // and the mono, for the same reason
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
