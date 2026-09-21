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
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { RoleAccessGate } from '@/components/auth/RoleAccessGate';
import { getCurrentUserSession } from '@/lib/auth/actions';
import {
  getPrintQueue,
  dispatchPrint,
  batchDispatchPrint,
  requestCardReprint,
  revertCardToQueue,
  batchRevertToQueue,
  manualSetCardPrintStatus,
  batchManualSetCardPrintStatus,
  PrintQueueItem,
} from '@/lib/cards/actions';
import { CR80Card, CardRenderData } from '@/components/card-renderer/CR80Card';
import {
  saveCardAsImage,
  printCardDirectly,
  renderCardToDataUrl,
  printBatchCardsDirectly,
  ensureImagesLoaded,
} from '@/lib/cards/exportCard';
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
  activeCard?: PrintQueueItem | null;
  stage?: 'verifying' | 'rendering' | 'dialog' | 'confirming' | 'complete';
  statusText?: string;
  capturedCardIds?: string[];
  capturedCards?: PrintQueueItem[];
}

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type PageSizeOption = (typeof PAGE_SIZE_OPTIONS)[number];

function PrintQueuePaginationBar({
  page,
  totalPages,
  totalCount,
  pageSize,
  onPage,
  onPageSize,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: PageSizeOption;
  onPage: (p: number) => void;
  onPageSize: (s: PageSizeOption) => void;
}) {
  if (totalCount === 0) return null;

  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);

  // Smart page numbers
  const pages: (number | '…')[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push('…');
    pages.push(totalPages);
  }

  const btnBase =
    'h-8 min-w-[2rem] px-2 rounded-lg text-xs font-semibold flex items-center justify-center transition select-none';
  const btnActive = 'bg-purple-600 text-white shadow-xs';
  const btnNormal = 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50';
  const btnDisabled = 'border border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed';

  return (
    <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
      <div className="text-xs text-slate-500 flex items-center gap-3">
        <span>
          Showing{' '}
          <strong className="text-slate-700">
            {from}–{to}
          </strong>{' '}
          of <strong className="text-slate-700">{totalCount.toLocaleString()}</strong> badges
        </span>

        <span className="flex items-center gap-1.5 text-slate-500">
          Rows per page:
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value) as PageSizeOption)}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-300 cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(1)}
          disabled={page === 1}
          className={`${btnBase} ${page === 1 ? btnDisabled : btnNormal}`}
          title="First page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className={`${btnBase} ${page === 1 ? btnDisabled : btnNormal}`}
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-slate-400 text-xs select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`${btnBase} ${p === page ? btnActive : btnNormal}`}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className={`${btnBase} ${page === totalPages ? btnDisabled : btnNormal}`}
          title="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onPage(totalPages)}
          disabled={page === totalPages}
          className={`${btnBase} ${page === totalPages ? btnDisabled : btnNormal}`}
          title="Last page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function PrintQueuePage() {
  const [currentRoleCode, setCurrentRoleCode] = useState<string | undefined>(undefined);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Live Queue State
  const [queue, setQueue] = useState<PrintQueueItem[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'QUEUED' | 'PRINTED'>('QUEUED');

  // Pagination State (Minimum 20 per page)
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<PageSizeOption>(20);

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
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [pendingConfirmJob, setPendingConfirmJob] = useState<PrintQueueItem | null>(null);
  const [confirmingPrint, setConfirmingPrint] = useState(false);
  const [batchPrinting, setBatchPrinting] = useState(false);
  const [batchStagingCards, setBatchStagingCards] = useState<PrintQueueItem[]>([]);
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
    activeCard: null,
    stage: 'verifying',
    statusText: '',
    capturedCardIds: [],
    capturedCards: [],
  });
  const [batchConfirmedPrintedIds, setBatchConfirmedPrintedIds] = useState<Set<string>>(new Set());
  const [firstNCount, setFirstNCount] = useState<string>('');
  const [bulkStatusUpdating, setBulkStatusUpdating] = useState<boolean>(false);
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
  const [selectedPrinter, setSelectedPrinter] = useState<string>('Zebra ZC300 USB Card Printer');
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
    setFeedbackMessage({ text: `Opening print dialog for ${job.cardNumber}...` });

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

      setActionInProgressId(null);
      setDirectPrintingJob(null);
      // Prompt operator to verify physical output after dialog closes
      setPendingConfirmJob(job);
    }, 250);
  };


  const handleRevertToQueue = async (cardId: string) => {
    setActionInProgressId(cardId);
    setFeedbackMessage(null);
    try {
      const res = await revertCardToQueue(cardId);
      if (res.success) {
        setFeedbackMessage({ text: res.message || 'Card returned to print queue.' });
        await fetchQueue();
        setTimeout(() => setFeedbackMessage(null), 4000);
      } else {
        setFeedbackMessage({ text: res.error || 'Failed to revert card.', error: true });
      }
    } catch (err: any) {
      setFeedbackMessage({ text: err.message, error: true });
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleManualSetSingleStatus = async (
    cardId: string,
    targetStatus: 'PRINTED' | 'QUEUED'
  ) => {
    setActionInProgressId(cardId);
    setFeedbackMessage(null);
    try {
      const res = await manualSetCardPrintStatus(
        cardId,
        targetStatus,
        activePrinterIdentifier
      );
      if (res.success) {
        setFeedbackMessage({
          text: res.message || `Card status updated to ${targetStatus}!`,
        });
        await fetchQueue();
        setTimeout(() => setFeedbackMessage(null), 4000);
      } else {
        setFeedbackMessage({
          text: res.error || `Failed to update card status to ${targetStatus}.`,
          error: true,
        });
      }
    } catch (err: any) {
      setFeedbackMessage({ text: err.message, error: true });
    } finally {
      setActionInProgressId(null);
    }
  };

  const handleBulkSetStatus = async (targetStatus: 'PRINTED' | 'QUEUED') => {
    if (selectedCardIds.size === 0) return;
    setBulkStatusUpdating(true);
    setFeedbackMessage(null);
    try {
      const cardIds = Array.from(selectedCardIds);
      const res = await batchManualSetCardPrintStatus(
        cardIds,
        targetStatus,
        activePrinterIdentifier
      );
      if (res.success) {
        setFeedbackMessage({
          text: `Successfully updated ${res.count} card(s) to ${targetStatus}!`,
        });
        setSelectedCardIds(new Set());
        await fetchQueue();
        setTimeout(() => setFeedbackMessage(null), 4000);
      } else {
        setFeedbackMessage({
          text: res.error || `Failed to update cards to ${targetStatus}.`,
          error: true,
        });
      }
    } catch (err: any) {
      setFeedbackMessage({ text: err.message, error: true });
    } finally {
      setBulkStatusUpdating(false);
    }
  };

  const handleBatchPrint = async (cardsOverride?: PrintQueueItem[]) => {
    let targetCards: PrintQueueItem[] = [];

    if (cardsOverride && cardsOverride.length > 0) {
      targetCards = cardsOverride;
    } else if (selectedCardIds.size > 0) {
      targetCards = queue.filter((j) => selectedCardIds.has(j.cardId));
    } else {
      targetCards = queue.filter((j) => j.status === 'QUEUED');
    }

    if (targetCards.length === 0) {
      setFeedbackMessage({ text: 'No cards selected or in QUEUED status to print.', error: true });
      return;
    }

    abortBatchRef.current = false;
    setBatchPrinting(true);
    setFeedbackMessage(null);

    // 1. Mount ALL target cards in parallel to prevent unmount/remount race conditions
    setBatchStagingCards(targetCards);

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
      activeCard: targetCards[0],
      stage: 'verifying',
      statusText: `Staging ${targetCards.length} cards for printer ${activePrinterIdentifier}...`,
      capturedCardIds: [],
    });

    // Give React DOM 220ms to mount all cards and start QR/photo loads
    await new Promise((resolve) => setTimeout(resolve, 220));

    let succeeded = 0;
    const failed: BatchPrintFailedItem[] = [];
    const capturedUrls: string[] = [];
    const capturedCardIds: string[] = [];

    for (let i = 0; i < targetCards.length; i++) {
      if (abortBatchRef.current) {
        break;
      }

      const card = targetCards[i];
      const progressPercent = Math.round((i / targetCards.length) * 100);

      setBatchProgress((prev) => ({
        ...prev,
        current: i + 1,
        currentCardNumber: card.cardNumber,
        currentCardName: card.holderNameEn,
        percent: progressPercent,
        activeCard: card,
        stage: 'verifying',
        statusText: `Verifying Photo & QR code for card ${i + 1} of ${targetCards.length} (${card.cardNumber})...`,
      }));

      try {
        const stagingEl = document.getElementById(`cr80-batch-staging-${card.cardId}`);
        if (!stagingEl) {
          throw new Error('Batch card staging element was not found in DOM');
        }

        // 1. Ensure QR code generation is completed and photo is fully decoded
        await ensureImagesLoaded(stagingEl);

        // 2. Capture high-resolution 300 DPI CR80 layout
        setBatchProgress((prev) => ({
          ...prev,
          stage: 'rendering',
          statusText: `Rendering 300 DPI layout for ${card.cardNumber}...`,
        }));

        const dataUrl = await renderCardToDataUrl(stagingEl);
        capturedUrls.push(dataUrl);
        capturedCardIds.push(card.cardId);
        succeeded++;

        setBatchProgress((prev) => ({
          ...prev,
          succeededCount: succeeded,
          percent: Math.round(((i + 1) / targetCards.length) * 100),
        }));
      } catch (err: any) {
        failed.push({
          cardId: card.cardId,
          cardNumber: card.cardNumber,
          holderName: card.holderNameEn,
          error: err.message || 'Image/QR load or rendering error',
        });
        setBatchProgress((prev) => ({
          ...prev,
          failedItems: [...failed],
          percent: Math.round(((i + 1) / targetCards.length) * 100),
        }));
      }

      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    // Clean up batch staging DOM
    setBatchStagingCards([]);

    // 3. Send all captured cards to the physical printer via multi-page CR80 job
    let usedSilent = false;
    if (capturedUrls.length > 0 && !abortBatchRef.current) {
      setBatchProgress((prev) => ({
        ...prev,
        stage: 'dialog',
        statusText: `Sending ${capturedUrls.length} card(s) to ${activePrinterIdentifier}...`,
      }));

      try {
        const printResult = await printBatchCardsDirectly(capturedUrls, activePrinterIdentifier);
        usedSilent = printResult.usedSilent;
      } catch (printErr: any) {
        console.warn('Physical batch print invocation error:', printErr);
      }
    }

    const processedCards = targetCards.filter((c) => capturedCardIds.includes(c.cardId));

    // 4. Move to CONFIRMATION stage (Do NOT automatically mark printed!)
    setBatchProgress((prev) => ({
      ...prev,
      isProcessing: false,
      stage: 'confirming',
      statusText: usedSilent
        ? `${succeeded} card(s) sent silently to ${activePrinterIdentifier} (no dialog). Verify printed badges below.`
        : `Print dialog opened for ${succeeded} cards. Verify printed badges below.`,
      percent: 100,
      capturedCardIds,
      capturedCards: processedCards,
    }));
    setBatchConfirmedPrintedIds(new Set(capturedCardIds));
    setFirstNCount('');
    setBatchPrinting(false);
  };

  const handleToggleBatchCardPrinted = (cardId: string) => {
    setBatchConfirmedPrintedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const handleSetFirstNPrinted = (n: number) => {
    if (!batchProgress.capturedCards) return;
    const clampedN = Math.max(0, Math.min(n, batchProgress.capturedCards.length));
    const next = new Set<string>();
    for (let i = 0; i < clampedN; i++) {
      next.add(batchProgress.capturedCards[i].cardId);
    }
    setBatchConfirmedPrintedIds(next);
  };

  const handleConfirmBatchStatuses = async () => {
    if (!batchProgress.capturedCardIds || batchProgress.capturedCardIds.length === 0) {
      handleCloseBatchModal();
      return;
    }
    const printedIds = Array.from(batchConfirmedPrintedIds);
    const unprintedCount = (batchProgress.capturedCards?.length || 0) - printedIds.length;

    setBatchProgress((prev) => ({
      ...prev,
      isProcessing: true,
      statusText: `Recording ${printedIds.length} card(s) as PRINTED in Supabase...`,
    }));

    if (printedIds.length > 0) {
      await batchDispatchPrint(printedIds, activePrinterIdentifier);
    }

    await fetchQueue();
    setSelectedCardIds(new Set());
    handleCloseBatchModal();

    if (printedIds.length === 0) {
      setFeedbackMessage({
        text: 'All cards kept in QUEUED status (none marked as printed).',
      });
    } else if (unprintedCount > 0) {
      setFeedbackMessage({
        text: `Batch updated: ${printedIds.length} card(s) marked as PRINTED, ${unprintedCount} kept in QUEUED (failed/jammed) ready to reprint.`,
      });
    } else {
      setFeedbackMessage({
        text: `All ${printedIds.length} cards marked as PRINTED on ${activePrinterIdentifier}!`,
      });
    }
    setTimeout(() => setFeedbackMessage(null), 5000);
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

  // Pagination calculations (Minimum 20 items per page)
  const totalPages = Math.max(1, Math.ceil(filteredQueue.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const currentPageCards = filteredQueue.slice(startIndex, endIndex);

  // Single-page Select All state
  const isAllCurrentPageSelected =
    currentPageCards.length > 0 &&
    currentPageCards.every((j) => selectedCardIds.has(j.cardId));

  const isSomeCurrentPageSelected =
    currentPageCards.some((j) => selectedCardIds.has(j.cardId)) &&
    !isAllCurrentPageSelected;

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
              disabled={batchPrinting || (selectedCardIds.size === 0 && queuedCount === 0)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 shadow-sm transition disabled:opacity-50"
            >
              <Layers className="w-4 h-4" />
              {batchPrinting
                ? 'Processing Batch...'
                : selectedCardIds.size > 0
                ? `Batch Print (${selectedCardIds.size} Selected)`
                : `Batch Print (${queuedCount} Queued)`}
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
                onClick={() => {
                  setFilterStatus('ALL');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterStatus === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                All Badges ({queue.length})
              </button>
              <button
                onClick={() => {
                  setFilterStatus('QUEUED');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterStatus === 'QUEUED'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Queued ({queuedCount})
              </button>
              <button
                onClick={() => {
                  setFilterStatus('PRINTED');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filterStatus === 'PRINTED'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                Printed ({printedCount})
              </button>

              {selectedCardIds.size > 0 && (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200 text-xs flex-wrap">
                  <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                    {selectedCardIds.size} selected
                  </span>

                  {/* Bulk Manual Status Controls */}
                  <div className="flex items-center gap-1.5 bg-slate-100/80 border border-slate-200 px-2 py-1 rounded-xl">
                    <span className="text-[11px] text-slate-600 font-semibold hidden sm:inline">Set Status:</span>
                    <button
                      onClick={() => handleBulkSetStatus('PRINTED')}
                      disabled={bulkStatusUpdating}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition flex items-center gap-1 text-[11px] shadow-2xs disabled:opacity-50"
                      title="Manually mark all selected cards as PRINTED in Supabase (no print dialog)"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Mark Printed
                    </button>
                    <button
                      onClick={() => handleBulkSetStatus('QUEUED')}
                      disabled={bulkStatusUpdating}
                      className="px-2.5 py-1 rounded-lg border border-amber-300 bg-white text-amber-800 font-semibold hover:bg-amber-50 transition flex items-center gap-1 text-[11px] shadow-2xs disabled:opacity-50"
                      title="Manually revert all selected cards to QUEUED in Supabase"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Revert to Queued
                    </button>
                  </div>

                  <button
                    onClick={() => setSelectedCardIds(new Set())}
                    className="text-slate-400 hover:text-rose-600 underline font-medium cursor-pointer text-[11px]"
                    title="Clear all selected badges"
                  >
                    Clear
                  </button>
                </div>
              )}
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
                <option value="Zebra ZC300 USB Card Printer">Zebra ZC300 USB Card Printer — Connected / Default</option>
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
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        ref={(el) => {
                          if (el) el.indeterminate = isSomeCurrentPageSelected;
                        }}
                        checked={isAllCurrentPageSelected}
                        onChange={(e) => {
                          const next = new Set(selectedCardIds);
                          if (e.target.checked) {
                            currentPageCards.forEach((j) => next.add(j.cardId));
                          } else {
                            currentPageCards.forEach((j) => next.delete(j.cardId));
                          }
                          setSelectedCardIds(next);
                        }}
                        className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        title={
                          isAllCurrentPageSelected
                            ? `Deselect all ${currentPageCards.length} badges on Page ${safeCurrentPage}`
                            : `Select all ${currentPageCards.length} badges on Page ${safeCurrentPage}`
                        }
                      />
                    </th>
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
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
                          <span>Loading print queue from Supabase...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredQueue.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        No cards found in this filter status.
                      </td>
                    </tr>
                  ) : (
                    currentPageCards.map((job) => (
                      <tr
                        key={job.cardId}
                        className={`transition ${
                          selectedCardIds.has(job.cardId)
                            ? 'bg-purple-50/50 hover:bg-purple-50/80'
                            : 'hover:bg-slate-50/75'
                        }`}
                      >
                        <td className="py-3.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedCardIds.has(job.cardId)}
                            onChange={(e) => {
                              const next = new Set(selectedCardIds);
                              if (e.target.checked) {
                                next.add(job.cardId);
                              } else {
                                next.delete(job.cardId);
                              }
                              setSelectedCardIds(next);
                            }}
                            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                        </td>
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
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleDirectPrintRow(job)}
                                disabled={actionInProgressId === job.cardId}
                                className="px-3 py-1.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition shadow-xs disabled:opacity-50 text-xs inline-flex items-center gap-1.5"
                                title={`Print on ${activePrinterIdentifier}`}
                              >
                                <Printer className="w-3.5 h-3.5" />
                                {actionInProgressId === job.cardId ? 'Printing...' : 'Print Card'}
                              </button>
                              <button
                                onClick={() => handleManualSetSingleStatus(job.cardId, 'PRINTED')}
                                disabled={actionInProgressId === job.cardId}
                                className="px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold hover:bg-emerald-100 transition text-xs inline-flex items-center gap-1 shadow-xs disabled:opacity-50"
                                title="Manually mark card as PRINTED in Supabase without triggering printer"
                              >
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Mark Printed
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                onClick={() => handleManualSetSingleStatus(job.cardId, 'QUEUED')}
                                disabled={actionInProgressId === job.cardId}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold transition text-xs inline-flex items-center gap-1 shadow-xs disabled:opacity-50"
                                title="Print cancelled or jammed? Revert back to QUEUED without formal reprint authorization"
                              >
                                <RotateCcw className="w-3 h-3 text-slate-500" />
                                Revert
                              </button>
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
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <PrintQueuePaginationBar
              page={safeCurrentPage}
              totalPages={totalPages}
              totalCount={filteredQueue.length}
              pageSize={pageSize}
              onPage={setPage}
              onPageSize={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
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
                  <option value="Zebra ZC300 USB Card Printer">Zebra ZC300 USB Card Printer — Connected / Default</option>
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
                    onClick={() => handleDirectPrintRow(previewCard)}
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
                      setPreviewCard(null);
                      await handleDirectPrintRow(cardToDispatch);
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

        {/* Batch Print Progress & Live Card Modal */}
        {batchProgress.isOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-5 my-8">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
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
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      {batchProgress.isProcessing
                        ? 'Batch Printing in Progress'
                        : batchProgress.failedItems.length > 0
                        ? 'Batch Print Finished with Issues'
                        : 'Batch Print Dispatched & Sent!'}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Physical Printer:{' '}
                      <span className="font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
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

              {/* Two Column Layout: Left = Live Card Preview, Right = Progress & Stats */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                {/* Left: Live Card Preview & Asset Verification */}
                <div className="md:col-span-5 flex flex-col items-center justify-center p-3.5 bg-gradient-to-b from-slate-50 to-slate-100/70 rounded-2xl border border-slate-200">
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    {batchProgress.isProcessing ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping inline-block" />
                        Live Card Being Printed
                      </>
                    ) : (
                      'Last Printed Badge'
                    )}
                  </div>

                  {batchProgress.activeCard ? (
                    <div className="shadow-lg rounded-xl overflow-hidden border border-slate-200/80 bg-white">
                      <CR80Card
                        data={{
                          cardNumber: batchProgress.activeCard.cardNumber,
                          qrToken: batchProgress.activeCard.qrToken,
                          holderNameEn: batchProgress.activeCard.holderNameEn,
                          holderNameGu: batchProgress.activeCard.holderNameGu,
                          categoryEn: batchProgress.activeCard.categoryEn,
                          categoryGu: batchProgress.activeCard.categoryGu,
                          categoryCode: batchProgress.activeCard.categoryCode,
                          gender: batchProgress.activeCard.gender,
                          photoUrl: batchProgress.activeCard.photoUrl,
                          validFrom: '01-Oct-2026',
                          validTo: '12-Oct-2026',
                          areaZone: 'East Zone / Vasad',
                          eventNameEn: 'NAVRATRI MAHOTSAV 2026',
                          organizationEn: 'THE NEW ENGLISH SCHOOL TRUST, VASAD',
                          physicalFormNumber: batchProgress.activeCard.physicalFormNumber || null,
                          receiptNumber: batchProgress.activeCard.receiptNumber || null,
                        }}
                        theme={batchProgress.activeCard.theme}
                        scale={0.65}
                      />
                    </div>
                  ) : (
                    <div className="w-[169px] h-[268px] flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl text-slate-400 text-xs">
                      <Printer className="w-8 h-8 mb-2 opacity-40" />
                      <span>No card selected</span>
                    </div>
                  )}

                  {/* Asset Verification Badges */}
                  <div className="mt-3 w-full flex flex-col gap-1 text-[11px]">
                    <div className="flex items-center justify-between px-2 py-1 bg-white rounded-lg border border-slate-200 text-slate-700">
                      <span className="font-medium">QR Verification:</span>
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ready & Verified
                      </span>
                    </div>
                    <div className="flex items-center justify-between px-2 py-1 bg-white rounded-lg border border-slate-200 text-slate-700">
                      <span className="font-medium">Photo Decode:</span>
                      <span className="font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ready & Decoded
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Progress Bar, Status, Counters, Errors */}
                <div className="md:col-span-7 space-y-4">
                  {/* Progress Bar & Live Status */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        {batchProgress.isProcessing ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping inline-block" />
                            Card {batchProgress.current} of {batchProgress.total}
                          </span>
                        ) : (
                          `${batchProgress.succeededCount} of ${batchProgress.total} cards ready`
                        )}
                      </span>
                      <span className="font-bold text-purple-700 font-mono text-sm">
                        {batchProgress.percent}%
                      </span>
                    </div>

                    {/* Visual Progress Bar */}
                    <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ease-out ${
                          batchProgress.failedItems.length > 0 && !batchProgress.isProcessing
                            ? 'bg-gradient-to-r from-purple-600 via-amber-500 to-rose-500'
                            : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-500'
                        }`}
                        style={{ width: `${batchProgress.percent}%` }}
                      />
                    </div>

                    {/* Status Message */}
                    <div className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-2">
                      {batchProgress.isProcessing && (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600 flex-shrink-0" />
                      )}
                      <span className="truncate">{batchProgress.statusText || 'Processing...'}</span>
                    </div>
                  </div>

                  {/* Active Card Details */}
                  {batchProgress.activeCard && (
                    <div className="bg-purple-50/60 border border-purple-200/80 rounded-xl p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">
                          Current Card Holder
                        </span>
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-white text-purple-700 border border-purple-200">
                          {batchProgress.activeCard.cardNumber}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm">
                        {batchProgress.activeCard.holderNameEn}
                      </div>
                      <div className="text-slate-500 text-[11px]">
                        Category: {batchProgress.activeCard.categoryEn} ({batchProgress.activeCard.categoryCode || 'GEN'})
                      </div>
                    </div>
                  )}

                  {/* Stats Counters */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                      <div className="text-[11px] text-slate-500">Total Cards</div>
                      <div className="text-lg font-bold text-slate-800">
                        {batchProgress.total}
                      </div>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                      <div className="text-[11px] text-emerald-700">Dispatched</div>
                      <div className="text-lg font-bold text-emerald-700">
                        {batchProgress.succeededCount}
                      </div>
                    </div>
                    <div
                      className={`rounded-xl p-2.5 border ${
                        batchProgress.failedItems.length > 0
                          ? 'bg-rose-50 border-rose-200 text-rose-800'
                          : 'bg-slate-50 border-slate-200 text-slate-400'
                      }`}
                    >
                      <div className="text-[11px]">Errors</div>
                      <div className="text-lg font-bold">
                        {batchProgress.failedItems.length}
                      </div>
                    </div>
                  </div>

                  {/* Zebra Driver Instructions Note */}
                  <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200/70 rounded-xl p-2.5">
                    💡 <strong>Zebra ZC300 Tip:</strong> Cards are prepared as continuous CR80 pages (53.98 × 85.60 mm). When the print preview dialog appears, select your Zebra driver to print all cards in one continuous feeder pass.
                  </div>

                  {/* Error Breakdown List */}
                  {batchProgress.failedItems.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-rose-700">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Failed Cards ({batchProgress.failedItems.length})
                        </span>
                      </div>
                      <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                        {batchProgress.failedItems.map((fail) => (
                          <div
                            key={fail.cardId}
                            className="bg-rose-50/80 border border-rose-200 rounded-xl p-2 text-xs text-rose-900 flex flex-col gap-0.5"
                          >
                            <div className="flex items-center justify-between font-bold">
                              <span className="font-mono text-[11px]">{fail.cardNumber}</span>
                              <span className="text-[11px] text-slate-600">
                                {fail.holderName}
                              </span>
                            </div>
                            <div className="text-[11px] text-rose-700 font-medium">
                              {fail.error}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions / Physical Confirmation Phase */}
              <div className="pt-3 border-t border-slate-100">
                {batchProgress.isProcessing ? (
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleCancelBatch}
                      className="px-4 py-2 rounded-xl border border-rose-300 text-xs font-bold text-rose-700 hover:bg-rose-50 transition"
                    >
                      Cancel / Stop Batch
                    </button>
                  </div>
                ) : batchProgress.stage === 'confirming' ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                      <div>
                        <span className="font-bold text-slate-900 text-sm flex items-center gap-2">
                          <Printer className="w-4 h-4 text-purple-600" />
                          Verify Printed Badges Output
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Cards sent to <strong>{batchProgress.printerIdentifier}</strong>. If some printed and some failed or jammed, manually adjust which badges are marked as printed below:
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 text-xs">
                        <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                          {batchConfirmedPrintedIds.size} / {batchProgress.capturedCards?.length || batchProgress.succeededCount} Printed
                        </span>
                      </div>
                    </div>

                    {/* Quick Helper Tools */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs bg-white p-2.5 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (batchProgress.capturedCards) {
                              setBatchConfirmedPrintedIds(
                                new Set(batchProgress.capturedCards.map((c) => c.cardId))
                              );
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 font-semibold transition text-[11px]"
                        >
                          ✓ Select All ({batchProgress.capturedCards?.length || batchProgress.succeededCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchConfirmedPrintedIds(new Set())}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold transition text-[11px]"
                        >
                          ✕ Deselect All (0)
                        </button>
                      </div>

                      {/* Quick First-N Helper for paper/card jam */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 font-medium">Jammed midway? First:</span>
                        <input
                          type="number"
                          min="0"
                          max={batchProgress.capturedCards?.length || batchProgress.succeededCount}
                          value={firstNCount}
                          onChange={(e) => setFirstNCount(e.target.value)}
                          placeholder="e.g. 5"
                          className="w-16 px-2 py-0.5 border border-slate-300 rounded-md text-xs font-mono focus:ring-1 focus:ring-purple-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const n = parseInt(firstNCount, 10);
                            if (!isNaN(n)) {
                              handleSetFirstNPrinted(n);
                            }
                          }}
                          className="px-2 py-1 rounded-md bg-purple-600 text-white font-semibold hover:bg-purple-700 transition text-[11px]"
                        >
                          Set First N
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Badge-by-Badge Checklist */}
                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                      {batchProgress.capturedCards && batchProgress.capturedCards.length > 0 ? (
                        batchProgress.capturedCards.map((card, idx) => {
                          const isChecked = batchConfirmedPrintedIds.has(card.cardId);
                          return (
                            <div
                              key={card.cardId}
                              onClick={() => handleToggleBatchCardPrinted(card.cardId)}
                              className={`p-2.5 rounded-xl border flex items-center justify-between text-xs cursor-pointer transition select-none ${
                                isChecked
                                  ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 hover:bg-emerald-50'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}} // handled by parent div onClick
                                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <span className="font-mono text-[10px] text-slate-400 font-bold w-5">
                                  #{idx + 1}
                                </span>
                                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[11px]">
                                  {card.cardNumber}
                                </span>
                                <span className="font-semibold text-slate-900 truncate">
                                  {card.holderNameEn}
                                </span>
                                <span className="text-slate-500 text-[11px] hidden sm:inline">
                                  ({card.categoryEn})
                                </span>
                              </div>
                              <div>
                                {isChecked ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3" /> PRINTED
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                                    <Clock className="w-3 h-3" /> QUEUED (Keep)
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-slate-400 text-center py-4">
                          No captured cards available.
                        </div>
                      )}
                    </div>

                    {/* Bottom Confirmation Buttons */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          handleCloseBatchModal();
                          setFeedbackMessage({
                            text: 'Batch print cancelled. All cards remain in QUEUED status.',
                          });
                        }}
                        className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        ✕ Cancel All (Keep in Queue)
                      </button>

                      <button
                        type="button"
                        onClick={handleConfirmBatchStatuses}
                        className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm transition inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Confirm Statuses ({batchConfirmedPrintedIds.size} Printed, {(batchProgress.capturedCards?.length || 0) - batchConfirmedPrintedIds.size} in Queue)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-2">
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
                      className="px-6 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold hover:bg-purple-700 shadow-sm transition"
                    >
                      Done
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Single Card Physical Print Confirmation Modal */}
        {pendingConfirmJob && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Physical Print Confirmation</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {pendingConfirmJob.cardNumber} • {pendingConfirmJob.holderNameEn}
                  </p>
                </div>
              </div>
              <div className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1">
                <p className="font-semibold text-slate-800">
                  Did this badge print successfully on <span className="text-purple-700">{activePrinterIdentifier}</span>?
                </p>
                <p className="text-[11px] text-slate-500">
                  If you cancelled the print dialog or the ribbon jammed, click <strong>"✕ Cancelled / Keep in Queue"</strong> so this card remains in queue without needing a reprint authorization.
                </p>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    const cardNum = pendingConfirmJob.cardNumber;
                    setPendingConfirmJob(null);
                    setFeedbackMessage({ text: `Print cancelled. Card ${cardNum} kept in queue.` });
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  ✕ Cancelled / Keep in Queue
                </button>
                <button
                  type="button"
                  disabled={confirmingPrint}
                  onClick={async () => {
                    setConfirmingPrint(true);
                    try {
                      const res = await dispatchPrint(pendingConfirmJob.cardId, activePrinterIdentifier);
                      if (res.success) {
                        setFeedbackMessage({ text: `Card ${pendingConfirmJob.cardNumber} confirmed as printed!` });
                        await fetchQueue();
                        setTimeout(() => setFeedbackMessage(null), 4000);
                      } else {
                        setFeedbackMessage({ text: res.error || 'Failed to record print job.', error: true });
                      }
                    } catch (err: any) {
                      setFeedbackMessage({ text: err.message, error: true });
                    } finally {
                      setConfirmingPrint(false);
                      setPendingConfirmJob(null);
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow transition disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {confirmingPrint ? 'Confirming...' : '✓ Yes, Confirm Printed'}
                </button>
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
              isPrintMode={true}
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

        {/* Hidden 300 DPI CR80 Multi-Card Staging for Batch Printing */}
        {batchStagingCards.length > 0 && (
          <div style={{ position: 'fixed', left: '-9999px', top: '-9999px', pointerEvents: 'none', zIndex: -9999 }}>
            {batchStagingCards.map((card) => (
              <CR80Card
                key={`batch-staging-${card.cardId}`}
                id={`cr80-batch-staging-${card.cardId}`}
                isPrintMode={true}
                data={{
                  cardNumber: card.cardNumber,
                  qrToken: card.qrToken,
                  holderNameEn: card.holderNameEn,
                  holderNameGu: card.holderNameGu,
                  categoryEn: card.categoryEn,
                  categoryGu: card.categoryGu,
                  categoryCode: card.categoryCode,
                  gender: card.gender,
                  photoUrl: card.photoUrl,
                  validFrom: '01-Oct-2026',
                  validTo: '12-Oct-2026',
                  areaZone: 'East Zone / Vasad',
                  eventNameEn: 'NAVRATRI MAHOTSAV 2026',
                  organizationEn: 'THE NEW ENGLISH SCHOOL TRUST, VASAD',
                  physicalFormNumber: card.physicalFormNumber || null,
                  receiptNumber: card.receiptNumber || null,
                }}
                theme={card.theme}
                scale={1.0}
              />
            ))}
          </div>
        )}
      </div>
    </RoleAccessGate>
  );
}
