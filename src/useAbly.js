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

    const client = new Ably.Realtime({
      key: ABLY_KEY,
      clientId: playerId,
      transports: ['web_socket', 'xhr_polling'],
      timeout: 20000,                      // увеличен
      realtimeRequestTimeout: 20000,       // увеличен
      disconnectedRetryTimeout: 5000,
      suspendedRetryTimeout: 15000,        // увеличен
      connectivityCheckUrl: null,
    });

    clientRef.current = client;

    const handleConnected = () => {
      if (!isMounted) return;
      console.log('[Ably] connected');
      setConnected(true);
      // Принудительно прикрепляем канал, если ещё не прикреплён
      if (channelRef.current && channelRef.current.state !== 'attached') {
        channelRef.current.attach();
      }
    };

    const handleDisconnected = () => {
      if (!isMounted) return;
      console.log('[Ably] disconnected');
      setConnected(false);
    };

    const handleFailed = (err) => {
      if (!isMounted) return;
      console.error('[Ably] connection failed', err);
      setConnected(false);
    };

    client.connection.on('connected', handleConnected);
    client.connection.on('disconnected', handleDisconnected);
    client.connection.on('failed', handleFailed);

    const channel = client.channels.get(`set-game-${roomCode}`);
    channelRef.current = channel;

    const attachChannel = (retryDelay = 3000) => {
      channel.attach((err) => {
        if (!isMounted) return;
        if (err) {
          console.error('[Ably] channel attach error', err);
          setTimeout(() => attachChannel(retryDelay * 1.5), retryDelay);
        } else {
          console.log('[Ably] channel attached');
        }
      });
    };

    attachChannel();

    channel.on('detached', (stateChange) => {
      if (!isMounted) return;
      console.warn('[Ably] channel detached', stateChange.reason);
      if (client.connection.state === 'connected') {
        attachChannel();
      }
    });

    channel.on('suspended', (stateChange) => {
      if (!isMounted) return;
      console.warn('[Ably] channel suspended', stateChange.reason);
      attachChannel();
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
        clientRef.current.off(); // отписываемся от событий
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
    // Проверяем, что канал в состоянии attached, иначе ждём
    if (channel.state !== 'attached') {
      console.log('[Ably] channel not attached, waiting...');
      channel.once('attached', () => {
        channel.publish(event, data);
      });
      // Принудительно пытаемся прикрепить
      channel.attach();
      return;
    }
    channel.publish(event, data, (err) => {
      if (err) console.error('[Ably] publish error', err);
    });
  }, []);

  return { connected, publish };
}