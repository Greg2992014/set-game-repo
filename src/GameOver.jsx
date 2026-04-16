import React from 'react';

export default function GameOver({ stats, names, playerId, onNew, onLobby }) {
  if (!stats) return null;

  const p1Score = stats.scores?.player1 || 0;
  const p2Score = stats.scores?.player2 || 0;
  const isSolo = !names?.player2;

  let winner = null;
  if (!isSolo) {
    if (p1Score > p2Score) winner = names?.player1 || 'Игрок 1';
    else if (p2Score > p1Score) winner = names?.player2 || 'Игрок 2';
    else winner = 'Ничья!';
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-emoji">🎉</div>
        <h2>Игра окончена!</h2>
        {winner && <div className="winner-banner">{winner === 'Ничья!' ? '🤝 Ничья!' : `🏆 Победил ${winner}`}</div>}

        <div className="stats-grid">
          {isSolo ? (
            <>
              <StatRow label="Найдено сетов" val={p1Score} />
              <StatRow label="Общее время" val={stats.totalTime} mono />
              <StatRow label="Среднее на сет" val={stats.avgTimes?.player1 || '—'} mono />
              <StatRow label="Быстрый сет" val={stats.fastestTimes?.player1 || '—'} mono />
              <StatRow label="Ошибок" val={stats.errors?.player1 || 0} />
            </>
          ) : (
            <>
              <div className="stats-header"><span>{names?.player1 || 'Игрок 1'}</span><span>{names?.player2 || 'Игрок 2'}</span></div>
              <DuelRow label="Сетов" v1={p1Score} v2={p2Score} />
              <DuelRow label="Ошибок" v1={stats.errors?.player1 || 0} v2={stats.errors?.player2 || 0} />
              <DuelRow label="Среднее" v1={stats.avgTimes?.player1} v2={stats.avgTimes?.player2} mono />
              <DuelRow label="Быстрый" v1={stats.fastestTimes?.player1} v2={stats.fastestTimes?.player2} mono />
              <StatRow label="Общее время" val={stats.totalTime} mono />
            </>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onNew}>↺ Ещё раз</button>
          <button className="btn btn-back" onClick={onLobby}>⌂ Лобби</button>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, val, mono }) {
  return (
    <div className="stat-row">
      <span className="stat-label">{label}</span>
      <span className={`stat-val${mono ? ' mono' : ''}`}>{val}</span>
    </div>
  );
}

function DuelRow({ label, v1, v2, mono }) {
  return (
    <div className="duel-row">
      <span className={`duel-val${mono ? ' mono' : ''}`}>{v1 ?? '—'}</span>
      <span className="duel-label">{label}</span>
      <span className={`duel-val${mono ? ' mono' : ''}`}>{v2 ?? '—'}</span>
    </div>
  );
}
