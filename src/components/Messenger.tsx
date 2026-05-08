import React, { useState, useEffect, useRef } from 'react';
import { db, auth, handleFirestoreError } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  addDoc, 
  serverTimestamp, 
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  limit,
  deleteField,
  FirestoreError
} from 'firebase/firestore';
import { 
  Search, 
  Send, 
  User as UserIcon, 
  UserPlus,
  ArrowLeft, 
  Camera, 
  Phone, 
  Video, 
  MessageSquare, 
  MessageCircle,
  Zap,
  Plus, 
  Users, 
  Smile, 
  Check, 
  X,
  Edit2,
  Trash2,
  Palette,
  Mic,
  MicOff,
  Volume2,
  VolumeX
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MessengerProps {
  currentUser: any;
  onChatStatusChange?: (isActive: boolean) => void;
}

interface ChatUser {
  uid: string;
  username: string;
  fullName?: string;
  photoURL: string;
  statusMessage?: string;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  createdAt: any;
  senderName?: string;
  isEdited?: boolean;
  reactions?: Record<string, string[]>;
}

interface Chat {
  id: string;
  participants: string[];
  isGroup?: boolean;
  name?: string;
  photoURL?: string;
  lastMessage: string;
  lastMessageAt: any;
  typing?: Record<string, boolean>;
  otherUser?: ChatUser;
  joinedAt?: Record<string, any>;
}

const COMMON_EMOJIS = ["💢", "😭"];

const THEMES = {
  emerald: {
    name: 'Emerald',
    bg: 'bg-[#def9d4]',
    bubble: 'bg-[#34C759]',
    accent: 'text-[#34C759]',
    chatBg: 'rgb(222, 249, 212)'
  },
  midnight: {
    name: 'Midnight',
    bg: 'bg-[#1a1a1a]',
    bubble: 'bg-[#333333]',
    accent: 'text-white',
    chatBg: 'rgb(26, 26, 26)'
  },
  sunset: {
    name: 'Sunset',
    bg: 'bg-[#fff5eb]',
    bubble: 'bg-[#ff7e5f]',
    accent: 'text-[#ff7e5f]',
    chatBg: 'rgb(255, 245, 235)'
  },
  royal: {
    name: 'Royal',
    bg: 'bg-[#f5f3ff]',
    bubble: 'bg-[#8b5cf6]',
    accent: 'text-[#8b5cf6]',
    chatBg: 'rgb(245, 243, 255)'
  },
  ocean: {
    name: 'Ocean',
    bg: 'bg-[#ecfeff]',
    bubble: 'bg-[#06b6d4]',
    accent: 'text-[#06b6d4]',
    chatBg: 'rgb(236, 254, 255)'
  }
};

type ThemeKey = keyof typeof THEMES;

export default function Messenger({ currentUser, onChatStatusChange }: MessengerProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<ChatUser[]>([]);
  
  // Notification State
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
        });
      }
    }
  }, []);

  const showBrowserNotification = (title: string, body: string, icon?: string) => {
    if (document.hidden && notificationPermission === 'granted') {
      const options: any = {
        body,
        icon: icon || '/favicon.ico',
        tag: 'chatlink-notif',
        renotify: true
      };
      
      const n = new Notification(title, options);
      
      n.onclick = () => {
        window.focus();
        n.close();
      };

      // Auto-dismiss after 5 seconds
      setTimeout(() => n.close(), 5000);
    }
  };
  
  // Theme state
  const [activeTheme, setActiveTheme] = useState<ThemeKey>(() => {
    return (localStorage.getItem('chat-theme') as ThemeKey) || 'emerald';
  });
  const [showThemePicker, setShowThemePicker] = useState(false);

  const changeTheme = (theme: ThemeKey) => {
    setActiveTheme(theme);
    localStorage.setItem('chat-theme', theme);
    setShowThemePicker(false);
  };
  
  // Group creation state
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  useEffect(() => {
    onChatStatusChange?.(!!selectedChat || isCreatingGroup);
  }, [selectedChat, isCreatingGroup, onChatStatusChange]);
  const [selectedUsers, setSelectedUsers] = useState<ChatUser[]>([]);
  const [groupName, setGroupName] = useState('');
  
  // Group edit state
  const [isEditingChat, setIsEditingChat] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  
  // View members state
  const [viewingMembers, setViewingMembers] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [chatMembers, setChatMembers] = useState<ChatUser[]>([]);

  useEffect(() => {
    if (viewingMembers && selectedChat?.participants) {
      const fetchMembers = async () => {
        try {
          const membersList: ChatUser[] = [];
          for (const uid of selectedChat.participants) {
            const userSnap = await getDoc(doc(db, 'users', uid));
            if (userSnap.exists()) {
              const userData = userSnap.data();
              membersList.push({
                uid,
                username: userData.username || 'Unknown',
                fullName: userData.fullName || userData.username,
                photoURL: userData.photoURL || ''
              });
            }
          }
          setChatMembers(membersList);
        } catch (error) {
          console.error("Error fetching group members", error);
        }
      };
      fetchMembers();
    }
  }, [viewingMembers, selectedChat?.participants]);

  // Call state
  const [isCalling, setIsCalling] = useState(false);
  const [isCallMinimized, setIsCallMinimized] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const currentCallId = useRef<string | null>(null);
  const callUnsubs = useRef<(() => void)[]>([]);

  // Message edit/delete state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageText, setEditMessageText] = useState('');
  const [confirmingDeleteMessageId, setConfirmingDeleteMessageId] = useState<string | null>(null);
  const [isConfirmingChatDelete, setIsConfirmingChatDelete] = useState(false);
  const [isAddingPeople, setIsAddingPeople] = useState(false);

  // Message search state
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [isSearchingMessages, setIsSearchingMessages] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const callIntervalRef = useRef<any>(null);

  const servers = {
    iceServers: [
      {
        urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
      },
    ],
    iceCandidatePoolSize: 10,
  };

  // Global call listener
  useEffect(() => {
    if (!currentUser) return;
    
    // Listen for incoming calls
    const q = query(
      collection(db, 'calls'),
      where('receiverId', '==', currentUser.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const callData = { id: change.doc.id, ...change.doc.data() } as any;
          setIncomingCall(callData);
          
          // Trigger browser notification for call
          showBrowserNotification(
            'Incoming Call',
            `${callData.callerName || 'Someone'} is calling you...`,
            callData.callerPhotoURL
          );
        }
      });
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Handle active call state (timer and cleanup)
  useEffect(() => {
    if (isCalling) {
      setCallDuration(0);
      callIntervalRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    }
    return () => {
      if (callIntervalRef.current) clearInterval(callIntervalRef.current);
    };
  }, [isCalling]);

  // Attach remote stream to audio element
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const cleanupCall = async () => {
    // Unsubscribe from all call-related Firestore listeners first
    callUnsubs.current.forEach(unsub => unsub());
    callUnsubs.current = [];

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    
    // Potentially delete the call document to keep DB clean
    if (currentCallId.current) {
      try {
        const callRef = doc(db, 'calls', currentCallId.current);
        const snap = await getDoc(callRef);
        if (snap.exists()) {
          await deleteDoc(callRef);
        }
      } catch (e: any) {
        // Silently ignore if already deleted or permission denied during race condition
        if (e.code !== 'permission-denied' && e.code !== 'not-found') {
          console.error("Error cleaning up call session", e);
        }
      }
    }

    setRemoteStream(null);
    setIsCalling(false);
    setIsCallMinimized(false);
    setIncomingCall(null);
    setIsMuted(false);
    setIsSpeakerOn(false);
    currentCallId.current = null;
    if (callIntervalRef.current) clearInterval(callIntervalRef.current);
  };

  const setupPC = async () => {
    const peerConnection = new RTCPeerConnection(servers);
    pc.current = peerConnection;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setLocalStream(stream);
    stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

    peerConnection.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    return peerConnection;
  };

  const startCall = async () => {
    if (!selectedChat || selectedChat.isGroup || !selectedChat.otherUser) return;
    
    setIsCalling(true);
    const peerConnection = await setupPC();
    
    const callDoc = doc(collection(db, 'calls'));
    currentCallId.current = callDoc.id;

    // Exchange ICE Candidates
    const callerCandidatesCollection = collection(db, 'calls', callDoc.id, 'callerCandidates');
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(callerCandidatesCollection, {
          ...event.candidate.toJSON(),
          callerId: currentUser.uid,
          receiverId: selectedChat.otherUser!.uid
        });
      }
    };

    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await setDoc(callDoc, {
      callerId: currentUser.uid,
      callerName: currentUser.displayName,
      callerPhotoURL: currentUser.photoURL,
      receiverId: selectedChat.otherUser.uid,
      offer,
      status: 'pending',
      createdAt: serverTimestamp()
    });

    // Listen for Answer
    const unsubAnswer = onSnapshot(callDoc, (snapshot) => {
      const data = snapshot.data();
      if (!peerConnection.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        peerConnection.setRemoteDescription(answerDescription);
        setIsCalling(true);
      }
      if (data?.status === 'ended' || data?.status === 'rejected') {
        cleanupCall();
      }
    }, (error) => {
      if (error.code !== 'permission-denied') console.error("Answer listener error", error);
    });
    callUnsubs.current.push(unsubAnswer);

    // Listen for Receiver ICE Candidates
    const unsubCandidates = onSnapshot(collection(db, 'calls', callDoc.id, 'receiverCandidates'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          peerConnection.addIceCandidate(candidate);
        }
      });
    }, (error) => {
      if (error.code !== 'permission-denied') console.error("Candidates listener error", error);
    });
    callUnsubs.current.push(unsubCandidates);
  };

  const acceptCall = async () => {
    if (!incomingCall) return;

    setIsCalling(true);
    const peerConnection = await setupPC();
    const callDoc = doc(db, 'calls', incomingCall.id);
    currentCallId.current = incomingCall.id;

    // Exchange ICE Candidates
    const receiverCandidatesCollection = collection(db, 'calls', incomingCall.id, 'receiverCandidates');
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(receiverCandidatesCollection, {
          ...event.candidate.toJSON(),
          callerId: incomingCall.callerId,
          receiverId: currentUser.uid
        });
      }
    };

    const offerDescription = incomingCall.offer;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await updateDoc(callDoc, { answer, status: 'active' });

    // Listen for Caller ICE Candidates
    const unsubCandidates = onSnapshot(collection(db, 'calls', incomingCall.id, 'callerCandidates'), (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          peerConnection.addIceCandidate(candidate);
        }
      });
    }, (error) => {
      if (error.code !== 'permission-denied') console.error("Candidates listener error", error);
    });
    callUnsubs.current.push(unsubCandidates);

    // Listen for Call ending
    const unsubCall = onSnapshot(callDoc, (snapshot) => {
      const data = snapshot.data();
      if (data?.status === 'ended' || data?.status === 'rejected') {
        cleanupCall();
      }
    }, (error) => {
      if (error.code !== 'permission-denied') console.error("Call listener error", error);
    });
    callUnsubs.current.push(unsubCall);
  };

  const endCall = async () => {
    if (currentCallId.current) {
      await updateDoc(doc(db, 'calls', currentCallId.current), { status: 'ended' });
    }
    cleanupCall();
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = () => {
    // Speaker switching via setSinkId is not universally supported,
    // so we'll treat this as a UI-driven state for now.
    setIsSpeakerOn(!isSpeakerOn);
    if (remoteAudioRef.current && (remoteAudioRef.current as any).setSinkId) {
      // Logic for switching output device would go here if we had device IDs
    }
  };

  const rejectCall = async () => {
    if (incomingCall) {
      await updateDoc(doc(db, 'calls', incomingCall.id), { status: 'rejected' });
    }
    setIncomingCall(null);
  };

  const reactToMessage = async (messageId: string, emoji: string) => {
    if (!selectedChat) return;
    try {
      const messageRef = doc(db, 'chats', selectedChat.id, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);
      if (!messageSnap.exists()) return;
      
      const data = messageSnap.data();
      const currentReactions = data.reactions || {};
      const users = currentReactions[emoji] || [];
      
      let newUsers;
      if (users.includes(currentUser.uid)) {
        newUsers = users.filter((uid: string) => uid !== currentUser.uid);
      } else {
        newUsers = [...users, currentUser.uid];
      }
      
      const newReactions = { ...currentReactions };
      if (newUsers.length === 0) {
        delete newReactions[emoji];
      } else {
        newReactions[emoji] = newUsers;
      }
      
      await updateDoc(messageRef, { reactions: newReactions });
    } catch (error) {
      handleFirestoreError(error as FirestoreError, 'update', `chats/${selectedChat.id}/messages/${messageId}`);
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    if (!selectedChat || !newText.trim()) return;
    try {
      const messageRef = doc(db, 'chats', selectedChat.id, 'messages', messageId);
      await updateDoc(messageRef, {
        text: newText,
        isEdited: true,
        updatedAt: serverTimestamp()
      });
      setEditingMessageId(null);
      setEditMessageText('');
    } catch (error) {
      handleFirestoreError(error as FirestoreError, 'update', `chats/${selectedChat.id}/messages/${messageId}`);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedChat) return;
    try {
      const messageRef = doc(db, 'chats', selectedChat.id, 'messages', messageId);
      await deleteDoc(messageRef);
      setConfirmingDeleteMessageId(null);
    } catch (error) {
      handleFirestoreError(error as FirestoreError, 'delete', `chats/${selectedChat.id}/messages/${messageId}`);
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedChat) return;
    try {
      const chatRef = doc(db, 'chats', selectedChat.id);
      await deleteDoc(chatRef);
      setSelectedChat(null);
      setIsConfirmingChatDelete(false);
    } catch (error) {
      console.error("Error deleting chat", error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chats - update selectedChat if it's currently open
  useEffect(() => {
    if (!currentUser) return;

    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      const chatsData: Chat[] = [];
      
      // Check for document changes to trigger notifications
      snapshot.docChanges().forEach(change => {
        if (change.type === 'modified') {
          const chat = change.doc.data();
          const lastMessageAt = chat.lastMessageAt?.toMillis?.() || 0;
          const now = Date.now();
          
          // Only notify if message is recent (within last 30s) and sender is someone else
          if (
            chat.lastMessageSenderId !== currentUser.uid && 
            (now - lastMessageAt < 30000)
          ) {
            showBrowserNotification(
              chat.isGroup ? `New in ${chat.name}` : (chat.lastMessageSenderName || 'New Message'),
              chat.lastMessage || 'Sent a message',
              chat.isGroup ? undefined : chat.otherUser?.photoURL
            );
          }
        }
      });

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        let otherUser = undefined;

        if (!data.isGroup) {
          const otherUserId = data.participants.find((uid: string) => uid !== currentUser.uid);
          if (otherUserId) {
            const userSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', otherUserId)));
            if (!userSnap.empty) {
              const userData = userSnap.docs[0].data();
              otherUser = { 
                uid: otherUserId, 
                username: userData.username || 'Unknown', 
                fullName: userData.fullName || userData.username,
                photoURL: userData.photoURL || '',
                statusMessage: userData.statusMessage || ''
              };
            }
          }
        }

        const chatObj = {
          id: docSnap.id,
          ...data,
          otherUser
        } as Chat;
        
        chatsData.push(chatObj);
        
        // Update selected chat details if open
        if (selectedChat && selectedChat.id === chatObj.id) {
          setSelectedChat(chatObj);
        }
      }
      setChats(chatsData);
    });

    return () => unsubscribe();
  }, [currentUser, selectedChat?.id]);

  // Load messages
  useEffect(() => {
    if (!selectedChat || !currentUser) {
      setMessages([]);
      return;
    }

    // Get user's join time for this chat to filter historical messages
    const myJoinTime = selectedChat.joinedAt?.[currentUser.uid];

    const messagesCollection = collection(db, 'chats', selectedChat.id, 'messages');
    let messagesQuery;

    if (myJoinTime) {
      messagesQuery = query(
        messagesCollection,
        where('createdAt', '>=', myJoinTime),
        orderBy('createdAt', 'asc'),
        limit(200)
      );
    } else {
      messagesQuery = query(
        messagesCollection,
        orderBy('createdAt', 'asc'),
        limit(200)
      );
    }

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(messagesData);
    }, (error) => {
      handleFirestoreError(error as FirestoreError, 'list', `chats/${selectedChat.id}/messages`);
    });

    return () => unsubscribe();
  }, [selectedChat?.id, currentUser?.uid, selectedChat?.joinedAt?.[currentUser?.uid]]);

  // Search users
  useEffect(() => {
    const fetchUsers = async () => {
      if (!searchQuery.trim()) {
        setUsers([]);
        return;
      }

      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const queryLower = searchQuery.toLowerCase();
      
      const filtered = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as ChatUser))
        .filter(u => u.uid !== currentUser.uid && (
          (u.username?.toLowerCase().includes(queryLower)) || 
          (u.fullName?.toLowerCase().includes(queryLower))
        ))
        .slice(0, 10);
      
      setUsers(filtered);
    };

    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, currentUser.uid]);

  const addParticipant = async (user: ChatUser) => {
    if (!selectedChat || !selectedChat.id) return;
    
    try {
      const chatRef = doc(db, 'chats', selectedChat.id);
      await updateDoc(chatRef, {
        participants: [...selectedChat.participants, user.uid],
        [`joinedAt.${user.uid}`]: serverTimestamp()
      });
      setIsAddingPeople(false);
      setSearchQuery('');
    } catch (error) {
      console.error("Error adding participant", error);
    }
  };

  const handleTyping = () => {
    if (!selectedChat || !currentUser) return;

    const chatRef = doc(db, 'chats', selectedChat.id);
    updateDoc(chatRef, {
      [`typing.${currentUser.uid}`]: true
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      updateDoc(chatRef, {
        [`typing.${currentUser.uid}`]: deleteField()
      });
    }, 3000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    const text = newMessage;
    setNewMessage('');
    setShowEmojiPicker(false);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    await updateDoc(doc(db, 'chats', selectedChat.id), {
      [`typing.${currentUser.uid}`]: deleteField()
    });

    try {
      const messagesPath = `chats/${selectedChat.id}/messages`;
      await addDoc(collection(db, messagesPath), {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'User',
        text,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', selectedChat.id), {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: currentUser.uid,
        lastMessageSenderName: currentUser.displayName || 'User'
      });
    } catch (error) {
      handleFirestoreError(error as FirestoreError, 'write', `chats/${selectedChat.id}`);
    }
  };

  const startPrivateChat = async (otherUser: ChatUser) => {
    const existing = chats.find(c => !c.isGroup && c.participants.includes(otherUser.uid));
    if (existing) {
      setSelectedChat(existing);
      setSearchQuery('');
      return;
    }

    try {
      const newChatRef = await addDoc(collection(db, 'chats'), {
        participants: [currentUser.uid, otherUser.uid],
        isGroup: false,
        lastMessage: '',
        lastMessageAt: serverTimestamp(),
        typing: {},
        joinedAt: {
          [currentUser.uid]: serverTimestamp(),
          [otherUser.uid]: serverTimestamp()
        }
      });
      setSearchQuery('');
    } catch (error) {
      console.error("Error starting chat", error);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedUsers.length === 0) return;

    try {
      const participantIds = [currentUser.uid, ...selectedUsers.map(u => u.uid)];
      const joinedAt: Record<string, any> = {};
      participantIds.forEach(uid => {
        joinedAt[uid] = serverTimestamp();
      });

      await addDoc(collection(db, 'chats'), {
        participants: participantIds,
        isGroup: true,
        name: groupName,
        photoURL: '',
        lastMessage: 'Group created',
        lastMessageAt: serverTimestamp(),
        typing: {},
        joinedAt
      });
      setIsCreatingGroup(false);
      setSelectedUsers([]);
      setGroupName('');
      setSearchQuery('');
    } catch (error) {
      console.error("Error creating group", error);
    }
  };

  const updateChatMetadata = async () => {
    if (!selectedChat) return;
    try {
      await updateDoc(doc(db, 'chats', selectedChat.id), {
        name: editName || selectedChat.name,
        photoURL: editPhoto || selectedChat.photoURL
      });
      setIsEditingChat(false);
    } catch (error) {
      console.error("Error updating group", error);
    }
  };

  const handleEditPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setEditPhoto(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
  };

  const toggleUserSelection = (user: ChatUser) => {
    if (selectedUsers.find(u => u.uid === user.uid)) {
      setSelectedUsers(prev => prev.filter(u => u.uid !== user.uid));
    } else {
      setSelectedUsers(prev => [...prev, user]);
    }
  };



  return (
    <div className="h-full relative flex flex-col bg-slate-50 md:bg-transparent overflow-hidden">
      {/* Global Overlays (Calls, Notifications) */}
      <audio ref={remoteAudioRef} autoPlay />
      
      <AnimatePresence>
        {incomingCall && !isCalling && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 w-full max-w-sm z-[100] px-4"
          >
            <div className="bg-slate-900 text-white p-5 rounded-3xl shadow-2xl flex items-center justify-between border border-white/10 backdrop-blur-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-brand-accent flex items-center justify-center text-xl font-bold shadow-lg animate-pulse">
                  {incomingCall.callerName?.[0] || 'U'}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-brand-accent uppercase tracking-widest mb-0.5">Incoming Audio Call</p>
                  <p className="text-sm font-bold truncate">{incomingCall.callerName || 'Unknown User'}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={rejectCall} className="p-3 bg-red-500/20 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all">
                  <X className="w-5 h-5" />
                </button>
                <button onClick={acceptCall} className="p-3 bg-green-500 text-white rounded-full hover:bg-green-600 shadow-lg shadow-green-500/30 animate-bounce">
                  <Phone className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-1 overflow-hidden h-full gap-6">
        {/* SIDEBAR: Chat List & Search (Hidden on mobile if chat selected) */}
        <div className={`${selectedChat ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 shrink-0 bg-white md:rounded-2xl md:shadow-sm md:border md:border-slate-200 overflow-hidden`}>
          <div className="p-4 border-b border-slate-100 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Messages</h2>
              <button 
                onClick={() => setIsCreatingGroup(true)}
                className="p-2 hover:bg-slate-50 rounded-xl text-brand-accent transition-colors"
                title="Start Group"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search @username..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:ring-2 focus:ring-brand-accent outline-none font-medium transition-all"
              />
            </div>
          </div>

          {searchQuery.trim() && (
            <div className="p-2 bg-slate-50 border-b border-slate-100 max-h-60 overflow-y-auto">
              {users.length > 0 ? users.map(u => (
                <button key={u.uid} onClick={() => { startPrivateChat(u); setSearchQuery(''); }} className="w-full flex items-center gap-3 p-3 hover:bg-white rounded-xl transition-all text-left group">
                  <div className="w-10 h-10 rounded-full bg-brand-accent/10 flex items-center justify-center font-bold text-brand-accent ring-1 ring-slate-100">
                    {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover rounded-full" /> : u.username?.[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-800">{u.fullName || u.username}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">@{u.username}</p>
                  </div>
                  <MessageCircle className="w-4 h-4 text-slate-200 group-hover:text-brand-accent transition-colors" />
                </button>
              )) : <div className="p-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Searching...</div>}
            </div>
          )}

          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {chats.length > 0 ? chats.map(chat => {
              const typingUsersList = Object.keys(chat.typing || {}).filter(uid => uid !== currentUser.uid);
              const isActive = selectedChat?.id === chat.id;
              return (
                <button 
                  key={chat.id}
                  onClick={() => setSelectedChat(chat)}
                  className={`w-full p-4 flex items-center gap-4 transition-all text-left ${isActive ? 'bg-brand-accent/5 ring-1 ring-inset ring-brand-accent/10' : 'hover:bg-slate-50'}`}
                >
                  <div className="relative shrink-0">
                    <div className={`w-12 h-12 rounded-full overflow-hidden border-2 ${isActive ? 'border-brand-accent' : 'border-white shadow-sm'} ring-1 ring-slate-100`}>
                      {chat.isGroup ? (
                        chat.photoURL ? <img src={chat.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 uppercase font-bold text-lg"><Users className="w-5 h-5" /></div>
                      ) : (
                        chat.otherUser?.photoURL ? <img src={chat.otherUser.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400 uppercase font-bold text-lg">{chat.otherUser?.username?.[0] || 'U'}</div>
                      )}
                    </div>
                    {!chat.isGroup && <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className={`font-bold text-sm truncate uppercase tracking-tight ${isActive ? 'text-brand-accent' : 'text-slate-800'}`}>
                        {chat.isGroup ? (chat.name || 'Group Chat') : (chat.otherUser?.fullName || chat.otherUser?.username)}
                      </h3>
                      <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap ml-2">
                        {chat.lastMessageAt ? new Date(chat.lastMessageAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <p className={`text-xs truncate leading-relaxed ${typingUsersList.length > 0 ? 'text-brand-accent italic font-bold animate-pulse' : 'text-slate-500'}`}>
                      {typingUsersList.length > 0 ? 'typing...' : (chat.lastMessage || 'start chatting')}
                    </p>
                  </div>
                </button>
              );
            }) : (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center text-slate-400">
                <MessageSquare className="w-12 h-12 mb-4 opacity-10" />
                <p className="text-sm font-bold uppercase tracking-widest opacity-40">No Messages Yet</p>
              </div>
            )}
          </div>
        </div>

        {/* MAIN CHAT WINDOW */}
        <div className={`${selectedChat ? 'flex' : 'hidden md:flex'} flex-1 flex-col bg-white md:rounded-2xl md:shadow-sm md:border md:border-slate-200 overflow-hidden relative`}>
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-3 md:p-4 border-b border-slate-100 flex items-center justify-between bg-white z-20 shrink-0">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <button onClick={() => setSelectedChat(null)} className="md:hidden p-2 text-slate-400 hover:bg-slate-50 rounded-full">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-100 shrink-0">
                    {selectedChat.isGroup ? (
                      selectedChat.photoURL ? <img src={selectedChat.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400"><Users className="w-5 h-5" /></div>
                    ) : (
                      selectedChat.otherUser?.photoURL ? <img src={selectedChat.otherUser.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-lg">{selectedChat.otherUser?.username?.[0] || 'U'}</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-800 text-sm leading-tight truncate uppercase tracking-tight">{selectedChat.isGroup ? (selectedChat.name || 'Group Chat') : (selectedChat.otherUser?.fullName || selectedChat.otherUser?.username)}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      {Object.keys(selectedChat.typing || {}).filter(uid => uid !== currentUser.uid).length > 0 ? (
                        <span className="text-brand-accent italic animate-pulse">Typing...</span>
                      ) : (
                        selectedChat.isGroup ? `${selectedChat.participants.length} Members` : 'Real-time'
                      )}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => { setIsSearchingMessages(!isSearchingMessages); setIsEditingChat(false); setIsAddingPeople(false); }}
                    className={`p-2 rounded-xl transition-colors ${isSearchingMessages ? 'bg-brand-accent/10 text-brand-accent' : 'hover:bg-slate-50 text-slate-400'}`}
                  >
                    <Search className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => { setShowThemePicker(!showThemePicker); setIsSearchingMessages(false); }}
                    className={`p-2 rounded-xl transition-colors ${showThemePicker ? 'bg-brand-accent/10 text-brand-accent' : 'hover:bg-slate-50 text-slate-400'}`}
                  >
                    <Palette className="w-4 h-4" />
                  </button>
                  <button onClick={startCall} disabled={selectedChat.isGroup} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 disabled:opacity-30">
                    <Phone className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                        if (selectedChat.isGroup) {
                            setViewingMembers(true);
                        } else {
                            setIsConfirmingChatDelete(true);
                        }
                    }} 
                    className="p-2 hover:bg-red-50 rounded-xl text-slate-400 hover:text-red-500 transition-colors"
                  >
                    {selectedChat.isGroup ? <Users className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Message Search Bar */}
              <AnimatePresence>
                {isSearchingMessages && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-slate-50 border-b border-slate-100 overflow-hidden shrink-0">
                    <div className="p-3 relative">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input 
                        type="text" 
                        value={messageSearchQuery}
                        onChange={(e) => setMessageSearchQuery(e.target.value)}
                        placeholder="Search messages..."
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-accent"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages Thread */}
              <div 
                className={`flex-1 overflow-y-auto p-4 space-y-4 ${THEMES[activeTheme].bg}`}
                style={{ 
                    backgroundImage: `radial-gradient(rgba(0,0,0,0.02) 1px, transparent 1px)`,
                    backgroundSize: '24px 24px'
                }}
              >
                {(messageSearchQuery.trim() ? messages.filter(m => m.text.toLowerCase().includes(messageSearchQuery.toLowerCase())) : messages).map((msg, i) => {
                  const isMe = msg.senderId === currentUser.uid;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}>
                      {selectedChat.isGroup && !isMe && (i === 0 || messages[i-1].senderId !== msg.senderId) && (
                        <span className="text-[10px] font-bold text-slate-400 mb-1 ml-2 uppercase tracking-widest">{msg.senderName}</span>
                      )}
                      
                      <div className={`relative max-w-[85%] flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`rounded-2xl px-4 py-2.5 shadow-sm text-[13px] leading-relaxed max-w-full break-words ${isMe ? `${THEMES[activeTheme].bubble} text-white rounded-br-none` : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/50'}`}>
                          {msg.text}
                          {msg.isEdited && <span className="block text-[8px] opacity-60 mt-1 italic">edited</span>}
                        </div>
                        
                        {/* Hover Actions */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 scale-90 origin-bottom">
                          {isMe && (
                            <>
                              <button onClick={() => { setEditingMessageId(msg.id); setEditMessageText(msg.text); }} className="p-1 hover:bg-slate-100 rounded text-slate-400"><Edit2 className="w-3 h-3" /></button>
                              <button onClick={() => handleDeleteMessage(msg.id)} className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                            </>
                          )}
                          <div className="flex bg-white shadow-sm border border-slate-100 rounded-full px-1">
                            {COMMON_EMOJIS.map(emoji => (
                              <button key={emoji} onClick={() => reactToMessage(msg.id, emoji)} className="p-1 hover:scale-125 transition-transform text-xs">{emoji}</button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Reactions */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={`flex gap-1 mt-1 ${isMe ? 'justify-end pr-1' : 'justify-start pl-1'}`}>
                          {Object.entries(msg.reactions).map(([emoji, uids]) => (
                            <button 
                                key={emoji} 
                                onClick={() => reactToMessage(msg.id, emoji)}
                                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border transition-all ${(uids as string[]).includes(currentUser.uid) ? 'bg-brand-accent/10 border-brand-accent text-brand-accent' : 'bg-white border-slate-100 text-slate-500'}`}
                            >
                                <span>{emoji}</span> <span>{(uids as string[]).length}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4 bg-white border-t border-slate-100 relative shrink-0">
                <AnimatePresence>
                  {showEmojiPicker && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                      className="absolute bottom-full left-4 mb-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-xl z-30"
                    >
                      <div className="grid grid-cols-5 gap-2">
                        {COMMON_EMOJIS.map(emoji => (
                          <button key={emoji} onClick={() => { addEmoji(emoji); setShowEmojiPicker(false); }} className="text-xl hover:scale-125 transition-transform p-1">{emoji}</button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                  <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-slate-400 hover:text-brand-accent transition-colors">
                    <Smile className="w-5 h-5" />
                  </button>
                  <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
                    placeholder="Message..."
                    className="flex-1 bg-slate-50 border-none rounded-2xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-brand-accent outline-none font-medium text-slate-800"
                  />
                  <button 
                    type="submit"
                    disabled={!newMessage.trim()}
                    className={`p-3 rounded-2xl text-white shadow-lg transition-all active:scale-95 disabled:grayscale disabled:opacity-40 shrink-0 ${THEMES[activeTheme].bubble}`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/30">
              <div className="w-24 h-24 bg-white rounded-[32%] flex items-center justify-center shadow-sm mb-6 border border-slate-100">
                <Zap className="w-12 h-12 text-brand-accent fill-brand-accent opacity-20" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Select a conversation</h2>
              <p className="text-sm text-slate-400 max-w-[280px] leading-relaxed uppercase tracking-tighter font-bold">Pick someone from the left menu to start messaging real-time.</p>
            </div>
          )}
        </div>
      </div>

      {/* OVERLAY: Group Creation */}
      <AnimatePresence>
        {isCreatingGroup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-white/20">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Create New Group</h3>
                    <button onClick={() => { setIsCreatingGroup(false); setSelectedUsers([]); }} className="p-2 hover:bg-slate-50 rounded-full text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <input 
                            type="text" 
                            placeholder="Group Name" 
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-brand-accent outline-none font-bold"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                        />
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search friends..." 
                                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-brand-accent outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {users.length > 0 ? users.map(u => {
                            const isSelected = selectedUsers.some(su => su.uid === u.uid);
                            return (
                                <button key={u.uid} onClick={() => toggleUserSelection(u)} className={`w-full flex items-center justify-between p-3 rounded-2xl border transition-all ${isSelected ? 'border-brand-accent bg-brand-accent/5' : 'border-slate-50 hover:border-slate-200'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-brand-accent/10 flex items-center justify-center font-bold text-brand-accent uppercase">
                                            {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover rounded-full" /> : u.username?.[0]}
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-bold text-slate-800 leading-tight">{u.fullName || u.username}</p>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">@{u.username}</p>
                                        </div>
                                    </div>
                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-brand-accent border-brand-accent' : 'border-slate-200'}`}>
                                        {isSelected && <Check className="w-3 h-3 text-white" />}
                                    </div>
                                </button>
                            );
                        }) : searchQuery.trim() ? (
                            <div className="text-center py-8 text-slate-400 uppercase text-[10px] font-bold tracking-widest">No users found</div>
                        ) : (
                            <div className="text-center py-8 text-slate-400 uppercase text-[10px] font-bold tracking-widest opacity-60">Search above to add friends</div>
                        )}
                    </div>
                </div>
                <div className="p-6 bg-slate-50 flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">{selectedUsers.length} Selected</p>
                    <button 
                        onClick={createGroup}
                        disabled={!groupName.trim() || selectedUsers.length < 1}
                        className="px-8 py-3 bg-brand-accent text-white rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-brand-accent/20 disabled:grayscale disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
                    >
                        Create Group
                    </button>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OVERLAY: Member List */}
      <AnimatePresence>
        {viewingMembers && selectedChat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden border border-white/20">
                <div className="relative p-6 text-center border-b border-slate-100">
                    <button onClick={() => setViewingMembers(false)} className="absolute top-6 right-6 p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                    <div className="w-20 h-20 bg-brand-accent/10 rounded-[28%] flex items-center justify-center mx-auto mb-4 border-2 border-white shadow-sm font-black text-brand-accent text-2xl uppercase">
                        {selectedChat.photoURL ? <img src={selectedChat.photoURL} className="w-full h-full object-cover rounded-[28%]" /> : (selectedChat.name?.[0] || 'G')}
                    </div>
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight leading-tight">{selectedChat.name || 'Group Chat'}</h3>
                    <p className="text-[10px] text-brand-accent font-bold uppercase tracking-widest">{selectedChat.participants.length} Active Members</p>
                </div>
                <div className="p-4 max-h-[400px] overflow-y-auto space-y-2 custom-scrollbar">
                    {chatMembers.map(member => (
                        <div key={member.uid} className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 transition-all group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 ring-2 ring-white overflow-hidden shrink-0">
                                    {member.photoURL ? <img src={member.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-bold text-slate-400 bg-slate-100 uppercase text-sm">{member.username[0]}</div>}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-slate-800 leading-none">{member.fullName || member.username} {member.uid === currentUser.uid && <span className="text-[9px] text-green-500 font-black ml-1 uppercase">You</span>}</p>
                                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-tighter opacity-70">@{member.username}</p>
                                </div>
                            </div>
                            {member.uid !== currentUser.uid && (
                                <button onClick={() => { setViewingMembers(false); startPrivateChat(member); }} className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-400 hover:text-brand-accent hover:border-brand-accent opacity-0 group-hover:opacity-100 transition-all">
                                    <MessageCircle className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-slate-50 flex gap-2">
                    <button onClick={() => { setViewingMembers(false); setIsAddingPeople(true); }} className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all">Add People</button>
                    <button onClick={() => { setViewingMembers(false); setIsEditingChat(true); setEditName(selectedChat.name || ''); }} className="flex-1 py-3 bg-brand-accent text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-brand-accent/20 hover:scale-105 transition-all">Manage</button>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OVERLAY: Add People */}
      <AnimatePresence>
        {isAddingPeople && selectedChat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Add Members</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Adding to {selectedChat.name}</p>
                    </div>
                    <button onClick={() => setIsAddingPeople(false)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Find friends to add..." 
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-brand-accent outline-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {users.filter(u => !selectedChat.participants.includes(u.uid)).length > 0 ? (
                            users.filter(u => !selectedChat.participants.includes(u.uid)).map(u => (
                                <button key={u.uid} onClick={() => addParticipant(u)} className="w-full flex items-center gap-3 p-3 rounded-2xl border border-slate-50 hover:border-brand-accent hover:bg-brand-accent/5 transition-all group">
                                    <div className="w-10 h-10 rounded-full bg-brand-accent/10 flex items-center justify-center font-bold text-brand-accent uppercase">
                                        {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover rounded-full" /> : u.username?.[0]}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-sm font-bold text-slate-800 leading-tight">{u.fullName || u.username}</p>
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">@{u.username}</p>
                                    </div>
                                    <Plus className="w-4 h-4 text-brand-accent opacity-0 group-hover:opacity-100 transition-all scale-75" />
                                </button>
                            ))
                        ) : searchQuery.trim() ? (
                            <div className="text-center py-8 text-slate-400 uppercase text-[10px] font-bold tracking-widest">No friends found</div>
                        ) : (
                            <div className="text-center py-8 text-slate-400 uppercase text-[10px] font-bold tracking-widest opacity-60">Search above to find users</div>
                        )}
                    </div>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OVERLAY: Confirm Delete */}
      <AnimatePresence>
        {isConfirmingChatDelete && selectedChat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="bg-white w-full max-w-sm rounded-[32px] p-8 text-center space-y-6 shadow-2xl overflow-hidden border border-white/20">
                <div className="w-20 h-20 bg-red-50 rounded-[28%] flex items-center justify-center mx-auto text-red-500 shadow-inner">
                    <Trash2 className="w-10 h-10" />
                </div>
                <div>
                   <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Delete Conversation?</h3>
                   <p className="text-sm text-slate-500 font-medium leading-relaxed mt-2 uppercase tracking-tighter">This action is permanent. You will lose the entire message history with {selectedChat.isGroup ? selectedChat.name : (selectedChat.otherUser?.fullName || selectedChat.otherUser?.username)}.</p>
                </div>
                <div className="flex flex-col gap-3">
                   <button onClick={handleDeleteChat} className="w-full py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-red-500/30 hover:scale-[1.02] active:scale-95 transition-all">Yes, Delete Everything</button>
                   <button onClick={() => setIsConfirmingChatDelete(false)} className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Keep Chatting</button>
                </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
