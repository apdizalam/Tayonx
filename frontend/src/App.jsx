import React, { useEffect, useState } from 'react';
import { socket } from './socket';

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to Tayonx Socket Server:', socket.id);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Disconnected from Socket Server');
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
    };
  }, []);

  return (
    <div style={{ padding: '40px', fontFamily: 'Arial', textAlign: 'center' }}>
      <h1>Tayonx Multivendor Cargo Platform</h1>
      <p style={{ fontSize: '18px', marginTop: '20px' }}>
        Backend Socket Status: {' '}
        <span style={{ color: isConnected ? 'green' : 'red', fontWeight: 'bold' }}>
          {isConnected ? '🟢 Connected (Real-Time Active)' : '🔴 Disconnected'}
        </span>
      </p>
    </div>
  );
}

export default App;