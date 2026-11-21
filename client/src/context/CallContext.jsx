import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const CallContext = createContext(null);

// High-reliability STUN & free TURN relay servers for cross-network / mobile traversal
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: 'turn:standard.relay.metered.ca:80',
      username: 'e015d86b72a6b291d9d4352b',
      credential: 'K8a8S/G9J0y4vY4d'
    },
    {
      urls: 'turn:standard.relay.metered.ca:443',
      username: 'e015d86b72a6b291d9d4352b',
      credential: 'K8a8S/G9J0y4vY4d'
    },
    {
      urls: 'turn:standard.relay.metered.ca:443?transport=tcp',
      username: 'e015d86b72a6b291d9d4352b',
      credential: 'K8a8S/G9J0y4vY4d'
    }
  ]
};

export function CallProvider({ children }) {
  const { socket } = useSocket();
  const { user } = useAuth();

  const [callStatus, setCallStatus] = useState('idle'); // 'idle' | 'calling' | 'incoming' | 'connected'
  const [callType, setCallType] = useState('video'); // 'video' | 'audio'
  const [peerUser, setPeerUser] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef(null);
  const incomingOfferRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const timerRef = useRef(null);
  const audioContextRef = useRef(null);
  const ringtoneIntervalRef = useRef(null);

  // Realistic dual-frequency telephone ringtone (440Hz + 480Hz with 2s ring, 3s pause)
  const startRingtone = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const playTone = () => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.setValueAtTime(0.06, now + 1.8);
        gain.gain.linearRampToValueAtTime(0.001, now + 2.0);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 2.0);
        osc2.stop(now + 2.0);
      };

      playTone();
      ringtoneIntervalRef.current = setInterval(playTone, 4000);
    } catch (e) {
      // Audio autoplay policy
    }
  }, []);

  const stopRingtone = useCallback(() => {
    try {
      if (ringtoneIntervalRef.current) {
        clearInterval(ringtoneIntervalRef.current);
        ringtoneIntervalRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    } catch (e) {}
  }, []);

  // Cleanup all streams & connection
  const cleanupCall = useCallback(() => {
    stopRingtone();

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setPeerUser(null);
    incomingOfferRef.current = null;
    pendingCandidatesRef.current = [];
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
    setCallDuration(0);
  }, [localStream, stopRingtone]);

  // Create PeerConnection instance
  const createPeerConnection = useCallback(
    (targetUserId) => {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Handle remote ICE candidate transmission
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('call:ice-candidate', {
            targetUserId,
            candidate: event.candidate
          });
        }
      };

      // Handle receiving remote audio/video tracks
      pc.ontrack = (event) => {
        console.log('[WebRTC] Received remote track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else {
          setRemoteStream((prev) => {
            const stream = prev ? prev.clone() : new MediaStream();
            stream.addTrack(event.track);
            return stream;
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          stopRingtone();
          setCallStatus('connected');
          if (!timerRef.current) {
            timerRef.current = setInterval(() => {
              setCallDuration((prev) => prev + 1);
            }, 1000);
          }
        } else if (
          pc.connectionState === 'disconnected' ||
          pc.connectionState === 'failed' ||
          pc.connectionState === 'closed'
        ) {
          cleanupCall();
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          stopRingtone();
          setCallStatus('connected');
        } else if (pc.iceConnectionState === 'failed') {
          console.warn('[WebRTC] ICE failed, attempting restart...');
          if (pc.restartIce) pc.restartIce();
        }
      };

      return pc;
    },
    [socket, cleanupCall, stopRingtone]
  );

  // 1. Start Outgoing Call
  const startCall = async (targetUser, type = 'video') => {
    if (!socket || !targetUser) return;

    try {
      setCallType(type);
      setPeerUser(targetUser);
      setCallStatus('calling');
      startRingtone();

      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video:
          type === 'video'
            ? {
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                facingMode: 'user'
              }
            : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      const pc = createPeerConnection(targetUser.id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: type === 'video'
      });
      await pc.setLocalDescription(offer);

      socket.emit('call:initiate', {
        targetUserId: targetUser.id,
        callType: type,
        offer
      });
    } catch (err) {
      console.error('Failed to start call:', err);
      alert('Could not access microphone/camera: ' + err.message);
      cleanupCall();
    }
  };

  // 2. Accept Incoming Call
  const acceptCall = async () => {
    stopRingtone();
    if (!socket || !peerUser || !incomingOfferRef.current) return;

    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video:
          callType === 'video'
            ? {
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 },
                facingMode: 'user'
              }
            : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);

      const pc = createPeerConnection(peerUser.id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current));

      // Process any early arrived ICE candidates
      while (pendingCandidatesRef.current.length > 0) {
        const cand = pendingCandidatesRef.current.shift();
        try {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        } catch (e) {
          console.warn('[WebRTC] Early candidate error:', e);
        }
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('call:accept', {
        callerId: peerUser.id,
        answer
      });

      setCallStatus('connected');
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    } catch (err) {
      console.error('Failed to accept call:', err);
      alert('Failed to establish call connection: ' + err.message);
      cleanupCall();
    }
  };

  // 3. Reject Call
  const rejectCall = () => {
    if (socket && peerUser) {
      socket.emit('call:reject', {
        callerId: peerUser.id,
        reason: 'declined'
      });
    }
    cleanupCall();
  };

  // 4. End Active Call
  const endCall = () => {
    if (socket && peerUser) {
      socket.emit('call:end', {
        targetUserId: peerUser.id
      });
    }
    cleanupCall();
  };

  // Toggle Mute Audio
  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  // Toggle Video Camera
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (!pcRef.current || !localStream) return;

    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];

        const senders = pcRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        }

        screenTrack.onended = () => {
          const camTrack = localStream.getVideoTracks()[0];
          if (videoSender && camTrack) {
            videoSender.replaceTrack(camTrack);
          }
          setIsScreenSharing(false);
        };

        setIsScreenSharing(true);
      } catch (err) {
        console.error('Screen sharing error:', err);
      }
    } else {
      const videoSender = pcRef.current.getSenders().find((s) => s.track && s.track.kind === 'video');
      const camTrack = localStream.getVideoTracks()[0];
      if (videoSender && camTrack) {
        videoSender.replaceTrack(camTrack);
      }
      setIsScreenSharing(false);
    }
  };

  // Socket signaling event listeners
  useEffect(() => {
    if (!socket) return;

    // Incoming Call
    const handleIncomingCall = ({ caller, callType: incomingType, offer }) => {
      if (callStatus !== 'idle') {
        socket.emit('call:reject', {
          callerId: caller.id,
          reason: 'busy'
        });
        return;
      }

      setPeerUser(caller);
      setCallType(incomingType || 'video');
      incomingOfferRef.current = offer;
      setCallStatus('incoming');
      startRingtone();
    };

    // Call Accepted by remote peer
    const handleCallAccepted = async ({ answer }) => {
      stopRingtone();
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));

          while (pendingCandidatesRef.current.length > 0) {
            const cand = pendingCandidatesRef.current.shift();
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('[WebRTC] Early candidate error:', e);
            }
          }

          setCallStatus('connected');
          if (!timerRef.current) {
            timerRef.current = setInterval(() => {
              setCallDuration((prev) => prev + 1);
            }, 1000);
          }
        } catch (err) {
          console.error('Error setting remote answer:', err);
        }
      }
    };

    // Call Rejected
    const handleCallRejected = ({ reason }) => {
      stopRingtone();
      if (reason === 'offline') {
        alert('This user is currently offline.');
      } else if (reason === 'busy') {
        alert('This user is currently busy on another call.');
      } else {
        alert('Call was declined.');
      }
      cleanupCall();
    };

    // Call Ended by remote peer
    const handleCallEnded = () => {
      cleanupCall();
    };

    // ICE Candidate received
    const handleIceCandidate = async ({ candidate }) => {
      if (pcRef.current && pcRef.current.remoteDescription) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };

    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:accepted', handleCallAccepted);
    socket.on('call:rejected', handleCallRejected);
    socket.on('call:ended', handleCallEnded);
    socket.on('call:ice-candidate', handleIceCandidate);

    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:accepted', handleCallAccepted);
      socket.off('call:rejected', handleCallRejected);
      socket.off('call:ended', handleCallEnded);
      socket.off('call:ice-candidate', handleIceCandidate);
    };
  }, [socket, callStatus, cleanupCall, startRingtone, stopRingtone]);

  return (
    <CallContext.Provider
      value={{
        callStatus,
        callType,
        peerUser,
        localStream,
        remoteStream,
        isMuted,
        isVideoOff,
        isScreenSharing,
        callDuration,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleScreenShare
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  return useContext(CallContext);
}
