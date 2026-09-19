'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  QrCode,
  ArrowLeft,
  Camera,
  CameraOff,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  Keyboard,
  Zap,
  Clock,
  User,
  MapPin,
  Flame,
  Check,
  RefreshCw,
  Search,
} from 'lucide-react';
import jsQR from 'jsqr';
import { RoleAccessGate } from '@/components/auth/RoleAccessGate';
import { getCurrentUserSession } from '@/lib/auth/actions';
import {
  verifyCardByToken,
  getRecentGateScans,
  ScanVerificationResult,
  GateScanHistoryItem,
} from '@/lib/verify/actions';

const GATES = [
  { id: 'Main Gate 1', label: 'Main Gate 1 (મુખ્ય પ્રવેશદ્વાર ૧)' },
  { id: 'North Gate 2', label: 'North Gate 2 (ઉત્તર પ્રવેશદ્વાર ૨)' },
  { id: 'VIP Turnstile', label: 'VIP Turnstile (વી.આઈ.પી. પ્રવેશદ્વાર)' },
  { id: 'Staff & Performer Entry', label: 'Staff & Performer Entry (સ્ટાફ પ્રવેશદ્વાર)' },
  { id: 'Emergency / Media Gate', label: 'Emergency / Media Gate (મીડિયા પ્રવેશદ્વાર)' },
];

