import { useEffect, useRef, useState, useCallback } from 'react';
import Ably from 'ably';

const ABLY_KEY = import.meta.env.VITE_ABLY_KEY;

const isMobile = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  console.log('[Ably] userAgent:', ua, '→ isMobile =', isMobileUA);
  return isMobileUA;
};

export function useAbly(roomCode, playerId, onMessage) {
  const clientRef = useRef(null);
  const channelRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [detailedError, setDetailedError] = useState(null);

  useEffect(() => {
    if (!roomCode) {
      console.log('[Ably] No roomCode, skip connection');
      return;
    }
    if (!ABLY_KEY) {
      console.error('[Ably] FATAL: VITE_ABLY_KEY is not set');
      return;
    }

    let isMounted = true;
    let retryCount = 0;

    const mobile = isMobile();
    // Пробуем WebSocket, если не получится – позже переключимся на xhr_polling
    const transports = mobile ? ['web_socket', 'xhr_polling'] : ['web_socket', 'xhr_polling'];
    // Увеличенные таймауты для мобильных
    const timeout = mobile ? 60000 : 30000;
    const realtimeRequestTimeout = mobile ? 60000 : 30000;
    const httpRequestTimeout = mobile ? 60000 : 10000;

    console.log('[Ably] Initializing with:', {
      roomCode,
      playerId,
      transports,
      mobile,
      timeout,
      realtimeRequestTimeout,
      httpRequestTimeout,
      ABLY_KEY_prefix: ABLY_KEY.substring(0, 10) + '...',
    });

    const client = new Ably.Realtime({
      key: ABLY_KEY,
      clientId: playerId,
      transports: transports,
      fallbackHosts: ['a.ably-realtime.com', 'b.ably-realtime.com', 'c.ably-realtime.com'],
      timeout: timeout,
      realtimeRequestTimeout: realtimeRequestTimeout,
      disconnectedRetryTimeout: mobile ? 5000 : 3000,
      suspendedRetryTimeout: mobile ? 20000 : 15000,
      httpMaxRetryCount: 5,
      connectivityCheckUrl: null,
      autoConnect: true,
      queueMessages: true,
      // Дополнительные опции для улучшения соединения на мобильных
      ...(mobile && { transportParams: { heartbeatInterval: 15000 } })
    });

    clientRef.current = client;

    const handleConnecting = () => {
      if (!isMounted) return;
      console.log('[Ably] State: CONNECTING (connection state =', client.connection.state, ')');
    };

    const handleConnected = () => {
      if (!isMounted) return;
      console.log('[Ably] State: CONNECTED, connectionId =', client.connection.id);
      setConnected(true);
      setDetailedError(null);
      retryCount = 0;
      if (channelRef.current && channelRef.current.state !== 'attached') {
        console.log('[Ably] Channel not attached yet, attaching...');
        channelRef.current.attach();
      }
    };

    const handleDisconnected = (reason) => {
      if (!isMounted) return;
      console.warn('[Ably] State: DISCONNECTED', {
        message: reason?.message,
        code: reason?.code,
        statusCode: reason?.statusCode,
        toString: reason?.toString?.(),
        stack: reason?.stack,
        raw: reason,
      });
      setConnected(false);
      setDetailedError(reason);
      if (retryCount < 5) {
        const delay = (mobile ? 5000 : 3000) * Math.pow(1.5, retryCount);
        console.log(`[Ably] Will retry connection in ${delay}ms (attempt ${retryCount + 1})`);
        setTimeout(() => {
          if (isMounted && client.connection.state !== 'connected') {
            console.log('[Ably] Retrying connection...');
            client.connect();
          }
        }, delay);
        retryCount++;
      } else {
        console.error('[Ably] Max retries reached, giving up');
      }
    };

    const handleFailed = (err) => {
      if (!isMounted) return;
      console.error('[Ably] State: FAILED', {
        message: err?.message,
        code: err?.code,
        statusCode: err?.statusCode,
        stack: err?.stack,
      });
      setConnected(false);
      setDetailedError(err);
    };

    client.connection.on('connecting', handleConnecting);
    client.connection.on('connected', handleConnected);
    client.connection.on('disconnected', handleDisconnected);
    client.connection.on('failed', handleFailed);
    client.connection.on('suspended', () => console.warn('[Ably] State: SUSPENDED'));
    client.connection.on('closed', () => console.log('[Ably] State: CLOSED'));

    const channelName = `set-game-${roomCode}`;
    console.log('[Ably] Creating channel:', channelName);
    const channel = client.channels.get(channelName);
    channelRef.current = channel;

    const attachChannel = () => {
      console.log('[Ably] Attaching channel... state =', channel.state);
      channel.attach((err) => {
        if (!isMounted) return;
        if (err) {
          console.error('[Ably] Channel attach error:', {
            message: err.message,
            code: err.code,
            statusCode: err.statusCode,
            stack: err.stack,
          });
          setTimeout(attachChannel, 5000);
        } else {
          console.log('[Ably] Channel attached successfully');
        }
      });
    };
    attachChannel();

    channel.on('attached', () => console.log('[Ably] Channel event: attached'));
    channel.on('detached', () => console.warn('[Ably] Channel detached, reattaching...'));
    channel.on('suspended', () => console.warn('[Ably] Channel suspended, reattaching...'));
    channel.on('failed', (err) => console.error('[Ably] Channel failed', err));

    channel.subscribe((msg) => {
      console.log('[Ably] Message received:', {
        name: msg.name,
        clientId: msg.clientId,
        data: msg.data,
      });
      if (msg.clientId !== playerId) {
        onMessage(msg.name, msg.data);
      }
    });

    const handleOnline = () => {
      console.log('[Ably] Browser online event');
      if (client.connection.state !== 'connected') client.connect();
    };
    const handleOffline = () => console.log('[Ably] Browser offline event');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      console.log('[Ably] Cleaning up...');
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
    console.log('[Ably] Publishing:', { event, data, channelState: channel.state });
    const doPublish = () => {
      channel.publish(event, data, (err) => {
        if (err) console.error('[Ably] Publish error:', err);
        else console.log('[Ably] Published successfully:', event);
      });
    };
    if (channel.state !== 'attached') {
      channel.once('attached', () => {
        console.log('[Ably] Channel now attached, publishing...');
        doPublish();
      });
      channel.attach();
    } else {
      doPublish();
    }
  }, []);

  return { connected, publish, detailedError };
}