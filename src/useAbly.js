import { useEffect, useRef, useState, useCallback } from 'react';
import Ably from 'ably';

const ABLY_KEY = import.meta.env.VITE_ABLY_KEY;

// Определение мобильного устройства по User-Agent
const isMobile = () => {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

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
    let retryCount = 0;

    // На мобильных устройствах используем только xhr_polling (WebSocket часто блокируется)
    const useOnlyXhr = isMobile();
    const transports = useOnlyXhr ? ['xhr_polling'] : ['web_socket', 'xhr_polling'];
    
    console.log('[Ably] initializing, transports:', transports, 'mobile:', useOnlyXhr);

    const client = new Ably.Realtime({
      key: ABLY_KEY,
      clientId: playerId,
      transports: transports,
      fallbackHosts: ['a.ably-realtime.com', 'b.ably-realtime.com', 'c.ably-realtime.com'],
      timeout: 30000,
      realtimeRequestTimeout: 30000,
      disconnectedRetryTimeout: 3000,
      suspendedRetryTimeout: 15000,
      httpMaxRetryCount: 5,
      connectivityCheckUrl: null,
      autoConnect: true,
      queueMessages: true,
    });

    clientRef.current = client;

    const handleConnecting = () => {
      if (!isMounted) return;
      console.log('[Ably] connecting...');
    };

    const handleConnected = () => {
      if (!isMounted) return;
      console.log('[Ably] connected');
      setConnected(true);
      retryCount = 0;
      if (channelRef.current && channelRef.current.state !== 'attached') {
        channelRef.current.attach();
      }
    };

    const handleDisconnected = (reason) => {
      if (!isMounted) return;
      console.log('[Ably] disconnected', reason);
      setConnected(false);
      if (retryCount < 5) {
        const delay = 3000 * Math.pow(1.5, retryCount);
        setTimeout(() => {
          if (isMounted && client.connection.state !== 'connected') {
            console.log('[Ably] retry connecting...');
            client.connect();
          }
        }, delay);
        retryCount++;
      }
    };

    const handleFailed = (err) => {
      if (!isMounted) return;
      console.error('[Ably] connection failed', err);
      setConnected(false);
    };

    client.connection.on('connecting', handleConnecting);
    client.connection.on('connected', handleConnected);
    client.connection.on('disconnected', handleDisconnected);
    client.connection.on('failed', handleFailed);

    const channel = client.channels.get(`set-game-${roomCode}`);
    channelRef.current = channel;

    const attachChannel = () => {
      channel.attach((err) => {
        if (!isMounted) return;
        if (err) {
          console.error('[Ably] channel attach error', err);
          setTimeout(attachChannel, 5000);
        } else {
          console.log('[Ably] channel attached');
        }
      });
    };

    attachChannel();

    channel.on('detached', () => {
      if (!isMounted) return;
      console.warn('[Ably] channel detached, reattaching');
      if (client.connection.state === 'connected') attachChannel();
    });

    channel.on('suspended', () => {
      if (!isMounted) return;
      console.warn('[Ably] channel suspended, reattaching');
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