export default function ScanPage() {
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>(undefined);
  const [loadingRole, setLoadingRole] = useState(true);

  // Station State
  const [selectedGate, setSelectedGate] = useState('Main Gate 1');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Scanner & Video Elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const isVerifyingRef = useRef(false);

  // Verification & Recent State
  const [activeResult, setActiveResult] = useState<ScanVerificationResult | null>(null);
  const [autoDismissSecs, setAutoDismissSecs] = useState<number>(0);
  const [manualInput, setManualInput] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  // Live KPI Counters
  const [totalScanned, setTotalScanned] = useState(0);
  const [totalValid, setTotalValid] = useState(0);
  const [totalDenied, setTotalDenied] = useState(0);

  // Recent Scans History
  const [history, setHistory] = useState<GateScanHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Audio synthesize function (zero external audio file dependencies)
  const playSound = useCallback(
    (type: 'success' | 'error') => {
      if (!soundEnabled || typeof window === 'undefined') return;
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'success') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
          osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.15); // D6
          gain.gain.setValueAtTime(0.18, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc.start();
          osc.stop(ctx.currentTime + 0.25);
        } else {
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
          osc.frequency.setValueAtTime(164.81, ctx.currentTime + 0.12); // E3
          gain.gain.setValueAtTime(0.22, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.start();
          osc.stop(ctx.currentTime + 0.35);
        }
      } catch (err) {
        console.warn('Audio play error:', err);
      }
    },
    [soundEnabled]
  );

  // Haptic feedback
  const triggerVibration = (type: 'success' | 'error') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'success') {
        navigator.vibrate(120);
      } else {
        navigator.vibrate([180, 80, 180]);
      }
    }
  };

  // 1. Load User Session and Initial History
  useEffect(() => {
    async function init() {
      try {
        const [sess, recents] = await Promise.all([
          getCurrentUserSession(),
          getRecentGateScans(selectedGate, 10),
        ]);
        setCurrentUserRole(sess?.roleCode);
        setHistory(recents || []);
      } catch (e) {
        console.error('Init scanner error:', e);
      } finally {
        setLoadingRole(false);
        setLoadingHistory(false);
      }
    }
    init();
  }, [selectedGate]);

  // 2. Camera Stream Lifecycle
  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraError(null);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err: any) {
      console.error('Camera access failed:', err);
      let msg = 'Camera access was blocked or is unavailable on this device.';
      if (err.name === 'NotAllowedError') {
        msg = 'Camera permission denied. Please allow camera access in browser settings.';
      } else if (err.name === 'NotFoundError') {
        msg = 'No video camera detected on this station device.';
      }
      setCameraError(msg);
      setCameraActive(false);
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // 3. QR Token Verification Handler
  const handleVerifyToken = useCallback(
    async (rawCode: string) => {
      if (isVerifyingRef.current || !rawCode.trim()) return;
      isVerifyingRef.current = true;

      // Extract token from full URL if scanned QR contains full URL (e.g. http://.../verify/tok_123)
      let token = rawCode.trim();
      if (token.includes('/verify/')) {
        const parts = token.split('/verify/');
        token = parts[parts.length - 1].split('?')[0].split('#')[0];
      }

      try {
        const res = await verifyCardByToken(token, selectedGate);
        setActiveResult(res);
        setTotalScanned((prev) => prev + 1);

        if (res.valid) {
          setTotalValid((prev) => prev + 1);
          playSound('success');
          triggerVibration('success');
        } else {
          setTotalDenied((prev) => prev + 1);
          playSound('error');
          triggerVibration('error');
        }

        // Add to local history list
        setHistory((prev) => [
          {
            id: `temp-${Date.now()}`,
            cardNumber: res.card?.cardNumber || rawCode.slice(0, 16),
            recipientNameEn: res.card?.recipientNameEn || 'Unregistered Card',
            categoryEn: res.card?.categoryEn || 'Attendee',
            scanResult: res.status,
            gateName: selectedGate,
            scannedAt: new Date().toISOString(),
          },
          ...prev.slice(0, 9),
        ]);

        // Start 4-second auto-dismiss timer
        setAutoDismissSecs(4);
      } catch (err: any) {
        console.error('Verification error:', err);
      } finally {
        // Leave flag locked while activeResult is displayed
      }
    },
    [selectedGate, playSound]
  );

  // 4. Auto-dismiss Countdown Timer for Rapid Turnstile Queues
  useEffect(() => {
    if (!activeResult) return;
    if (autoDismissSecs <= 0) {
      handleDismissModal();
      return;
    }

    const timer = setInterval(() => {
      setAutoDismissSecs((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [activeResult, autoDismissSecs]);

  const handleDismissModal = () => {
    setActiveResult(null);
    setAutoDismissSecs(0);
    isVerifyingRef.current = false;
  };

  // 5. Continuous Video Frame Scanner (jsQR)
  useEffect(() => {
    let active = true;

    const scanFrame = () => {
      if (!active) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (
        video &&
        video.readyState === video.HAVE_ENOUGH_DATA &&
        canvas &&
        !isVerifyingRef.current &&
        cameraActive
      ) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data && code.data.trim().length > 0) {
            handleVerifyToken(code.data);
          }
        }
      }

      animFrameIdRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameIdRef.current = requestAnimationFrame(scanFrame);

    return () => {
      active = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [cameraActive, handleVerifyToken]);

  // 6. USB / Hardware 2D Barcode & QR Scanner Keyboard Wedge Listener
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is currently typing in an input element
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const currentTime = Date.now();
      // Hardware scanners typically output characters within 20-50ms
      if (currentTime - lastKeyTime > 250) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.trim().length > 3) {
          handleVerifyToken(buffer.trim());
          buffer = '';
        }
      } else if (e.key === ' ' || e.key === 'Escape') {
        // Space / Escape quickly dismisses active result
        handleDismissModal();
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleVerifyToken]);

  // Manual token verification trigger
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    setManualLoading(true);
    await handleVerifyToken(manualInput.trim());
    setManualInput('');
    setManualLoading(false);
  };

  // Sample quick test cards
  const sampleTestCards = [
    { label: 'Participant Card (Valid Pass)', token: 'NEST-CARD-107008' },
    { label: 'Special Pass Token (Valid)', token: 'tok_9f83a8b27c14e410bfa64e29' },
    { label: 'Revoked / Expired Card (Denied)', token: 'tok_cancelled_demo_token' },
  ];

  if (loadingRole) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
          <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
          <span>Verifying security permissions...</span>
        </div>
      </div>
    );
  }

  return (
    <RoleAccessGate
      currentRoleCode={currentUserRole}
      allowedRoles={['SECURITY', 'EVENT_ADMIN', 'SUPER_ADMIN']}
      moduleNameEn="Security Gate Scanner"
      moduleNameGu="Security Gate Scanner"
    >
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
        {/* Top Navbar */}
        <header className="px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center space-x-3">
            <Link
              href="/"
              className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  Turnstile QR Gate Scanner
                </h1>
                <span className="hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold uppercase">
                  Live Scanner
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Navratri Mahotsav 2026 • Real-time Access Verification
              </p>
            </div>
          </div>

          {/* Controls: Gate selector & Sound */}
          <div className="flex items-center gap-2.5">
            <select
              value={selectedGate}
              onChange={(e) => setSelectedGate(e.target.value)}
              className="text-xs bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              {GATES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border transition ${
                soundEnabled
                  ? 'bg-slate-800 border-slate-700 text-emerald-400'
                  : 'bg-slate-900 border-slate-800 text-slate-500'
              }`}
              title={soundEnabled ? 'Mute turnstile audio chimes' : 'Enable audio chimes'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Workspace Layout */}
        <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Stage: Live Camera Viewfinder */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            {/* Live Camera Viewfinder Box */}
            <div className="relative w-full aspect-square max-h-[480px] sm:max-h-[520px] mx-auto rounded-3xl overflow-hidden border-2 border-slate-800 bg-black flex flex-col items-center justify-center shadow-2xl">
              {/* Video Element */}
              <video
                ref={videoRef}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  cameraActive && !cameraError ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Hidden Canvas used for frame decoding */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Animated HUD Viewfinder Overlay */}
              {cameraActive && !cameraError && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-8">
                  {/* Outer Targeting Frame */}
                  <div className="relative w-64 h-64 sm:w-72 sm:h-72 border-2 border-emerald-500/40 rounded-3xl flex items-center justify-center">
                    {/* Targeting Corners */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-2xl -mt-1 -ml-1" />
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-2xl -mt-1 -mr-1" />
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-2xl -mb-1 -ml-1" />
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-2xl -mb-1 -mr-1" />

                    {/* Animated Scanning Laser Line */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399] animate-pulse" />

                    <span className="absolute -bottom-8 text-[11px] font-semibold text-emerald-400/90 tracking-wider uppercase drop-shadow-md">
                      Align Card QR Code Here
                    </span>
                  </div>
                </div>
              )}

              {/* Camera Error or Off State */}
              {(!cameraActive || cameraError) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-slate-900/90">
                  <CameraOff className="w-12 h-12 text-slate-500" />
                  <p className="text-xs text-slate-300 max-w-xs font-medium">
                    {cameraError || 'Camera feed paused.'}
                  </p>
                  <button
                    onClick={startCamera}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white transition flex items-center gap-1.5 shadow-md"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Start Camera
                  </button>
                </div>
              )}

              {/* Bottom Quick Toolbar: Toggle Camera & Flip */}
              <div className="absolute bottom-3 inset-x-3 flex items-center justify-between px-3 py-1.5 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-xs">
                <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      cameraActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
                    }`}
                  />
                  {cameraActive ? 'LIVE WEBCAM STREAM' : 'CAMERA OFF'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setFacingMode(facingMode === 'environment' ? 'user' : 'environment');
                    }}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-[11px] flex items-center gap-1 font-semibold"
                    title="Switch camera"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Flip
                  </button>

                  <button
                    onClick={cameraActive ? stopCamera : startCamera}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-[11px] flex items-center gap-1 font-semibold"
                  >
                    {cameraActive ? <CameraOff className="w-3.5 h-3.5" /> : <Camera className="w-3.5 h-3.5" />}
                    {cameraActive ? 'Pause' : 'Resume'}
                  </button>
                </div>
              </div>
            </div>

            {/* Manual Keyboard & USB Scanner Barcode Wedge Input */}
            <form
              onSubmit={handleManualSubmit}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-blue-400" />
                  USB Barcode Gun / Manual Token Entry
                </label>
                <span className="text-[10px] text-slate-500">Auto-detects USB Handheld Guns</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Scan with USB gun or paste card serial (e.g. NEST-CARD-107008)..."
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  className="flex-1 text-xs rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="submit"
                  disabled={manualLoading || !manualInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50 flex items-center gap-1 shadow-sm"
                >
                  <Search className="w-3.5 h-3.5" />
                  {manualLoading ? 'Checking...' : 'Verify'}
                </button>
              </div>
            </form>

            {/* Quick Simulation Buttons for QA & Operator Training */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Quick Test Token Simulator
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {sampleTestCards.map((c) => (
                  <button
                    key={c.token}
                    type="button"
                    onClick={() => handleVerifyToken(c.token)}
                    className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-left text-xs font-medium text-slate-300 transition flex items-center justify-between"
                  >
                    <span className="truncate">{c.label}</span>
                    <span className="text-emerald-400 font-mono text-[10px] ml-1">Scan →</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Live Shift Stats & Real-Time Scans Log */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            {/* Shift KPI Metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl text-center shadow-xs">
                <span className="text-[10px] font-semibold text-slate-400 uppercase block">
                  Total Scans
                </span>
                <span className="text-2xl font-black text-white mt-0.5 block">
                  {totalScanned}
                </span>
              </div>

              <div className="bg-slate-900 border border-emerald-950 p-3.5 rounded-2xl text-center shadow-xs">
                <span className="text-[10px] font-semibold text-emerald-400 uppercase block">
                  Authorized
                </span>
                <span className="text-2xl font-black text-emerald-400 mt-0.5 block">
                  {totalValid}
                </span>
              </div>

              <div className="bg-slate-900 border border-rose-950 p-3.5 rounded-2xl text-center shadow-xs">
                <span className="text-[10px] font-semibold text-rose-400 uppercase block">
                  Denied / Alert
                </span>
                <span className="text-2xl font-black text-rose-400 mt-0.5 block">
                  {totalDenied}
                </span>
              </div>
            </div>

            {/* Turnstile History Log */}
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Recent Gate Scan Stream
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">{selectedGate}</span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 mt-3 max-h-[460px] pr-1">
                {loadingHistory ? (
                  <div className="p-8 text-center text-xs text-slate-500">Loading scan logs...</div>
                ) : history.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
                    <QrCode className="w-8 h-8 text-slate-600" />
                    <span>No cards scanned yet at this gate.</span>
                  </div>
                ) : (
                  history.map((item) => {
                    const isPass = item.scanResult === 'ACTIVE';
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs transition hover:border-slate-700"
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                              isPass
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {isPass ? <Check className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          </div>

                          <div>
                            <div className="font-bold text-white leading-tight truncate max-w-[150px]">
                              {item.recipientNameEn}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {item.cardNumber} • {item.categoryEn}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider ${
                              isPass
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-rose-500/20 text-rose-300'
                            }`}
                          >
                            {item.scanResult}
                          </span>
                          <span className="block text-[9.5px] text-slate-500 mt-0.5 font-mono">
                            {new Date(item.scannedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* Instant Verification Modal Overlay for Turnstile Operator     */}
        {/* ------------------------------------------------------------- */}
        {activeResult && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div
              className={`max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-6 text-center border-2 animate-in fade-in zoom-in duration-150 ${
                activeResult.valid
                  ? 'bg-slate-900 border-emerald-500 shadow-emerald-950/50'
                  : 'bg-slate-900 border-rose-500 shadow-rose-950/50'
              }`}
            >
              {/* Status Header Badge */}
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider shadow-sm ${
                  activeResult.valid
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-rose-500 text-white'
                }`}
              >
                {activeResult.valid ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                <span>{activeResult.statusText}</span>
              </div>

              {/* Verified Card Details */}
              {activeResult.card ? (
                <div className="space-y-4">
                  {/* Photo Display */}
                  <div
                    className={`w-32 h-40 mx-auto rounded-2xl overflow-hidden border-2 shadow-lg bg-slate-800 flex items-center justify-center relative ${
                      activeResult.valid ? 'border-emerald-400' : 'border-rose-400'
                    }`}
                  >
                    {activeResult.card.photoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={activeResult.card.photoUrl}
                        alt={activeResult.card.recipientNameEn}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <User className="w-10 h-10" />
                        <span className="text-[9px] mt-1 uppercase font-bold">No Photo</span>
                      </div>
                    )}
                  </div>

                  {/* Holder Identity */}
                  <div>
                    <h2 className="text-xl font-bold text-white leading-snug">
                      {activeResult.card.recipientNameEn}
                    </h2>
                    {activeResult.card.recipientNameGu && (
                      <p className="text-xs text-slate-400 font-gujarati mt-0.5">
                        {activeResult.card.recipientNameGu}
                      </p>
                    )}

                    <div
                      className="mt-2.5 inline-block px-3.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider text-white shadow-xs"
                      style={{
                        backgroundColor: activeResult.card.theme?.primaryColor || '#900B09',
                      }}
                    >
                      {activeResult.card.categoryEn}
                    </div>

                    {activeResult.card.isReprinted && (
                      <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                        <RefreshCw className="w-3 h-3" />
                        Reissued / Reprinted Card
                      </div>
                    )}
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-2 text-left bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                        Card Number
                      </span>
                      <span className="font-mono font-bold text-slate-200">
                        {activeResult.card.cardNumber}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                        Gate Verification
                      </span>
                      <span className="font-semibold text-slate-200 truncate block">
                        {activeResult.gateName}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                        Valid Period
                      </span>
                      <span className="font-semibold text-slate-200 text-[11px]">
                        {activeResult.card.validFrom} to {activeResult.card.validTo}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">
                        Timestamp
                      </span>
                      <span className="font-mono text-slate-300 text-[11px]">
                        {new Date(activeResult.scannedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center space-y-2">
                  <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto" />
                  <p className="text-sm font-semibold text-slate-300">
                    No active card matched this QR token.
                  </p>
                  <p className="text-xs text-slate-500">
                    The token may have been tempered with, deleted, or unregistered.
                  </p>
                </div>
              )}

              {/* Action Buttons & Countdown */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-400 font-medium">
                  Auto-resuming in{' '}
                  <span className="font-bold text-white font-mono">{autoDismissSecs}s</span>
                </span>

                <button
                  type="button"
                  onClick={handleDismissModal}
                  className={`px-5 py-2 rounded-xl text-xs font-bold text-white shadow transition flex items-center gap-1.5 ${
                    activeResult.valid
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  Scan Next (Space) →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleAccessGate>
  );
}
