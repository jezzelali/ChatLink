import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../lib/firebase';
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
  deleteField
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

const COMMON_EMOJIS = ["🖕", "💢", "😭"];

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
      console.error("Error reacting to message", error);
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
      console.error("Error editing message", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!selectedChat) return;
    try {
      const messageRef = doc(db, 'chats', selectedChat.id, 'messages', messageId);
      await deleteDoc(messageRef);
      setConfirmingDeleteMessageId(null);
    } catch (error) {
      console.error("Error deleting message", error);
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

    let messagesQuery = query(
      collection(db, 'chats', selectedChat.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    // If join time exists, only show messages after joining
    if (myJoinTime) {
      messagesQuery = query(
        collection(db, 'chats', selectedChat.id, 'messages'),
        where('createdAt', '>=', myJoinTime),
        orderBy('createdAt', 'asc'),
        limit(100)
      );
    }

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(messagesData);
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
      await addDoc(collection(db, 'chats', selectedChat.id, 'messages'), {
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
      console.error("Error sending message", error);
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

  if (isCreatingGroup) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }} 
        animate={{ opacity: 1, scale: 1 }} 
        className="flex flex-col h-full bg-white md:rounded-2xl md:shadow-sm md:border md:border-slate-200 p-6 space-y-6 overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">New Group Chat</h2>
          <button onClick={() => setIsCreatingGroup(false)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Group Name</label>
            <input 
              type="text" 
              value={groupName} 
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-accent outline-none font-medium"
              placeholder="E.g. Squad Goals"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Add Participants</label>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or @username..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
              />
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1 p-1">
              {users.map(u => (
                <button 
                  key={u.uid} 
                  onClick={() => toggleUserSelection(u)}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition-colors ${selectedUsers.find(sel => sel.uid === u.uid) ? 'bg-brand-accent/10 border-brand-accent/20 border' : 'hover:bg-slate-50 border border-transparent'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-accent/20 overflow-hidden border border-slate-100">
                      {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-brand-accent font-bold text-xs">{u.username?.[0]}</div>}
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-800 leading-tight">{u.fullName || u.username}</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-tighter">@{u.username}</p>
                    </div>
                  </div>
                  {selectedUsers.find(sel => sel.uid === u.uid) && <Check className="w-4 h-4 text-brand-accent" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button 
          onClick={createGroup}
          disabled={!groupName.trim() || selectedUsers.length === 0}
          className="w-full bg-brand-accent text-white py-4 rounded-xl font-bold shadow-lg shadow-brand-accent/20 disabled:opacity-50 transition-all uppercase tracking-widest text-xs"
        >
          Initialize Group ({selectedUsers.length} Users)
        </button>
      </motion.div>
    );
  }

  if (selectedChat) {
    const typingUsers = Object.keys(selectedChat.typing || {}).filter(uid => uid !== currentUser.uid);

    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }} 
        animate={{ opacity: 1, x: 0 }} 
        className="flex flex-col h-full md:h-[calc(100vh-40px)] bg-white md:rounded-2xl md:shadow-sm md:border md:border-slate-200 overflow-hidden relative"
      >
        <audio ref={remoteAudioRef} autoPlay />
        
        {/* Chat Header */}
        <div className="p-3 md:p-4 border-b border-slate-100 flex items-center justify-between bg-white z-20 shadow-sm shrink-0">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button onClick={() => { setSelectedChat(null); setIsEditingChat(false); setIsSearchingMessages(false); setMessageSearchQuery(''); }} className="p-1 md:p-2 hover:bg-slate-50 rounded-full text-green-500">
              <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-100 shrink-0">
              {selectedChat.isGroup ? (
                selectedChat.photoURL ? <img src={selectedChat.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-400"><Users className="w-4 h-4 md:w-5 md:h-5" /></div>
              ) : (
                selectedChat.otherUser?.photoURL ? <img src={selectedChat.otherUser.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-500 font-bold">{selectedChat.otherUser?.username?.[0] || 'U'}</div>
              )}
            </div>
            <div 
              className={`min-w-0 ${selectedChat.isGroup ? 'cursor-pointer hover:opacity-80' : ''}`}
              onClick={() => {
                if (selectedChat.isGroup) {
                  setViewingMembers(true);
                  setIsAddingPeople(false);
                  setIsEditingChat(false);
                  setIsSearchingMessages(false);
                }
              }}
            >
              <div className="flex items-center gap-1">
                <h3 className="font-bold text-slate-800 text-sm leading-tight truncate">{selectedChat.isGroup ? (selectedChat.name || 'Group Chat') : (selectedChat.otherUser?.fullName || selectedChat.otherUser?.username)}</h3>
                {selectedChat.isGroup && (
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation();
                      setIsEditingChat(!isEditingChat); 
                      setIsSearchingMessages(false); 
                      setViewingMembers(false);
                      setIsAddingPeople(false);
                      if (!isEditingChat) { setEditName(selectedChat.name || ''); setEditPhoto(selectedChat.photoURL || ''); } 
                    }} 
                    className="p-1 hover:bg-slate-50 rounded text-slate-300"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              {!selectedChat.isGroup && selectedChat.otherUser?.statusMessage && (
                <p className="text-[9px] text-slate-500 italic truncate max-w-[150px]">"{selectedChat.otherUser.statusMessage}"</p>
              )}
              <p className="text-[10px] text-slate-400 font-bold tracking-tight">
                {typingUsers.length > 0 ? (
                  <span className="text-brand-accent italic animate-pulse">
                    {selectedChat.isGroup ? 'Someone is typing...' : 'Typing...'}
                  </span>
                ) : (
                  selectedChat.isGroup ? `${selectedChat.participants.length} Active Members` : 'Available Now'
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-0 md:gap-1">
            {selectedChat.isGroup && (
              <button 
                onClick={() => { setIsAddingPeople(!isAddingPeople); setIsSearchingMessages(false); setIsEditingChat(false); }}
                className={`p-2 rounded-full transition-colors ${isAddingPeople ? 'bg-brand-accent/10 text-brand-accent shadow-inner' : 'hover:bg-slate-50 text-slate-400'}`}
                title="Add people"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            )}
            <button 
              onClick={() => { setIsSearchingMessages(!isSearchingMessages); setIsEditingChat(false); setIsAddingPeople(false); }}
              className={`p-2 rounded-full transition-colors ${isSearchingMessages ? 'bg-brand-accent/10 text-brand-accent shadow-inner' : 'hover:bg-slate-50 text-slate-400'}`}
              title="Search conversation"
            >
              <Search className="w-4 h-4" />
            </button>
            <button 
              onClick={() => { setShowThemePicker(!showThemePicker); setIsSearchingMessages(false); setIsEditingChat(false); }}
              className={`p-2 rounded-full transition-colors ${showThemePicker ? 'bg-brand-accent/10 text-brand-accent shadow-inner' : 'hover:bg-slate-50 text-slate-400'}`}
              title="Change Theme"
            >
              <Palette className="w-4 h-4" />
            </button>
            <button 
              onClick={startCall}
              disabled={selectedChat.isGroup}
              className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors disabled:opacity-30"
              title="Voice Call"
            >
              <Phone className="w-4 h-4" />
            </button>
            {isConfirmingChatDelete ? (
              <div className="flex items-center gap-1.5 animate-in fade-in zoom-in duration-200">
                <button 
                  onClick={handleDeleteChat}
                  className="px-2.5 py-1.5 bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-lg shadow-sm hover:bg-red-600 transition-colors"
                >
                  Confirm
                </button>
                <button 
                  onClick={() => setIsConfirmingChatDelete(false)}
                  className="px-2.5 py-1.5 bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsConfirmingChatDelete(true)}
                className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                title="Delete Conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Call UI - Floating Overlay */}
        <AnimatePresence>
          {isCalling && !isCallMinimized && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="absolute inset-0 bg-slate-900/95 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-8 text-center"
            >
              <div className="flex flex-col items-center gap-6 mb-12">
                <motion.div 
                  animate={{ 
                    boxShadow: [
                      "0 0 0 0px rgba(52, 199, 89, 0.4)",
                      "0 0 0 20px rgba(52, 199, 89, 0)",
                      "0 0 0 0px rgba(52, 199, 89, 0)"
                    ]
                  }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-32 h-32 rounded-full bg-brand-accent flex items-center justify-center shadow-2xl relative"
                >
                  {selectedChat?.isGroup ? (
                    <Users className="w-16 h-16 text-white" />
                  ) : (
                    selectedChat?.otherUser?.photoURL ? (
                      <img 
                        src={selectedChat.otherUser.photoURL} 
                        className="w-full h-full object-cover rounded-full border-4 border-white/20" 
                        alt="Caller"
                      />
                    ) : (
                      <div className="text-white text-5xl font-bold">
                        {selectedChat?.otherUser?.username?.[0]?.toUpperCase()}
                      </div>
                    )
                  )}
                </motion.div>
                
                <div className="space-y-2">
                  <h4 className="text-2xl font-bold text-white tracking-tight">
                    {selectedChat?.isGroup ? selectedChat.name : (selectedChat?.otherUser?.fullName || selectedChat?.otherUser?.username)}
                  </h4>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                    <p className="text-sm font-bold text-green-500 uppercase tracking-widest leading-none">
                      {formatDuration(callDuration)} • Voice Call
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center justify-center gap-6">
                <button 
                  onClick={toggleMute}
                  className={`p-4 rounded-full transition-all active:scale-90 ${isMuted ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                <button 
                  onClick={endCall} 
                  className="p-6 bg-red-500 hover:bg-red-600 rounded-full text-white shadow-2xl shadow-red-500/40 transition-all active:scale-95"
                  title="End Call"
                >
                  <Phone className="w-8 h-8 rotate-[135deg]" />
                </button>

                <button 
                  onClick={toggleSpeaker}
                  className={`p-4 rounded-full transition-all active:scale-90 ${isSpeakerOn ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20' : 'bg-white/10 text-white hover:bg-white/20'}`}
                  title={isSpeakerOn ? "Speaker Off" : "Speaker On"}
                >
                  {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </button>
              </div>

              <div className="absolute top-8 right-8">
                <button 
                  onClick={() => setIsCallMinimized(true)} 
                  className="text-white/40 hover:text-white transition-colors p-2"
                  title="Minimize Call"
                >
                  <ArrowLeft className="w-6 h-6 rotate-90" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimized Call UI */}
        <AnimatePresence>
          {isCalling && isCallMinimized && (
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              onClick={() => setIsCallMinimized(false)}
              className="absolute top-16 left-4 right-4 bg-slate-900/90 backdrop-blur-md z-40 rounded-2xl p-3 flex items-center justify-between shadow-2xl border border-white/10 cursor-pointer hover:bg-slate-900 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-accent flex items-center justify-center">
                  {selectedChat?.otherUser?.photoURL ? (
                    <img src={selectedChat.otherUser.photoURL} className="w-full h-full object-cover rounded-full" alt="Avatar" />
                  ) : <Phone className="w-4 h-4 text-white" />}
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">
                    {selectedChat?.otherUser?.fullName || selectedChat?.otherUser?.username || "In Call"}
                  </p>
                  <p className="text-[10px] text-brand-accent font-bold animate-pulse">{formatDuration(callDuration)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                  className={`p-2 rounded-full transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); endCall(); }}
                  className="p-2 bg-red-500 hover:bg-red-600 rounded-full text-white shadow-lg shadow-red-500/20"
                >
                  <Phone className="w-4 h-4 rotate-[135deg]" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message Search Bar */}
        <AnimatePresence>
          {isSearchingMessages && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-slate-100/50 border-b border-slate-200 z-10 overflow-hidden shrink-0"
            >
              <div className="p-3 relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  autoFocus
                  value={messageSearchQuery}
                  onChange={(e) => setMessageSearchQuery(e.target.value)}
                  placeholder="Find in conversation..."
                  className="w-full pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-accent transition-all animate-in fade-in slide-in-from-top-1"
                />
                {messageSearchQuery && (
                  <button 
                    onClick={() => setMessageSearchQuery('')}
                    className="absolute right-6 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full text-slate-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Add People to Group */}
        <AnimatePresence>
          {isAddingPeople && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-slate-50 border-b border-slate-200 z-10 overflow-hidden shrink-0"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Add Members to {selectedChat.name || 'Group'}</h4>
                  <button onClick={() => setIsAddingPeople(false)} className="p-1 hover:bg-slate-200 rounded-full text-slate-400">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by full name or username..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-accent transition-all"
                  />
                </div>

                {searchQuery.trim() && (
                  <div className="max-h-48 overflow-y-auto bg-white rounded-xl border border-slate-100 shadow-sm divide-y divide-slate-50">
                    {users.length > 0 ? users.filter(u => !selectedChat.participants.includes(u.uid)).map(u => (
                      <button 
                        key={u.uid} 
                        onClick={() => addParticipant(u)}
                        className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-all text-left group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden shrink-0 ring-1 ring-slate-100">
                            {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">{u.username[0]}</div>}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-800 leading-tight">{u.fullName || u.username}</p>
                            <p className="text-[9px] text-slate-400 tracking-tighter">@{u.username}</p>
                          </div>
                        </div>
                        <Plus className="w-3 h-3 text-brand-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    )) : (
                      <div className="p-4 text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest">No users found</div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* View Group Members */}
        <AnimatePresence>
          {viewingMembers && selectedChat && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white border-b border-slate-200 z-10 overflow-hidden shrink-0"
              onExitComplete={() => setMemberSearchQuery('')}
            >
              <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Group Members ({selectedChat.participants.length})</h4>
                  <button onClick={() => setViewingMembers(false)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    type="text" 
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    placeholder="Find a member..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-brand-accent transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {chatMembers.length > 0 ? (
                    chatMembers.filter(m => 
                      m.username.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
                      (m.fullName && m.fullName.toLowerCase().includes(memberSearchQuery.toLowerCase()))
                    ).length > 0 ? (
                      chatMembers.filter(m => 
                        m.username.toLowerCase().includes(memberSearchQuery.toLowerCase()) || 
                        (m.fullName && m.fullName.toLowerCase().includes(memberSearchQuery.toLowerCase()))
                      ).map(member => (
                        <div key={member.uid} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden ring-2 ring-white">
                              {member.photoURL ? (
                                <img src={member.photoURL} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-bold bg-slate-100 uppercase">
                                  {member.username[0]}
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-800 leading-none">{member.fullName || member.username} {member.uid === currentUser.uid && <span className="text-[9px] text-green-500 font-black ml-1 uppercase">You</span>}</p>
                              <p className="text-[11px] text-slate-400">@{member.username}</p>
                            </div>
                          </div>
                          
                          {member.uid !== currentUser.uid && (
                            <button 
                              onClick={() => {
                                setViewingMembers(false);
                                startPrivateChat(member);
                              }}
                              className="p-2 hover:bg-green-50 rounded-full text-green-500 transition-all active:scale-95"
                              title="Message privately"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                         <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                            <Search className="w-6 h-6 opacity-20" />
                         </div>
                         <p className="text-xs font-bold uppercase tracking-widest">No matching members</p>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                       <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                          <Users className="w-6 h-6 opacity-20" />
                       </div>
                       <p className="text-xs font-bold uppercase tracking-widest">Loading members...</p>
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button 
                    onClick={() => {
                      setViewingMembers(false);
                      setIsAddingPeople(true);
                    }}
                    className="w-full py-3 bg-slate-50 hover:bg-green-50 text-slate-500 hover:text-green-600 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all border border-slate-100"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add New Members
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isEditingChat && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} className="bg-slate-50 border-b border-slate-200 p-6 z-10 overflow-hidden shrink-0">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative group">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden">
                  {editPhoto ? <img src={editPhoto} className="w-full h-full object-cover" /> : <Users className="w-6 h-6 text-slate-300" />}
                </div>
                <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center rounded-2xl cursor-pointer transition-opacity">
                  <Camera className="w-4 h-4 text-white" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleEditPhoto} />
                </label>
              </div>
              <div className="flex-1 w-full space-y-4">
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-accent"
                  placeholder="Rename Group..."
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsEditingChat(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
                  <button onClick={updateChatMetadata} className="px-4 py-2 text-xs font-bold bg-brand-accent text-white rounded-xl shadow-lg shadow-brand-accent/20 transition-all">Save Changes</button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Theme Picker Overlay */}
        <AnimatePresence>
          {showThemePicker && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-white border-b border-slate-200 z-10 overflow-hidden shrink-0 shadow-inner"
            >
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Choose Chat Theme</h4>
                  <button onClick={() => setShowThemePicker(false)} className="p-1 hover:bg-slate-100 rounded-full text-slate-400">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(THEMES) as ThemeKey[]).map((t) => (
                    <button 
                      key={t}
                      onClick={() => changeTheme(t)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all border ${activeTheme === t ? 'border-brand-accent bg-brand-accent/5 ring-1 ring-brand-accent' : 'border-slate-100 hover:bg-slate-50'}`}
                    >
                      <div className={`w-4 h-4 rounded-full ${THEMES[t].bubble}`} />
                      <span className={`text-xs font-bold ${activeTheme === t ? 'text-slate-800' : 'text-slate-500'}`}>{THEMES[t].name}</span>
                      {activeTheme === t && <Check className="w-3 h-3 text-brand-accent" />}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Message Thread */}
        <div 
          className={`flex-1 overflow-y-auto p-4 space-y-4 transition-colors duration-500 ${THEMES[activeTheme].bg}`}
          style={{ 
            backgroundImage: `radial-gradient(${activeTheme === 'midnight' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'} 1px, transparent 1px)`,
            backgroundSize: '20px 20px'
          }}
        >
          {(messageSearchQuery.trim() ? messages.filter(m => m.text.toLowerCase().includes(messageSearchQuery.toLowerCase())) : messages).map((msg, i) => {
            const isMe = msg.senderId === currentUser.uid;
            const isEditing = editingMessageId === msg.id;

            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-300 group max-w-full`}>
                {selectedChat.isGroup && !isMe && (i === 0 || messages[i-1].senderId !== msg.senderId) && (
                  <span className="text-[10px] font-bold text-slate-400 mb-1 ml-2 uppercase tracking-widest">{msg.senderName}</span>
                )}
                
                <div className={`relative max-w-[85%] flex items-start gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                  {isMe && !isEditing && (
                    <div className="flex items-center gap-1 self-center">
                          {confirmingDeleteMessageId === msg.id ? (
                            <div className="flex items-center gap-1.5 animate-in fade-in zoom-in duration-200 bg-white border border-slate-100 rounded-xl p-1 shadow-xl ring-1 ring-slate-50 z-10">
                              <button 
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="px-2 py-1 bg-red-500 text-white text-[9px] font-bold uppercase tracking-tight rounded-lg hover:bg-red-600 transition-colors shadow-sm"
                              >
                                Confirm
                              </button>
                              <button 
                                onClick={() => setConfirmingDeleteMessageId(null)}
                                className="px-2 py-1 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-tight rounded-lg hover:bg-slate-200 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                              <div className="flex bg-white/10 backdrop-blur-sm rounded-full mr-1 px-1">
                                {COMMON_EMOJIS.map(emoji => (
                                  <button 
                                    key={emoji}
                                    onClick={() => reactToMessage(msg.id, emoji)}
                                    className="p-1 hover:scale-125 transition-transform text-xs grayscale-[0.5] hover:grayscale-0"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                              <button 
                                onClick={() => { setEditingMessageId(msg.id); setEditMessageText(msg.text); }}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
                                title="Edit"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button 
                                onClick={() => setConfirmingDeleteMessageId(msg.id)}
                                className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500"
                                title="Delete"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {!isMe && (
                         <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 self-center ml-2">
                            <div className="flex bg-slate-100/80 backdrop-blur-sm rounded-full px-1 border border-slate-200">
                              {COMMON_EMOJIS.map(emoji => (
                                <button 
                                  key={emoji}
                                  onClick={() => reactToMessage(msg.id, emoji)}
                                  className="p-1 hover:scale-125 transition-transform text-xs"
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                         </div>
                      )}

                      <div className={`rounded-2xl overflow-hidden leading-tight ${isMe ? `${THEMES[activeTheme].bubble} text-white rounded-tr-md` : 'bg-[#E9E9EB] text-black rounded-tl-md'} px-4 py-2.5 shadow-sm`}>
                        {isEditing ? (
                          <div className="space-y-2 min-w-[200px] p-2">
                            <textarea 
                              value={editMessageText}
                              onChange={(e) => setEditMessageText(e.target.value)}
                              className="w-full bg-white/10 border border-white/20 rounded-xl p-2 outline-none focus:ring-1 focus:ring-white/40 text-white resize-none text-[13px]"
                              rows={2}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2">
                              <button onClick={() => setEditingMessageId(null)} className="text-[10px] font-bold uppercase tracking-widest opacity-70">Cancel</button>
                              <button onClick={() => handleEditMessage(msg.id, editMessageText)} className="text-[10px] font-bold uppercase tracking-widest bg-white text-brand-accent px-2 py-1 rounded">Save</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {msg.text}
                            {msg.isEdited && <span className="block text-[8px] opacity-60 mt-1 italic">edited</span>}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Reactions Display */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {Object.entries(msg.reactions).map(([emoji, uids]) => (
                          <button 
                            key={emoji}
                            onClick={() => reactToMessage(msg.id, emoji)}
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition-all ${
                              (uids as string[]).includes(currentUser.uid) 
                                ? 'bg-brand-accent text-white shadow-sm ring-1 ring-white/20' 
                                : 'bg-white border border-slate-100 text-slate-500 hover:border-slate-200'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span>{(uids as string[]).length}</span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
            );
          })}
          {messageSearchQuery.trim() && messages.filter(m => m.text.toLowerCase().includes(messageSearchQuery.toLowerCase())).length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
              <Search className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No results for "{messageSearchQuery}"</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Container */}
        <div className="p-4 bg-white border-t border-slate-100 relative shrink-0">
          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                className="absolute bottom-full left-4 mb-2 p-3 bg-white border border-slate-200 rounded-2xl shadow-2xl z-30 ring-1 ring-slate-100"
              >
                <div className="grid grid-cols-5 gap-2">
                  {COMMON_EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => { addEmoji(emoji); setShowEmojiPicker(false); }} className="text-2xl hover:scale-125 transition-transform p-1 select-none">{emoji}</button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSendMessage} className="flex items-center gap-3">
            <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`p-2 transition-colors ${showEmojiPicker ? 'text-brand-accent' : 'text-slate-400 hover:text-slate-600'}`}>
              <Smile className="w-5 h-5" />
            </button>
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
              placeholder="Say something nice..."
              className="flex-1 bg-slate-100 border-none rounded-full px-5 py-3 text-sm focus:ring-2 focus:ring-brand-accent outline-none font-medium"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className={`${THEMES[activeTheme].bubble} text-white p-3 rounded-full shadow-lg shadow-brand-accent/20 disabled:opacity-50 disabled:shadow-none hover:opacity-90 transition-all flex items-center justify-center shrink-0`}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="h-full space-y-6 relative flex flex-col bg-transparent overflow-hidden">
      {/* Incoming Call Notification */}
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

      {/* Discovery Tool & Inbox */}
      {!selectedChat && (
        <div className="flex flex-col flex-1 min-h-0 space-y-6">
          <div className="bg-white md:rounded-2xl md:shadow-sm md:border md:border-slate-200 overflow-hidden shrink-0">
            <div className="p-4 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by full name or @username..."
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-accent outline-none font-medium"
                />
              </div>
              <button 
                onClick={() => { setIsCreatingGroup(true); setSearchQuery(''); setUsers([]); }}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" /> Start Group
              </button>
            </div>

            {searchQuery.trim() && (
              <div className="p-2 border-t border-slate-100 max-h-60 overflow-y-auto">
                {users.length > 0 ? users.map(u => (
                  <button key={u.uid} onClick={() => startPrivateChat(u)} className="w-full flex items-center gap-4 p-3 hover:bg-slate-50 rounded-2xl transition-colors text-left uppercase tracking-tight">
                    <div className="w-10 h-10 rounded-full bg-brand-accent/10 overflow-hidden border border-slate-100 shrink-0">
                      {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-brand-accent font-bold">{u.username?.[0]}</div>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-slate-800">{u.fullName || u.username}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-bold">@{u.username}</p>
                    </div>
                    <MessageSquare className="w-4 h-4 text-slate-300" />
                  </button>
                )) : <div className="p-6 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">Searching...</div>}
              </div>
            )}
          </div>

          {/* Main Inbox */}
          <div className="bg-white md:rounded-2xl md:shadow-sm md:border md:border-slate-200 overflow-hidden flex-1 min-h-[440px]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Messages</h2>
              <span className="text-[10px] font-bold text-brand-accent bg-brand-accent/10 px-2.5 py-1 rounded-full uppercase tracking-widest">
                {chats.length} Conversations
              </span>
            </div>

            <div className="divide-y divide-slate-50 h-full overflow-y-auto pb-20 md:pb-0">
              {chats.length > 0 ? chats.map(chat => {
                const typingUsers = Object.keys(chat.typing || {}).filter(uid => uid !== currentUser.uid);
                return (
                  <button 
                    key={chat.id}
                    onClick={() => setSelectedChat(chat)}
                    className="w-full p-5 flex items-center gap-4 hover:bg-slate-50/80 transition-all text-left group"
                  >
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-full bg-brand-accent/10 overflow-hidden border-2 border-white shadow-sm ring-1 ring-slate-100">
                        {chat.isGroup ? (
                          chat.photoURL ? <img src={chat.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-brand-accent/20 text-brand-accent"><Users className="w-6 h-6" /></div>
                        ) : (
                          chat.otherUser?.photoURL ? <img src={chat.otherUser.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-brand-accent font-bold text-xl">{chat.otherUser?.username?.[0] || 'U'}</div>
                        )}
                      </div>
                      {!chat.isGroup && <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-green-500 border-2 border-white shadow-sm" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex flex-col min-w-0">
                          <h3 className="font-bold text-slate-800 text-sm truncate uppercase tracking-tight">
                            {chat.isGroup ? (chat.name || 'Anonymous Group') : (chat.otherUser?.fullName || chat.otherUser?.username)}
                          </h3>
                          {!chat.isGroup && chat.otherUser?.statusMessage && (
                            <p className="text-[9px] text-slate-400 italic truncate tracking-tight">"{chat.otherUser.statusMessage}"</p>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap ml-2">
                          {chat.lastMessageAt ? new Date(chat.lastMessageAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <p className={`text-xs truncate leading-relaxed ${typingUsers.length > 0 ? 'text-brand-accent font-bold italic animate-pulse' : 'text-slate-500'}`}>
                        {typingUsers.length > 0 ? 'Typing...' : (chat.lastMessage || 'Start a new conversation...')}
                      </p>
                    </div>
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-accent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              }) : (
                <div className="flex flex-col items-center justify-center py-28 px-6 text-center">
                  <div className="relative w-20 h-20 bg-slate-50 rounded-[28%] flex items-center justify-center mb-6">
                    <MessageCircle className="w-12 h-12 text-slate-100 fill-current" />
                    <Zap className="w-6 h-6 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 fill-current stroke-[3px]" />
                  </div>
                  <h3 className="font-bold text-slate-800 mb-2 text-base">Your Inbox is Waiting</h3>
                  <p className="text-sm text-slate-400 max-w-[260px] leading-relaxed">Search for users above by their registered full name to start chatting real-time.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
