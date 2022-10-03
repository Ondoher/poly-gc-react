import React from 'react';
import ReactDOM from 'react-dom';
import App from './App.jsx';
import './styles/gc.css'

export default function main() {
    ReactDOM.render(
        <React.StrictMode>
          <App />
        </React.StrictMode>,
        document.getElementById('main-content')
      );
}

