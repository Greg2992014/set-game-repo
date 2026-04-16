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

    // Увеличенные таймауты и fallback-транспорты
    const client = new Ably.Realtime({
      key: ABLY_KEY,
      clientId: playerId,
      transports: ['web_socket', 'xhr_polling'], // разрешаем fallback
      timeout: 15000,                           // общий таймаут запросов
      realtimeRequestTimeout: 15000,            // таймаут attach/detach
      disconnectedRetryTimeout: 5000,
      suspendedRetryTimeout: 10000,
      // Отключаем проверку интернета (иногда она мешает)
      connectivityCheckUrl: null,
    });

    clientRef.current = client;

    client.connection.on('connected', () => {
      console.log('[Ably] connected');
      setConnected(true);
    });

    client.connection.on('disconnected', () => {
      console.log('[Ably] disconnected');
      setConnected(false);
    });

    client.connection.on('failed', (err) => {
      console.error('[Ably] connection failed', err);
      setConnected(false);
    });

    const channel = client.channels.get(`set-game-${roomCode}`);
    channelRef.current = channel;

    // Прикрепляем канал с повторными попытками
    channel.attach((err) => {
      if (err) {
        console.error('[Ably] channel attach error', err);
        // Повторим через 3 секунды
        setTimeout(() => {
          if (channelRef.current === channel) {
            channel.attach();
          }
        }, 3000);
      } else {
        console.log('[Ably] channel attached');
      }
    });

    // Обработка ошибок канала
    channel.on('detached', (stateChange) => {
      console.warn('[Ably] channel detached', stateChange.reason);
      // Переподключаем канал, если соединение активно
      if (client.connection.state === 'connected') {
        channel.attach();
      }
    });

    channel.on('suspended', (stateChange) => {
      console.warn('[Ably] channel suspended', stateChange.reason);
      // Приостановлен — пробуем переприкрепить
      channel.attach();
    });

    channel.subscribe((msg) => {
      if (msg.clientId !== playerId) {
        onMessage(msg.name, msg.data);
      }
    });

    return () => {
      console.log('[Ably] cleanup');
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current.detach();
      }
      if (clientRef.current) {
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