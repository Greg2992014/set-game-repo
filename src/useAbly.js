// src/useAbly.js
import { useEffect, useRef, useState, useCallback } from 'react';
import Ably from 'ably';

const ABLY_KEY = import.meta.env.VITE_ABLY_KEY;

// Определение мобильного устройства по User-Agent
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
      console.error('[Ably] FATAL: VITE_ABLY_KEY is not set in environment');
      return;
    }

    let isMounted = true;
    let retryCount = 0;

    // На мобильных устройствах используем только xhr_polling (WebSocket часто блокируется)
    const useOnlyXhr = isMobile();
    const transports = useOnlyXhr ? ['xhr_polling'] : ['web_socket', 'xhr_polling'];
    
    console.log('[Ably] Initializing with:', {
      roomCode,
      playerId,
      transports,
      useOnlyXhr,
      ABLY_KEY_prefix: ABLY_KEY.substring(0, 10) + '...',
    });

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
      connectivityCheckUrl: null, // отключаем лишние проверки
      autoConnect: true,
      queueMessages: true,
      log: { level: 4 }, // максимальный уровень логирования Ably (если поддерживается)
    });

    clientRef.current = client;

    // ---- Подробные обработчики состояния соединения ----
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
        reason: reason ? (reason.message || reason) : 'no reason',
        code: reason?.code,
        statusCode: reason?.statusCode,
        retryCount,
      });
      setConnected(false);
      setDetailedError(reason);
      // Экспоненциальная задержка для повторных попыток
      if (retryCount < 5) {
        const delay = 3000 * Math.pow(1.5, retryCount);
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
        error: err ? (err.message || err) : 'unknown',
        code: err?.code,
        statusCode: err?.statusCode,
      });
      setConnected(false);
      setDetailedError(err);
    };

    const handleSuspended = () => {
      console.warn('[Ably] State: SUSPENDED – connection lost, will retry later');
    };

    const handleClosed = () => {
      console.log('[Ably] State: CLOSED');
      setConnected(false);
    };

    client.connection.on('connecting', handleConnecting);
    client.connection.on('connected', handleConnected);
    client.connection.on('disconnected', handleDisconnected);
    client.connection.on('failed', handleFailed);
    client.connection.on('suspended', handleSuspended);
    client.connection.on('closed', handleClosed);

    // ---- Канал ----
    const channelName = `set-game-${roomCode}`;
    console.log('[Ably] Creating channel:', channelName);
    const channel = client.channels.get(channelName);
    channelRef.current = channel;

    const attachChannel = () => {
      console.log('[Ably] Attaching channel... current state =', channel.state);
      channel.attach((err) => {
        if (!isMounted) return;
        if (err) {
          console.error('[Ably] Channel attach error:', {
            message: err.message,
            code: err.code,
            statusCode: err.statusCode,
            stack: err.stack,
          });
          // Повторная попытка через 5 секунд
          setTimeout(attachChannel, 5000);
        } else {
          console.log('[Ably] Channel attached successfully, state =', channel.state);
        }
      });
    };
    attachChannel();

    // Обработчики событий канала
    channel.on('attached', () => {
      console.log('[Ably] Channel event: attached');
    });
    channel.on('detached', () => {
      console.warn('[Ably] Channel event: detached, reattaching...');
      if (client.connection.state === 'connected') attachChannel();
    });
    channel.on('suspended', () => {
      console.warn('[Ably] Channel event: suspended, reattaching...');
      attachChannel();
    });
    channel.on('failed', (err) => {
      console.error('[Ably] Channel event: failed', err);
    });
    channel.on('update', (msg) => {
      console.log('[Ably] Channel update:', msg);
    });

    // Подписка на сообщения (только от других клиентов)
    channel.subscribe((msg) => {
      console.log('[Ably] Message received:', {
        name: msg.name,
        clientId: msg.clientId,
        data: msg.data,
        timestamp: msg.timestamp,
      });
      if (msg.clientId !== playerId) {
        onMessage(msg.name, msg.data);
      } else {
        console.log('[Ably] Ignoring own message');
      }
    });

    // ---- Дополнительный мониторинг сетевых событий браузера ----
    const handleOnline = () => {
      console.log('[Ably] Browser online event');
      if (client.connection.state !== 'connected') {
        console.log('[Ably] Attempting to reconnect due to online event');
        client.connect();
      }
    };
    const handleOffline = () => {
      console.log('[Ably] Browser offline event');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // ---- Cleanup ----
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
      console.warn('[Ably] publish: no channel (not initialized)');
      return;
    }

    console.log('[Ably] Publishing:', { event, data, channelState: channel.state });

    const doPublish = () => {
      channel.publish(event, data, (err) => {
        if (err) {
          console.error('[Ably] Publish error:', {
            event,
            error: err.message,
            code: err.code,
            statusCode: err.statusCode,
          });
        } else {
          console.log('[Ably] Published successfully:', event);
        }
      });
    };

    if (channel.state !== 'attached') {
      console.log('[Ably] Channel not attached, waiting for attached event...');
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