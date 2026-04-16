import { useEffect, useRef, useState, useCallback } from 'react';
import Ably from 'ably';

const ABLY_KEY = import.meta.env.VITE_ABLY_KEY;
console.log('[DIAG] useAbly: ABLY_KEY present?', !!ABLY_KEY);

export function useAbly(roomCode, playerId, onMessage) {
  console.log('[DIAG] useAbly called', { roomCode, playerId });
  const clientRef = useRef(null);
  const channelRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!roomCode) {
      console.log('[DIAG] no roomCode, skipping Ably init');
      return;
    }
    if (!ABLY_KEY) {
      console.error('[DIAG] VITE_ABLY_KEY is missing!');
      return;
    }
    console.log('[DIAG] creating Ably client');
    const client = new Ably.Realtime({ key: ABLY_KEY, clientId: playerId });
    clientRef.current = client;

    client.connection.on('connected', () => {
      console.log('[DIAG] Ably connected');
      setConnected(true);
    });
    client.connection.on('disconnected', () => {
      console.log('[DIAG] Ably disconnected');
      setConnected(false);
    });
    client.connection.on('failed', (err) => {
      console.error('[DIAG] Ably connection failed', err);
    });

    const channel = client.channels.get(`set-game-${roomCode}`);
    channelRef.current = channel;

    channel.subscribe((msg) => {
      console.log('[DIAG] channel message', msg.name, msg.data);
      if (msg.clientId !== playerId) {
        onMessage(msg.name, msg.data);
      }
    });

    return () => {
      console.log('[DIAG] cleanup Ably');
      channel.unsubscribe();
      client.close();
    };
  }, [roomCode, playerId, onMessage]);

  const publish = useCallback((event, data) => {
    if (channelRef.current) {
      console.log('[DIAG] publish', event, data);
      channelRef.current.publish(event, data);
    } else {
      console.warn('[DIAG] publish called but no channel');
    }
  }, []);

  return { connected, publish };
}