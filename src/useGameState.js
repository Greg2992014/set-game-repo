export function useGameState(playerId, publish = null) {
  console.log('[DIAG] useGameState hook, playerId:', playerId, 'publish:', !!publish);
  const [gs, setGs] = useState(null);
  const [selected, setSelected] = useState([]);
  const [hint, setHint] = useState(null);
  const [flash, setFlash] = useState(null);
  const [locked, setLocked] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const timerRef = useRef(null);
  const lockedRef = useRef(false);

  const startTimer = useCallback((startTime) => {
    console.log('[DIAG] startTimer', startTime);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrentTime(Math.floor((Date.now() - startTime) / 1000));
    }, 500);
  }, []);

  const initGame = useCallback(() => {
    console.log('[DIAG] initGame called');
    try {
      const state = createInitialGameState();
      console.log('[DIAG] initGame state created', state);
      setGs(state);
      setSelected([]);
      setHint(null);
      setFlash(null);
      setLocked(false);
      lockedRef.current = false;
      setCurrentTime(0);
      startTimer(state.startTime);
      if (publish) {
        console.log('[DIAG] publishing state');
        publish('state', state);
      }
      return state;
    } catch (err) {
      console.error('[DIAG] initGame error', err);
      return null;
    }
  }, [publish, startTimer]);

  const applyRemoteState = useCallback((state) => {
    console.log('[DIAG] applyRemoteState', state);
    setGs(prev => {
      if (!prev || state.version >= prev.version) {
        if (state.startTime !== prev?.startTime) {
          startTimer(state.startTime);
          setSelected([]);
          setFlash(null);
          setLocked(false);
          lockedRef.current = false;
        }
        return state;
      }
      return prev;
    });
  }, [startTimer]);

  // Показать flash-анимацию
  const showFlash = (ids, type) => {
    setFlash({ ids, type });
    setTimeout(() => setFlash(null), 700);
  };

  // Выбор карты
  const toggleCard = useCallback((cardId) => {
    if (lockedRef.current) return;
    setSelected(prev => {
      if (prev.includes(cardId)) return prev.filter(id => id !== cardId);
      if (prev.length >= 3) return prev;
      const next = [...prev, cardId];

      // Если выбрано 3 — проверяем
      if (next.length === 3) {
        setTimeout(() => trySubmitSet(next), 50);
      }
      return next;
    });
  }, []);

  // Попытка отправить сет
  const trySubmitSet = useCallback((ids) => {
    setGs(prev => {
      if (!prev || prev.gameOver) return prev;

      const cards = ids.map(id => deserializeCard(id));
      const board = deserializeCards(prev.boardIds);
      const deck = deserializeCards(prev.deckIds);

      // Проверяем что все карты ещё на поле
      if (!ids.every(id => prev.boardIds.includes(id))) {
        setSelected([]);
        return prev;
      }

      const valid = isValidSet(cards[0], cards[1], cards[2]);

      if (valid) {
        // Убираем карты, добавляем из колоды
        const newBoard = board.filter(c => !ids.includes(c.id));
        const newDeck = [...deck];
        while (newBoard.length < 12 && newDeck.length > 0) {
          newBoard.push(newDeck.pop());
        }

        const now = Date.now();
        const setTime = Math.floor((now - prev.lastSetTime) / 1000);
        const newScores = { ...prev.scores, [playerId]: (prev.scores[playerId] || 0) + 1 };
        const newSetTimes = {
          ...prev.setTimes,
          [playerId]: [...(prev.setTimes[playerId] || []), setTime],
        };

        const gameOver = newDeck.length === 0 && !hasSetOnBoard(newBoard);

        const newState = {
          ...prev,
          boardIds: newBoard.map(c => c.id),
          deckIds: newDeck.map(c => c.id),
          scores: newScores,
          setTimes: newSetTimes,
          lastSetTime: now,
          gameOver,
          version: prev.version + 1,
        };

        showFlash(ids, 'correct');
        setSelected([]);
        if (publish) publish('state', newState);
        if (gameOver && timerRef.current) clearInterval(timerRef.current);
        return newState;

      } else {
        // Ошибка — блокируем до следующего правильного сета партнёра
        showFlash(ids, 'incorrect');
        setSelected([]);

        const newErrors = { ...prev.errors, [playerId]: (prev.errors[playerId] || 0) + 1 };
        const newState = { ...prev, errors: newErrors, version: prev.version + 1 };

        // Блокировка на 2 секунды
        lockedRef.current = true;
        setLocked(true);
        setTimeout(() => { lockedRef.current = false; setLocked(false); }, 2000);

        if (publish) publish('state', newState);
        return newState;
      }
    });
  }, [playerId, publish]);

  // Добавить 3 карты (только если нет сета)
  const addThreeCards = useCallback(() => {
    setGs(prev => {
      if (!prev) return prev;
      const board = deserializeCards(prev.boardIds);
      if (hasSetOnBoard(board)) return prev; // есть сет — не добавляем
      const deck = deserializeCards(prev.deckIds);
      if (deck.length < 3) return prev;
      const newBoard = [...board, ...deck.splice(-3)];
      const newState = {
        ...prev,
        boardIds: newBoard.map(c => c.id),
        deckIds: deck.map(c => c.id),
        version: prev.version + 1,
      };
      if (publish) publish('state', newState);
      return newState;
    });
  }, [publish]);

  // Подсказка
  const showHint = useCallback(() => {
    if (!gs) return;
    const board = deserializeCards(gs.boardIds);
    const set = findRandomSet(board);
    if (!set) return;
    const card = set[Math.floor(Math.random() * 3)];
    setHint(card.id);
    setTimeout(() => setHint(null), 3000);
  }, [gs]);

  // Форматирование времени
  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  };

  const getStats = useCallback(() => {
    if (!gs) return null;
    const calcAvg = (times) => times.length ? Math.floor(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    const calcMin = (times) => times.length ? Math.min(...times) : 0;
    return {
      scores: gs.scores,
      errors: gs.errors,
      totalTime: formatTime(currentTime),
      avgTimes: {
        player1: formatTime(calcAvg(gs.setTimes?.player1 || [])),
        player2: formatTime(calcAvg(gs.setTimes?.player2 || [])),
      },
      fastestTimes: {
        player1: formatTime(calcMin(gs.setTimes?.player1 || [])),
        player2: formatTime(calcMin(gs.setTimes?.player2 || [])),
      },
    };
  }, [gs, currentTime]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return {
    gs,
    selected,
    hint,
    flash,
    locked,
    currentTime,
    formatTime,
    initGame,
    applyRemoteState,
    toggleCard,
    addThreeCards,
    showHint,
    getStats,
  };
}
