import React, { useState, useCallback, useEffect } from 'react';
import Lobby from './Lobby.jsx';
import Card from './Card.jsx';
import GameOver from './GameOver.jsx';
import RulesModal from './RulesModal.jsx';
import { useGameState } from './useGameState.js';
import { useAbly } from './useAbly.js';
import { deserializeCards, hasSetOnBoard } from './deck.js';

export default function App() {
  const [session, setSession] = useState(null); // { mode, role, roomCode, name, playerId }
  const [names, setNames] = useState({});
  const [showRules, setShowRules] = useState(false);
  const [partnerReady, setPartnerReady] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // ------ Multiplayer messaging ------
  const handleRemoteMessage = useCallback((event, data) => {
    if (event === 'state') {
      applyRemoteState(data);
    } else if (event === 'name') {
      setNames(prev => ({ ...prev, [data.playerId]: data.name }));
      setPartnerReady(true);
    } else if (event === 'new_game') {
      initGame();
    }
  }, []);

  const { connected, publish } = useAbly(
    session?.mode === 'multi' ? session.roomCode : null,
    session?.playerId,
    handleRemoteMessage
  );

  const publishFn = session?.mode === 'multi' ? publish : null;

  const {
    gs, selected, hint, flash, locked, currentTime, formatTime,
    initGame, applyRemoteState, toggleCard, addThreeCards, showHint, getStats,
  } = useGameState(session?.playerId, publishFn);

  // ------ Session start ------
  const handleStart = useCallback((cfg) => {
    setSession(cfg);
    setNames({ [cfg.playerId]: cfg.name });
    setPartnerReady(cfg.mode === 'solo');
  }, []);

  // После подключения к Ably — анонсируем себя и стартуем игру если хост
  useEffect(() => {
    if (!session || session.mode !== 'multi' || !connected) return;

    publish('name', { playerId: session.playerId, name: session.name });

    if (session.role === 'host') {
      // Хост инициализирует состояние
      setTimeout(() => {
        const state = initGame();
        // Ещё раз отправим после небольшой задержки чтоб гость получил
        setTimeout(() => publish('state', state), 500);
      }, 800);
    }
  }, [connected, session]);

  // Для гостя — ждём state от хоста (initGame вызовется через applyRemoteState)
  // Но нам нужно показать имя гостя хосту
  useEffect(() => {
    if (!session || session.mode !== 'multi' || !gs) return;
    if (session.role === 'guest' && !partnerReady) {
      publish('name', { playerId: session.playerId, name: session.name });
    }
  }, [gs, session]);

  // Статус-сообщения
  useEffect(() => {
    if (!gs) return;
    if (gs.gameOver) { setStatusMsg(''); return; }
    const board = deserializeCards(gs.boardIds);
    const hasSet = hasSetOnBoard(board);
    if (locked) {
      setStatusMsg('⚠️ Ошибка! Пауза 2 сек...');
    } else if (!hasSet && gs.deckIds.length === 0) {
      setStatusMsg('Нет сетов на поле и колода пуста!');
    } else if (!hasSet) {
      setStatusMsg('Нет сета на поле — добавь карты!');
    } else if (selected.length > 0) {
      setStatusMsg(`Выбрано: ${selected.length}/3`);
    } else {
      setStatusMsg('Найди набор из 3 карт!');
    }
  }, [gs, locked, selected]);

  const handleNewGame = () => {
    if (session?.mode === 'multi') {
      publish('new_game', {});
    }
    initGame();
  };

  const handleLobby = () => {
    setSession(null);
    setGs && setNames({});
    setPartnerReady(false);
  };

  // ------ Render ------
  if (!session) {
    return <Lobby onStart={handleStart} />;
  }

  if (!gs) {
    return (
      <div className="loading-screen">
        <div className="loading-logo">SET</div>
        {session.mode === 'multi' && !connected && <p>Подключение к серверу...</p>}
        {session.mode === 'multi' && connected && session.role === 'guest' && <p>Ждём начала от хоста...</p>}
        {session.mode === 'multi' && connected && session.role === 'host' && <p>Готовим поле...</p>}
        {session.mode === 'solo' && <p>Загрузка...</p>}
      </div>
    );
  }

  const board = deserializeCards(gs.boardIds);
  const stats = getStats();
  const isSolo = session.mode === 'solo';
  const myName = names[session.playerId] || 'Я';
  const partnerKey = session.playerId === 'player1' ? 'player2' : 'player1';
  const partnerName = names[partnerKey] || 'Соперник';

  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <div className="header-left">
          <span className="logo-sm">SET</span>
          {session.mode === 'multi' && (
            <span className={`conn-dot ${connected ? 'on' : 'off'}`} title={connected ? 'Online' : 'Offline'} />
          )}
        </div>

        <div className="scoreboard">
          <div className={`player-score ${session.playerId === 'player1' ? 'mine' : ''}`}>
            <span className="p-name">{isSolo ? myName : (names.player1 || 'Игрок 1')}</span>
            <span className="p-pts">{gs.scores?.player1 || 0}</span>
            <span className="p-err">❌ {gs.errors?.player1 || 0}</span>
          </div>

          <div className="timer-center">
            <span className="timer-val">{formatTime(currentTime)}</span>
            <span className="deck-left">🃏 {gs.deckIds.length}</span>
          </div>

          {!isSolo && (
            <div className={`player-score ${session.playerId === 'player2' ? 'mine' : ''}`}>
              <span className="p-name">{names.player2 || 'Игрок 2'}</span>
              <span className="p-pts">{gs.scores?.player2 || 0}</span>
              <span className="p-err">❌ {gs.errors?.player2 || 0}</span>
            </div>
          )}
        </div>

        <div className="header-right">
          <button className="btn-icon" onClick={() => setShowRules(true)} title="Правила">?</button>
        </div>
      </header>

      {/* STATUS */}
      <div className={`status-bar ${locked ? 'penalty' : ''}`}>{statusMsg}</div>

      {/* BOARD */}
      <main className="board-wrap">
        <div className="board" style={{ '--cols': Math.min(Math.ceil(board.length / 3), 6) }}>
          {board.map(card => (
            <Card
              key={card.id}
              card={card}
              selected={selected.includes(card.id)}
              hint={hint === card.id}
              flash={flash?.ids.includes(card.id) ? flash.type : null}
              disabled={locked || gs.gameOver}
              onClick={() => toggleCard(card.id)}
            />
          ))}
        </div>
      </main>

      {/* CONTROLS */}
      <div className="controls">
        <button className="btn btn-add" onClick={addThreeCards} disabled={gs.gameOver || gs.deckIds.length < 3}>
          + 3 карты
        </button>
        <button className="btn btn-hint" onClick={showHint} disabled={gs.gameOver}>
          💡 Подсказка
        </button>
        <button className="btn btn-new" onClick={handleNewGame}>↺ Новая</button>
      </div>

      {/* MODALS */}
      {gs.gameOver && (
        <GameOver
          stats={stats}
          names={names}
          playerId={session.playerId}
          onNew={handleNewGame}
          onLobby={handleLobby}
        />
      )}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  );
}
