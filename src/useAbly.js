import { useEffect, useRef, useState, useCallback } from 'react';
import Ably from 'ably';

const ABLY_KEY = import.meta.env.VITE_ABLY_KEY;

export function useAbly(roomCode, playerId, onMessage) {
  const clientRef = useRef(null);
  const channelRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!roomCode || !ABLY_KEY) return;

    const client = new Ably.Realtime({ key: ABLY_KEY, clientId: playerId });
    clientRef.current = client;

    client.connection.on('connected', () => setConnected(true));
    client.connection.on('disconnected', () => setConnected(false));

    const channel = client.channels.get(`set-game-${roomCode}`);
    channelRef.current = channel;

    channel.subscribe((msg) => {
      if (msg.clientId !== playerId) {
        onMessage(msg.name, msg.data);
      }
    });

    return () => {
      channel.unsubscribe();
      client.close();
    };
  }, [roomCode]);

  const publish = useCallback((event, data) => {
    if (channelRef.current) {
      channelRef.current.publish(event, data);
    }
  }, []);

  return { connected, publish };
}
