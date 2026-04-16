// src/useAblyRest.js
import { useEffect, useRef, useState, useCallback } from 'react';
import Ably from 'ably';

const ABLY_KEY = import.meta.env.VITE_ABLY_KEY;

export function useAblyRest(roomCode, playerId, onMessage) {
  const [connected, setConnected] = useState(false);
  const clientRef = useRef(null);
  const channelRef = useRef(null);
  const intervalRef = useRef(null);
  const lastProcessedRef = useRef({});

  useEffect(() => {
    if (!roomCode) {
      console.log('[AblyRest] No roomCode, skip');
      return;
    }
    if (!ABLY_KEY) {
      console.error('[AblyRest] No API key');
      return;
    }

    let isMounted = true;

    console.log('[AblyRest] Initializing with long timeouts (120s)');
    const client = new Ably.Rest({
      key: ABLY_KEY,
      timeout: 120000,               // 2 минуты на запрос
      httpMaxRetryCount: 3,
      httpMaxRetryDuration: 60000,
      fallbackHosts: [],             // отключаем fallback
    });
    clientRef.current = client;
    const channel = client.channels.get(`set-game-${roomCode}`);
    channelRef.current = channel;
    setConnected(true);
    console.log('[AblyRest] Connected (REST mode, long timeout)');

    const poll = async () => {
      if (!isMounted) return;
      try {
        console.log('[AblyRest] Polling history...');
        const history = await channel.history({ limit: 20, direction: 'forwards' });
        const messages = history.items || [];
        console.log(`[AblyRest] Got ${messages.length} messages`);
        for (const msg of messages) {
          const msgKey = `${msg.timestamp}-${msg.clientId}-${msg.name}`;
          if (lastProcessedRef.current[msgKey]) continue;
          lastProcessedRef.current[msgKey] = true;
          if (msg.clientId !== playerId) {
            console.log('[AblyRest] Received:', msg.name);
            onMessage(msg.name, msg.data);
          }
        }
        // очистка старых ключей
        const keys = Object.keys(lastProcessedRef.current);
        if (keys.length > 100) {
          const toDelete = keys.slice(0, keys.length - 50);
          toDelete.forEach(k => delete lastProcessedRef.current[k]);
        }
      } catch (err) {
        console.error('[AblyRest] Poll error:', err);
      }
    };

    intervalRef.current = setInterval(poll, 5000);
    poll(); // сразу первый опрос

    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      clientRef.current = null;
    };
  }, [roomCode, playerId, onMessage]);

  const publish = useCallback((event, data) => {
    if (!channelRef.current) {
      console.warn('[AblyRest] No channel, cannot publish');
      return;
    }
    console.log('[AblyRest] Publishing:', event);
    channelRef.current.publish(event, data, (err) => {
      if (err) console.error('[AblyRest] Publish error:', err);
      else console.log('[AblyRest] Published successfully:', event);
    });
  }, []);

  return { connected, publish };
}