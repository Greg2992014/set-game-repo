import React, { useState } from 'react';

function genCode() {
  return Math.random().toString(36).slice(2, 7).toUpperCase();
}

export default function Lobby({ onStart }) {
  const [mode, setMode] = useState(null); // 'solo' | 'create' | 'join'
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [connectionType, setConnectionType] = useState(() => {
    return localStorage.getItem('ablyConnectionType') === 'websocket' ? 'websocket' : 'rest';
  });

  const handleConnectionChange = (type) => {
    localStorage.setItem('ablyConnectionType', type);
    setConnectionType(type);
    window.location.reload();
  };
  const [generated, setGenerated] = useState('');

  const handleCreate = () => {
    const c = genCode();
    setGenerated(c);
    setMode('create');
  };

  const startCreate = () => {
    if (!name.trim()) return;
    onStart({ mode: 'multi', role: 'host', roomCode: generated, name: name.trim(), playerId: 'player1' });
  };

  const startJoin = () => {
    if (!name.trim() || !code.trim()) return;
    onStart({ mode: 'multi', role: 'guest', roomCode: code.trim().toUpperCase(), name: name.trim(), playerId: 'player2' });
  };

  const startSolo = () => {
    const n = name.trim() || 'Игрок';
    onStart({ mode: 'solo', name: n, playerId: 'player1' });
  };

  return (
    <div className="lobby">
      <div className="lobby-card">
        <h1 className="logo">SET</h1>
        <p className="tagline">Найди набор из трёх карт</p>

        <div className="name-row">
          <input
            className="input"
            placeholder="Твоё имя"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={16}
          />
        </div>
        <div className="connection-switch" style={{ marginBottom: '10px', textAlign: 'center' }}>
          <span style={{ marginRight: '8px' }}>Соединение:</span>
          <button 
            className={`btn-switch ${connectionType === 'rest' ? 'active' : ''}`}
            onClick={() => handleConnectionChange('rest')}
            style={{ marginRight: '4px' }}
          >
            REST
          </button>
          <button 
            className={`btn-switch ${connectionType === 'websocket' ? 'active' : ''}`}
            onClick={() => handleConnectionChange('websocket')}
          >
            WebSocket
          </button>
          <div style={{ fontSize: '0.7rem', color: '#aaa', marginTop: '4px' }}>
            {connectionType === 'websocket' 
              ? '⚡ Мгновенно, но может блокироваться оператором' 
              : '🐢 Надёжно, но с задержкой ~1с'}
          </div>
        </div>

        {!mode && (
          <div className="lobby-buttons">
            <button className="btn btn-solo" onClick={startSolo}>🎮 Один игрок</button>
            <button className="btn btn-create" onClick={handleCreate}>🏠 Создать комнату</button>
            <button className="btn btn-join" onClick={() => setMode('join')}>🔗 Войти в комнату</button>
          </div>
        )}

        {mode === 'create' && (
          <div className="create-room">
            <p className="room-label">Код комнаты — поделись с другом:</p>
            <div className="room-code">{generated}</div>
            <p className="room-hint">Жди пока друг введёт код, затем оба нажмите «Начать»</p>
            <button className="btn btn-primary" onClick={startCreate}>▶ Начать игру</button>
            <button className="btn btn-back" onClick={() => setMode(null)}>← Назад</button>
          </div>
        )}

        {mode === 'join' && (
          <div className="join-room">
            <input
              className="input code-input"
              placeholder="Код комнаты"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={5}
            />
            <button className="btn btn-primary" onClick={startJoin}>▶ Войти</button>
            <button className="btn btn-back" onClick={() => setMode(null)}>← Назад</button>
          </div>
        )}

        <div className="rules-mini">
          <strong>Правило:</strong> Два признака совпали, а третий — нет, значит это — вовсе не «Сет»!
        </div>
      </div>
    </div>
  );
}
