import { useEffect, useRef, useState, useCallback } from 'react';
import Ably from 'ably';

const ABLY_KEY = import.meta.env.VITE_ABLY_KEY;

export function useAbly(roomCode, playerId, onMessage) {
  const clientRef = useRef(null);
  const channelRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!roomCode) return;
    if (!ABLY_KEY) {
      console.error('[Ably] No API key');
      return;
    }

    let isMounted = true;
    let attachAttempts = 0;

    // Только HTTP polling (надёжнее на мобильных сетях)
    const client = new Ably.Realtime({
      key: ABLY_KEY,
      clientId: playerId,
      transports: ['xhr_polling'], // отключаем WebSocket
      timeout: 30000,
      realtimeRequestTimeout: 30000,
      disconnectedRetryTimeout: 5000,
      suspendedRetryTimeout: 15000,
      connectivityCheckUrl: null,
    });

    clientRef.current = client;

    client.connection.on('connecting', () => {
      console.log('[Ably] connecting...');
    });

    client.connection.on('connected', () => {
      if (!isMounted) return;
      console.log('[Ably] connected');
      setConnected(true);
      attachAttempts = 0;
      if (channelRef.current && channelRef.current.state !== 'attached') {
        channelRef.current.attach();
      }
    });

    client.connection.on('disconnected', (reason) => {
      if (!isMounted) return;
      console.log('[Ably] disconnected', reason);
      setConnected(false);
    });

    client.connection.on('failed', (err) => {
      if (!isMounted) return;
      console.error('[Ably] connection failed', err);
      setConnected(false);
    });

    const channel = client.channels.get(`set-game-${roomCode}`);
    channelRef.current = channel;

    const attachWithRetry = () => {
      channel.attach((err) => {
        if (!isMounted) return;
        if (err) {
          attachAttempts++;
          const delay = Math.min(3000 * Math.pow(1.5, attachAttempts), 30000);
          console.error(`[Ably] attach error (attempt ${attachAttempts}), retry in ${delay}ms`, err);
          setTimeout(attachWithRetry, delay);
        } else {
          console.log('[Ably] channel attached');
          attachAttempts = 0;
        }
      });
    };

    attachWithRetry();

    channel.on('detached', () => {
      if (!isMounted) return;
      console.warn('[Ably] channel detached, reattaching');
      if (client.connection.state === 'connected') {
        attachWithRetry();
      }
    });

    channel.on('suspended', () => {
      if (!isMounted) return;
      console.warn('[Ably] channel suspended, reattaching');
      attachWithRetry();
    });

    channel.subscribe((msg) => {
      if (msg.clientId !== playerId) {
        onMessage(msg.name, msg.data);
      }
    });

    return () => {
      isMounted = false;
      console.log('[Ably] cleanup');
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current.detach();
      }
      if (clientRef.current) {
        clientRef.current.connection.off();
        clientRef.current.close();
      }
    };
  }, [roomCode, playerId, onMessage]);

  const publish = useCallback((event, data) => {
    const channel = channelRef.current;
    if (!channel) {
      console.warn('[Ably] publish: no channel');
      return;
    }

    const doPublish = () => {
      channel.publish(event, data, (err) => {
        if (err) console.error('[Ably] publish error', err);
      });
    };

    if (channel.state !== 'attached') {
      console.log('[Ably] channel not attached, waiting...');
      channel.once('attached', doPublish);
      channel.attach();
    } else {
      doPublish();
    }
  }, []);

  return { connected, publish };
}