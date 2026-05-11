import React, { createContext, useContext, useState, useRef, ReactNode, useCallback, useEffect } from 'react';
import type { Contact, Message } from '../types';

interface WebRTCConnections {
  pc: RTCPeerConnection;
  channel: RTCDataChannel;
}

interface NexusContextType {
  contacts: Record<string, Contact>;
  activeContactId: string | null;
  myName: string;
  setActiveContactId: (id: string | null) => void;
  setMyName: (name: string) => void;
  addContact: (id: string, name: string, pc: RTCPeerConnection, channel: RTCDataChannel) => void;
  sendMessage: (contactId: string, type: Message['type'], data: any, fileName?: string, fileSize?: number) => void;
  clearHistory: (contactId: string) => void;
  closeConnection: (contactId: string) => void;
}

const NexusContext = createContext<NexusContextType | null>(null);

export function NexusProvider({ children }: { children: ReactNode }) {
  const [contacts, setContacts] = useState<Record<string, Contact>>(() => {
    try {
      const saved = localStorage.getItem('nexus_contacts');
      if (saved) {
        const parsed = JSON.parse(saved);
        Object.keys(parsed).forEach(k => {
          parsed[k].isOnline = false;
        });
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse contacts from local storage', e);
    }
    return {};
  });

  const [activeContactId, setActiveContactIdState] = useState<string | null>(() => {
    return localStorage.getItem('nexus_active_contact') || null;
  });
  
  const [myName, setMyNameState] = useState(() => localStorage.getItem('nexus_my_name') || '');

  const setMyName = useCallback((name: string) => {
    localStorage.setItem('nexus_my_name', name);
    setMyNameState(name);
  }, []);
  
  const connectionsRef = useRef<Record<string, WebRTCConnections>>({});

  useEffect(() => {
    try {
      localStorage.setItem('nexus_contacts', JSON.stringify(contacts));
    } catch (e) {
      console.warn('Failed to save contacts to local storage', e);
    }
  }, [contacts]);

  const setActiveContactId = useCallback((id: string | null) => {
    setActiveContactIdState(id);
    if (id) {
       localStorage.setItem('nexus_active_contact', id);
       setContacts(prev => {
         if (!prev[id]) return prev;
         return { ...prev, [id]: { ...prev[id], unread: 0 } };
       });
    } else {
       localStorage.removeItem('nexus_active_contact');
    }
  }, []);

  const appendMessage = useCallback((contactId: string, message: Message) => {
    setContacts(prev => {
      const contact = prev[contactId];
      if (!contact) return prev;
      return {
        ...prev,
        [contactId]: {
          ...contact,
          messages: [...contact.messages, message],
          unread: activeContactId === contactId ? 0 : contact.unread + 1
        }
      };
    });
  }, [activeContactId]);

  const addContact = useCallback((id: string, name: string, pc: RTCPeerConnection, channel: RTCDataChannel) => {
    connectionsRef.current[id] = { pc, channel };
    
    setContacts(prev => ({
      ...prev,
      [id]: {
        id,
        name,
        isOnline: false,
        unread: 0,
        messages: []
      }
    }));

    channel.onopen = () => {
      setContacts(prev => ({ ...prev, [id]: { ...prev[id], isOnline: true } }));
      appendMessage(id, {
        id: 'msg-' + Date.now(),
        type: 'sys',
        sender: 'sys',
        time: Date.now(),
        text: 'E2E Connection Established 🔐'
      });
    };

    channel.onclose = () => {
      setContacts(prev => ({ ...prev, [id]: { ...prev[id], isOnline: false } }));
      appendMessage(id, {
        id: 'msg-' + Date.now(),
        type: 'sys',
        sender: 'sys',
        time: Date.now(),
        text: 'Peer Disconnected 📴'
      });
    };

    channel.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        appendMessage(id, { ...data, id: 'msg-' + Date.now() + Math.random(), sender: 'peer', time: Date.now() });
      } catch (err) {
        appendMessage(id, {
          id: 'msg-' + Date.now() + Math.random(),
          type: 'text',
          text: e.data,
          sender: 'peer',
          time: Date.now()
        });
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setContacts(prev => ({ ...prev, [id]: { ...prev[id], isOnline: false } }));
      }
    };
  }, [appendMessage]);

  const sendMessage = useCallback((contactId: string, type: Message['type'], content: any, fileName?: string, fileSize?: number) => {
    const conn = connectionsRef.current[contactId];
    if (!conn || conn.channel.readyState !== 'open') return;

    const payload: Partial<Message> = { type };
    if (type === 'text') payload.text = content;
    else {
      payload.data = content;
      payload.fileName = fileName;
      payload.fileSize = fileSize;
    }

    try {
      conn.channel.send(JSON.stringify(payload));
      appendMessage(contactId, {
        ...payload as Message,
        id: 'msg-' + Date.now() + Math.random(),
        sender: 'me',
        time: Date.now()
      });
    } catch (err) {
      console.error('Failed to send', err);
    }
  }, [appendMessage]);

  const clearHistory = useCallback((contactId: string) => {
    setContacts(prev => {
      if (!prev[contactId]) return prev;
      return { ...prev, [contactId]: { ...prev[contactId], messages: [] } };
    });
  }, []);

  const closeConnection = useCallback((contactId: string) => {
    const conn = connectionsRef.current[contactId];
    if (conn) {
      conn.channel.close();
      conn.pc.close();
      delete connectionsRef.current[contactId];
    }
    setContacts(prev => {
      const copy = { ...prev };
      delete copy[contactId];
      return copy;
    });
    if (activeContactId === contactId) setActiveContactId(null);
  }, [activeContactId]);

  return (
    <NexusContext.Provider
      value={{
        contacts,
        activeContactId,
        myName,
        setActiveContactId: (id) => {
            setActiveContactId(id);
            if (id) {
                setContacts(prev => ({ ...prev, [id]: { ...prev[id], unread: 0 } }));
            }
        },
        setMyName,
        addContact,
        sendMessage,
        clearHistory,
        closeConnection
      }}
    >
      {children}
    </NexusContext.Provider>
  );
}

export function useNexus() {
  const context = useContext(NexusContext);
  if (!context) throw new Error('useNexus must be used within a NexusProvider');
  return context;
}
