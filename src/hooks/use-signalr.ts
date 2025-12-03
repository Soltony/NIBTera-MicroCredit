
'use client';

import { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';

export const useSignalR = (hubUrl: string) => {
    const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
    const connectionRef = useRef(connection);
    connectionRef.current = connection;

    useEffect(() => {
        const newConnection = new signalR.HubConnectionBuilder()
            .withUrl(hubUrl)
            .withAutomaticReconnect()
            .build();

        setConnection(newConnection);
    }, [hubUrl]);

    const startConnection = async () => {
        if (connectionRef.current && connectionRef.current.state === signalR.HubConnectionState.Disconnected) {
            try {
                await connectionRef.current.start();
                // connection established (log removed to reduce console noise)
            } catch (err) {
                console.error('SignalR Connection Error: ', err);
            }
        }
    };

    const stopConnection = () => {
        if (connectionRef.current && connectionRef.current.state === signalR.HubConnectionState.Connected) {
            connectionRef.current.stop();
            // connection stopped (log removed to reduce console noise)
        }
    };

    return { connection, startConnection, stopConnection };
};
