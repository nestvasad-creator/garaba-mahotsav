'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Printer,
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  Eye,
  Download,
  X,
  UserCheck,
} from 'lucide-react';
import { RoleAccessGate } from '@/components/auth/RoleAccessGate';
import { getCurrentUserSession } from '@/lib/auth/actions';
import {
  getPrintQueue,
  dispatchPrint,
  batchDispatchPrint,
  requestCardReprint,
  PrintQueueItem,
} from '@/lib/cards/actions';
import { CR80Card, CardRenderData } from '@/components/card-renderer/CR80Card';
import { saveCardAsImage, printCardDirectly } from '@/lib/cards/exportCard';
import { ReprintReason } from '@/types';

interface BatchPrintFailedItem {
  cardId: string;
  cardNumber: string;
  holderName?: string;
  error: string;
}

interface BatchPrintProgressState {
  isOpen: boolean;
  isProcessing: boolean;
  total: number;
  current: number;
  currentCardNumber: string;
  currentCardName: string;
  percent: number;
  printerIdentifier: string;
  succeededCount: number;
  failedItems: BatchPrintFailedItem[];
  isComplete: boolean;
}

export default function PrintQueuePage() {
  const [currentRoleCode, setCurrentRoleCode] = useState<string | undefined>(undefined);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Live Queue State
  const [queue, setQueue] = useState<PrintQueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'QUEUED' | 'PRINTED'>('ALL');

  // Preview Modal
  const [previewCard, setPreviewCard] = useState<PrintQueueItem | null>(null);
  const [savingImage, setSavingImage] = useState(false);
  const [directPrintingJob, setDirectPrintingJob] = useState<PrintQueueItem | null>(null);

  // Reprint Modal
  const [showReprintModal, setShowReprintModal] = useState(false);
  const [selectedReprintCard, setSelectedReprintCard] = useState<PrintQueueItem | null>(null);
  const [reprintReason, setReprintReason] = useState<ReprintReason>('DAMAGED');
  const [reprintNotes, setReprintNotes] = useState('');
  const [reprintSubmitting, setReprintSubmitting] = useState(false);

  // Status/feedback
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; error?: boolean } | null>(
    null
  );
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [batchProgress, setBatchProgress] = useState<BatchPrintProgressState>({
    isOpen: false,
    isProcessing: false,
    total: 0,
    current: 0,
    currentCardNumber: '',
    currentCardName: '',
    percent: 0,
    printerIdentifier: '',
    succeededCount: 0,
    failedItems: [],
    isComplete: false,
  });
  const abortBatchRef = React.useRef(false);

  const fetchQueue = async () => {
    setLoadingQueue(true);
    try {
      const data = await getPrintQueue();
      setQueue(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    async function init() {
      const sess = await getCurrentUserSession();
      setCurrentRoleCode(sess?.roleCode);
      setLoadingAuth(false);
      await fetchQueue();
    }
    init();
  }, []);

  // Printer Selector State (Zebra ZC300 Card Printer defaulted as primary connected hardware)
  const [selectedPrinter, setSelectedPrinter] = useState<string>('ZEBRA-ZC300-USB01');
  const [customPrinterName, setCustomPrinterName] = useState<string>('');

  const activePrinterIdentifier =
    selectedPrinter === 'CUSTOM' && customPrinterName.trim()
      ? customPrinterName.trim()
      : selectedPrinter;

  const handlePrint = async (cardId: string, printer?: string) => {
    const targetPrinter = printer || activePrinterIdentifier;
    setActionInProgressId(cardId);
    setFeedbackMessage(null);

    try {
      const res = await dispatchPrint(cardId, targetPrinter);
      if (!res.success) {
        setFeedbackMessage({ text: res.error || 'Failed to dispatch print job.', error: true });
      } else {
        setFeedbackMessage({ text: `Card dispatched and sent to printer ${targetPrinter}!` });
        await fetchQueue();
        setTimeout(() => setFeedbackMessage(null), 4000);
      }
    } catch (err: any) {
      setFeedbackMessage({ text: err.message, error: true });
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleDirectPrintRow = async (job: PrintQueueItem) => {
    setActionInProgressId(job.cardId);
    setDirectPrintingJob(job);
    setFeedbackMessage({ text: `Connecting to printer ${activePrinterIdentifier}...` });

    // Allow DOM 250ms to mount the staging card element
    setTimeout(async () => {
      const el = document.getElementById('cr80-staging-card');
      if (el) {
        try {
          await printCardDirectly(el);
        } catch (e: any) {
          console.warn('Physical print error:', e);
        }
      }

      try {
        const res = await dispatchPrint(job.cardId, activePrinterIdentifier);
        if (res.success) {
          setFeedbackMessage({ text: `Card ${job.cardNumber} dispatched to ${activePrinterIdentifier}!` });
          await fetchQueue();
          setTimeout(() => setFeedbackMessage(null), 4000);
        } else {
          setFeedbackMessage({ text: res.error || 'Failed to record print job.', error: true });
        }
      } catch (err: any) {
        setFeedbackMessage({ text: err.message, error: true });
      } finally {
        setActionInProgressId(null);
        setDirectPrintingJob(null);
      }
    }, 250);
  };

  const handleBatchPrint = async (cardsOverride?: PrintQueueItem[]) => {
    const targetCards = cardsOverride || queue.filter((j) => j.status === 'QUEUED');
    if (targetCards.length === 0) {
      setFeedbackMessage({ text: 'No cards currently in QUEUED status to print.', error: true });
      return;
    }

    abortBatchRef.current = false;
    setBatchPrinting(true);
    setFeedbackMessage(null);

    setBatchProgress({
      isOpen: true,
      isProcessing: true,
      total: targetCards.length,
      current: 0,
      currentCardNumber: targetCards[0].cardNumber,
      currentCardName: targetCards[0].holderNameEn,
      percent: 0,
      printerIdentifier: activePrinterIdentifier,
      succeededCount: 0,
      failedItems: [],
      isComplete: false,
    });

    let succeeded = 0;
    const failed: BatchPrintFailedItem[] = [];

    for (let i = 0; i < targetCards.length; i++) {
      if (abortBatchRef.current) {
        break;
      }

      const card = targetCards[i];
      const progressPercent = Math.round(((i + 1) / targetCards.length) * 100);

      setBatchProgress((prev) => ({
        ...prev,
        current: i + 1,
        currentCardNumber: card.cardNumber,
        currentCardName: card.holderNameEn,
        percent: progressPercent,
      }));

      try {
        const res = await dispatchPrint(card.cardId, activePrinterIdentifier);
        if (res.success) {
          succeeded++;
          setBatchProgress((prev) => ({ ...prev, succeededCount: succeeded }));
        } else {
          failed.push({
            cardId: card.cardId,
            cardNumber: card.cardNumber,
            holderName: card.holderNameEn,
            error: res.error || 'Print dispatch rejected by server',
          });
          setBatchProgress((prev) => ({ ...prev, failedItems: [...failed] }));
        }
      } catch (err: any) {
        failed.push({
          cardId: card.cardId,
          cardNumber: card.cardNumber,
          holderName: card.holderNameEn,
          error: err.message || 'Unexpected communication failure',
        });
        setBatchProgress((prev) => ({ ...prev, failedItems: [...failed] }));
      }

      // Small pause for smooth visual progression in UI
      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    await fetchQueue();

    setBatchProgress((prev) => ({
      ...prev,
      isProcessing: false,
      isComplete: true,
      percent: 100,
    }));
    setBatchPrinting(false);

    if (failed.length === 0) {
      setFeedbackMessage({
        text: `Batch print completed! All ${succeeded} cards successfully dispatched to ${activePrinterIdentifier}.`,
      });
    } else if (succeeded > 0) {
      setFeedbackMessage({
        text: `Batch print finished with issues: ${succeeded} succeeded, ${failed.length} failed. Check the details modal.`,
        error: true,
      });
    } else {
      setFeedbackMessage({
        text: `Batch print failed for all ${failed.length} cards.`,
        error: true,
      });
    }
  };

  const handleRetryFailedBatch = () => {
    const failedIds = new Set(batchProgress.failedItems.map((f) => f.cardId));
    const retryCards = queue.filter((c) => failedIds.has(c.cardId));
    if (retryCards.length > 0) {
      handleBatchPrint(retryCards);
    }
  };

  const handleCancelBatch = () => {
    abortBatchRef.current = true;
  };

  const handleCloseBatchModal = () => {
    setBatchProgress((prev) => ({ ...prev, isOpen: false }));
  };

  const handleConfirmReprint = async () => {
    if (!selectedReprintCard) return;
    setReprintSubmitting(true);
    setFeedbackMessage(null);
    try {
      const res = await requestCardReprint({
        cardId: selectedReprintCard.cardId,
        reason: reprintReason,
        notes: reprintNotes,
      });

      if (!res.success) {
        setFeedbackMessage({ text: res.error || 'Failed to authorize reprint.', error: true });
      } else {
        setShowReprintModal(false);
        setReprintNotes('');
        setFeedbackMessage({ text: res.message || 'Reprint authorized and card queued!' });
        await fetchQueue();
        setTimeout(() => setFeedbackMessage(null), 5000);
      }
    } catch (err: any) {
      setFeedbackMessage({ text: err.message, error: true });
    } finally {
      setReprintSubmitting(false);
    }
  };

  const handleSaveImage = async (format: 'png' | 'jpeg') => {
    if (!previewCard) return;
    const el = document.getElementById(`cr80-card-${previewCard.cardNumber}`);
    if (!el) {
      setFeedbackMessage({ text: 'Card preview element not found.', error: true });
      return;
    }
    setSavingImage(true);
    try {
      const sanitizedName = (previewCard.holderNameEn || 'Participant').replace(/[^a-zA-Z0-9_-]/g, '_');
      await saveCardAsImage(el, {
        fileName: `Card-${previewCard.cardNumber}-${sanitizedName}`,
        format,
        pixelRatio: 3,
      });
      setFeedbackMessage({ text: `Card saved successfully as ${format.toUpperCase()} file!` });
    } catch (err: any) {
      setFeedbackMessage({ text: `Failed to export card image: ${err.message}`, error: true });
    } finally {
      setSavingImage(false);
    }
  };

  const filteredQueue = queue.filter((j) => {
    if (filterStatus === 'ALL') return true;
    return j.status === filterStatus;
  });

  const queuedCount = queue.filter((j) => j.status === 'QUEUED').length;
  const printedCount = queue.filter((j) => j.status === 'PRINTED').length;
  const totalReprints = queue.reduce((acc, j) => acc + j.reprintCount, 0);

  if (loadingAuth) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
          <div className="w-4 h-4 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
          <span>Checking authorization...</span>
        </div>
      </div>
    );
  }

  return (
    <RoleAccessGate
      currentRoleCode={currentRoleCode}
      allowedRoles={[
        'PRINTER_OPERATOR',
        'VERIFIER',
        'EVENT_ADMIN',
        'SUPER_ADMIN',
        'SPECIAL_ID_OPERATOR',
      ]}
      moduleNameEn="Physical ID Card Print Queue & Reprint Control"
      moduleNameGu="ID Card Print Queue & Reprint Control"
    >
      <div className="min-h-screen bg-slate-100 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Printer className="w-5 h-5 text-purple-600" />
                Physical ID Card Print Queue & Controlled Reprint Station
              </h1>
              <p className="text-xs text-slate-500">
                Thermal CR80 card dispatch and reprint justification station
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={fetchQueue}
              disabled={loadingQueue}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingQueue ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => handleBatchPrint()}
              disabled={batchPrinting || queuedCount === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 shadow-sm transition disabled:opacity-50"
            >
              <Layers className="w-4 h-4" />
              {batchPrinting ? 'Dispatching Batch...' : `Batch Print (${queuedCount} Queued)`}
            </button>
          </div>
        </header>

        {/* Main Container */}
        <main className="max-w-7xl mx-auto w-full p-6 flex-1 space-y-6">
          {feedbackMessage && (
            <div
              className={`p-4 rounded-xl border text-xs font-semibold flex items-center gap-2 shadow-sm ${
                feedbackMessage.error
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-purple-50 border-purple-200 text-purple-900'
              }`}
            >
              {feedbackMessage.error ? (
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          {/* Queue Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-500">Queued for Print</span>
                <div className="text-2xl font-extrabold text-purple-600 mt-1">{queuedCount}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-500">Printed Badges</span>
                <div className="text-2xl font-extrabold text-emerald-600 mt-1">{printedCount}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-500">Controlled Reprints</span>
                <div className="text-2xl font-extrabold text-amber-600 mt-1">{totalReprints}</div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <RefreshCw className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Destination Printer & Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterStatus === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All Badges ({queue.length})
              </button>
              <button
                onClick={() => setFilterStatus('QUEUED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterStatus === 'QUEUED'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Queued ({queuedCount})
              </button>
              <button
                onClick={() => setFilterStatus('PRINTED')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterStatus === 'PRINTED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Printed ({printedCount})
              </button>
            </div>

            {/* Destination Printer Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Printer className="w-4 h-4 text-purple-600" />
                <span>Destination Printer:</span>
              </div>
              <select
                value={selectedPrinter}
                onChange={(e) => setSelectedPrinter(e.target.value)}
                className="text-xs font-semibold bg-purple-50/70 border border-purple-300 rounded-xl px-3 py-1.5 text-purple-950 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none cursor-pointer shadow-xs"
              >
                <option value="ZEBRA-ZC300-USB01">Zebra ZC300 Card Printer (USB 01) — Connected / Default</option>
                <option value="FARGO-DTC1250e-USB01">HID Fargo DTC1250e (USB 01)</option>
                <option value="EVOLIS-ZENIUS-01">Evolis Zenius / Primacy (LAN)</option>
                <option value="MAGICARD-300-USB">Magicard 300 Duo (USB 02)</option>
                <option value="EPSON-L8050-PVC">Epson L8050 PVC Card Tray</option>
                <option value="SYSTEM-DEFAULT-PRINTER">System Default / Browser Print</option>
                <option value="CUSTOM">Custom Network / USB Printer...</option>
              </select>

              {selectedPrinter === 'CUSTOM' && (
                <input
                  type="text"
                  value={customPrinterName}
                  onChange={(e) => setCustomPrinterName(e.target.value)}
                  placeholder="Enter printer name/IP..."
                  className="text-xs border border-purple-300 rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-purple-500 focus:outline-none w-44"
                />
              )}
            </div>
          </div>

          {/* Jobs Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Card Number</th>
                    <th className="py-3 px-4">Holder Details</th>
                    <th className="py-3 px-4">Category / Gender</th>
                    <th className="py-3 px-4">Requested</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Prints / Reprints</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingQueue ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
                          <span>Loading print queue from Supabase...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredQueue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No cards found in this filter status.
                      </td>
                    </tr>
                  ) : (
                    filteredQueue.map((job) => (
                      <tr key={job.cardId} className="hover:bg-slate-50/75 transition">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            {job.cardNumber}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 text-sm">
                            {job.holderNameEn}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="text-slate-800 font-medium">{job.categoryEn}</div>
                          {job.gender && (
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
                                job.gender === 'FEMALE'
                                  ? 'bg-pink-100 text-pink-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}
                            >
                              {job.gender}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">{job.requestedAt}</td>
                        <td className="py-3.5 px-4">
                          {job.status === 'QUEUED' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                              <Clock className="w-3 h-3" /> Queued
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Printed
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-mono text-slate-700">
                            Prints: <span className="font-bold">{job.printCount}</span>
                          </div>
                          {job.reprintCount > 0 && (
                            <div className="text-[10px] text-amber-700 font-semibold mt-0.5">
                              {job.reprintCount} Reprint(s)
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-2">
                          <button
                            onClick={() => {
                              setPreviewCard(job);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition inline-flex items-center"
                            title="Preview, Save & Print Card"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {job.status === 'QUEUED' ? (
                            <button
                              onClick={() => handleDirectPrintRow(job)}
                              disabled={actionInProgressId === job.cardId}
                              className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition shadow-xs disabled:opacity-50 text-xs inline-flex items-center gap-1.5"
                              title={`Print on ${activePrinterIdentifier}`}
                            >
                              <Printer className="w-3.5 h-3.5" />
                              {actionInProgressId === job.cardId ? 'Printing...' : 'Print Card'}
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setSelectedReprintCard(job);
                                setShowReprintModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 font-semibold hover:bg-amber-100 transition inline-flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Request Reprint
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* Visual Preview Modal */}
        {previewCard && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-purple-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      CR80 Physical Badge Preview
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400">
                      {previewCard.cardNumber}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setPreviewCard(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* CR80 Card Preview Display (Single Sided) */}
              <div className="py-4 flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200">
                <CR80Card
                  key={`preview-${previewCard.cardId}-${previewCard.cardNumber}`}
                  id={`cr80-card-${previewCard.cardNumber}`}
                  data={{
                    cardNumber: previewCard.cardNumber,
                    qrToken: previewCard.qrToken,
                    holderNameEn: previewCard.holderNameEn,
                    holderNameGu: previewCard.holderNameGu,
                    categoryEn: previewCard.categoryEn,
                    categoryGu: previewCard.categoryGu,
                    categoryCode: previewCard.categoryCode,
                    gender: previewCard.gender,
                    photoUrl: previewCard.photoUrl,
                    validFrom: '01-Oct-2026',
                    validTo: '12-Oct-2026',
                    areaZone: 'East Zone / Vasad',
                    eventNameEn: 'NAVRATRI MAHOTSAV 2026',
                    organizationEn: 'THE NEW ENGLISH SCHOOL TRUST, VASAD',
                    physicalFormNumber: previewCard.physicalFormNumber || null,
                    receiptNumber: previewCard.receiptNumber || null,
                  }}
                  theme={previewCard.theme}
                  scale={1.05}
                />
              </div>

              {/* Destination Printer Selector inside Modal */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Printer className="w-3.5 h-3.5 text-purple-600" />
                  <span>Target Printer:</span>
                </div>
                <select
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                  className="text-xs font-semibold bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  <option value="ZEBRA-ZC300-USB01">Zebra ZC300 Card Printer (USB 01) — Connected / Default</option>
                  <option value="FARGO-DTC1250e-USB01">HID Fargo DTC1250e (USB 01)</option>
                  <option value="EVOLIS-ZENIUS-01">Evolis Zenius / Primacy (LAN)</option>
                  <option value="MAGICARD-300-USB">Magicard 300 Duo (USB 02)</option>
                  <option value="EPSON-L8050-PVC">Epson L8050 PVC Card Tray</option>
                  <option value="SYSTEM-DEFAULT-PRINTER">System Default / Browser Print</option>
                  <option value="CUSTOM">Custom Network / USB Printer...</option>
                </select>
              </div>

              {/* Modal Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSaveImage('png')}
                    disabled={savingImage}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-purple-300 bg-purple-50 text-xs font-bold text-purple-700 hover:bg-purple-100 transition shadow-xs disabled:opacity-50"
                    title="Download card as PNG image to print later"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {savingImage ? 'Saving...' : 'Save PNG'}
                  </button>

                  <button
                    onClick={() => handleSaveImage('jpeg')}
                    disabled={savingImage}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
                    title="Download card as JPEG image to print later"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Save JPEG
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const cardEl = document.getElementById(`cr80-card-${previewCard.cardNumber}`);
                      if (cardEl) {
                        await printCardDirectly(cardEl);
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                    title="Print physical CR80 card directly"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Card
                  </button>
                  <button
                    disabled={actionInProgressId === previewCard.cardId}
                    onClick={async () => {
                      const cardToDispatch = previewCard;
                      const cardEl = document.getElementById(`cr80-card-${cardToDispatch.cardNumber}`);
                      if (cardEl) {
                        try {
                          await printCardDirectly(cardEl);
                        } catch (err) {
                          console.error('Physical print error:', err);
                        }
                      }
                      await handlePrint(cardToDispatch.cardId);
                      setPreviewCard(null);
                    }}
                    className="px-4 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                    title={`Dispatch to ${activePrinterIdentifier}`}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {actionInProgressId === previewCard.cardId ? 'Dispatching...' : 'Dispatch to Printer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Controlled Reprint Authorization Modal */}
        {showReprintModal && selectedReprintCard && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm font-bold">
                    Controlled Reprint Authorization Check
                  </h3>
                </div>
                <button
                  onClick={() => setShowReprintModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl text-xs text-amber-900 leading-relaxed">
                Reprinting card <span className="font-mono font-bold">{selectedReprintCard.cardNumber}</span> for{' '}
                <span className="font-bold">{selectedReprintCard.holderNameEn}</span>.
                <span className="block mt-1 text-[11px] text-amber-800">
                  Current Reprint Count: <span className="font-bold">{selectedReprintCard.reprintCount}</span>. All reprints are permanently recorded in immutable audit logs.
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Mandatory Reprint Reason
                </label>
                <select
                  value={reprintReason}
                  onChange={(e) => setReprintReason(e.target.value as ReprintReason)}
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500"
                >
                  <option value="LOST">Lost by Participant</option>
                  <option value="DAMAGED">Physical Damage / Broken</option>
                  <option value="WRONG_PRINT">Misprint / Color Deviation</option>
                  <option value="PRINTER_FAILURE">Printer Jam / Ribbon Error</option>
                  <option value="PHOTO_REPLACEMENT">Photo / Detail Updated</option>
                  <option value="OTHER">Other Administrative Reason</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Operator Justification & Remarks
                </label>
                <textarea
                  rows={2}
                  value={reprintNotes}
                  onChange={(e) => setReprintNotes(e.target.value)}
                  placeholder="Explain reason for reprint for security compliance..."
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReprintModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReprint}
                  disabled={reprintSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 shadow transition disabled:opacity-50"
                >
                  {reprintSubmitting ? 'Authorizing...' : 'Authorize & Queue Reprint'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Batch Print Progress & Result Modal */}
        {batchProgress.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      batchProgress.isProcessing
                        ? 'bg-purple-100 text-purple-600'
                        : batchProgress.failedItems.length > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {batchProgress.isProcessing ? (
                      <Printer className="w-5 h-5 animate-pulse" />
                    ) : batchProgress.failedItems.length > 0 ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {batchProgress.isProcessing
                        ? 'Batch Printing in Progress'
                        : batchProgress.failedItems.length > 0
                        ? 'Batch Print Completed with Issues'
                        : 'Batch Print Complete!'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Destination:{' '}
                      <span className="font-semibold text-slate-800">
                        {batchProgress.printerIdentifier}
                      </span>
                    </p>
                  </div>
                </div>

                {!batchProgress.isProcessing && (
                  <button
                    onClick={handleCloseBatchModal}
                    className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Progress Bar & Live Status */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">
                    {batchProgress.isProcessing ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping inline-block" />
                        Processing Card {batchProgress.current} of {batchProgress.total}
                      </span>
                    ) : (
                      `${batchProgress.succeededCount} of ${batchProgress.total} cards dispatched successfully`
                    )}
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {batchProgress.percent}%
                  </span>
                </div>

                {/* Visual Progress Bar */}
                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ease-out ${
                      batchProgress.failedItems.length > 0 && !batchProgress.isProcessing
                        ? 'bg-gradient-to-r from-purple-600 via-amber-500 to-rose-500'
                        : 'bg-gradient-to-r from-purple-600 to-emerald-500'
                    }`}
                    style={{ width: `${batchProgress.percent}%` }}
                  />
                </div>

                {/* Active Card Indicator while processing */}
                {batchProgress.isProcessing && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between text-xs">
                    <div className="truncate mr-2">
                      <span className="text-slate-400 text-[11px] block">
                        Currently Dispatching:
                      </span>
                      <span className="font-bold text-slate-800">
                        {batchProgress.currentCardName}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 flex-shrink-0">
                      {batchProgress.currentCardNumber}
                    </span>
                  </div>
                )}
              </div>

              {/* Stats Counters */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2">
                  <div className="text-[11px] text-slate-500">Total Cards</div>
                  <div className="text-base font-bold text-slate-800">
                    {batchProgress.total}
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2">
                  <div className="text-[11px] text-emerald-700">Dispatched</div>
                  <div className="text-base font-bold text-emerald-700">
                    {batchProgress.succeededCount}
                  </div>
                </div>
                <div
                  className={`rounded-xl p-2 border ${
                    batchProgress.failedItems.length > 0
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-slate-50 border-slate-200 text-slate-400'
                  }`}
                >
                  <div className="text-[11px]">Errors</div>
                  <div className="text-base font-bold">
                    {batchProgress.failedItems.length}
                  </div>
                </div>
              </div>

              {/* Error Detail Breakdown List */}
              {batchProgress.failedItems.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-700">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Failed Cards Details ({batchProgress.failedItems.length})
                    </span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                    {batchProgress.failedItems.map((fail) => (
                      <div
                        key={fail.cardId}
                        className="bg-rose-50/80 border border-rose-200 rounded-xl p-2.5 text-xs text-rose-900 flex flex-col gap-0.5"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="font-mono text-[11px]">{fail.cardNumber}</span>
                          <span className="text-[11px] text-slate-600">
                            {fail.holderName}
                          </span>
                        </div>
                        <div className="text-[11px] text-rose-700 font-medium">
                          Reason: {fail.error}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                {batchProgress.isProcessing ? (
                  <button
                    type="button"
                    onClick={handleCancelBatch}
                    className="px-4 py-2 rounded-xl border border-rose-300 text-xs font-bold text-rose-700 hover:bg-rose-50 transition"
                  >
                    Cancel / Stop Batch
                  </button>
                ) : (
                  <>
                    {batchProgress.failedItems.length > 0 && (
                      <button
                        type="button"
                        onClick={handleRetryFailedBatch}
                        className="px-4 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold hover:bg-amber-700 shadow-sm transition inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Retry Failed Cards ({batchProgress.failedItems.length})
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCloseBatchModal}
                      className="px-5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 shadow-sm transition"
                    >
                      Done
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Hidden CR80 Card Staging for Direct Physical Printing from Table Rows */}
        {directPrintingJob && (
          <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none', zIndex: -9999 }}>
            <CR80Card
              key={`staging-${directPrintingJob.cardId}-${directPrintingJob.cardNumber}`}
              id="cr80-staging-card"
              data={{
                cardNumber: directPrintingJob.cardNumber,
                qrToken: directPrintingJob.qrToken,
                holderNameEn: directPrintingJob.holderNameEn,
                holderNameGu: directPrintingJob.holderNameGu,
                categoryEn: directPrintingJob.categoryEn,
                categoryGu: directPrintingJob.categoryGu,
                categoryCode: directPrintingJob.categoryCode,
                gender: directPrintingJob.gender,
                photoUrl: directPrintingJob.photoUrl,
                validFrom: '01-Oct-2026',
                validTo: '12-Oct-2026',
                areaZone: 'East Zone / Vasad',
                eventNameEn: 'NAVRATRI MAHOTSAV 2026',
                organizationEn: 'THE NEW ENGLISH SCHOOL TRUST, VASAD',
                physicalFormNumber: directPrintingJob.physicalFormNumber || null,
                receiptNumber: directPrintingJob.receiptNumber || null,
              }}
              theme={directPrintingJob.theme}
              scale={1.0}
            />
          </div>
        )}
      </div>
    </RoleAccessGate>
  );
}
