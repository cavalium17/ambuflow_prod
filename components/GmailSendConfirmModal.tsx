import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  X,
  FileText,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye
} from 'lucide-react';
import { BuiltMonthlyPdfReport, formatMinutesLabel } from '../src/lib/pdfExport';
import {
  authorizeGmailAccess,
  hasGmailAccessToken,
  sendMonthlyPdfViaGmail
} from '../src/services/gmailService';

interface GmailSendConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: BuiltMonthlyPdfReport | null;
  defaultRecipient?: string | null;
  isAutoMonthlyTrigger?: boolean;
  darkMode?: boolean;
  onPreviewPdf?: () => void;
  onSentSuccess: (details: {
    monthKey: string;
    recipient: string;
    messageId: string;
  }) => void;
  onSentError?: (monthKey: string, errorMessage: string) => void;
}

export const GmailSendConfirmModal: React.FC<GmailSendConfirmModalProps> = ({
  isOpen,
  onClose,
  report,
  defaultRecipient,
  isAutoMonthlyTrigger = false,
  darkMode = false,
  onPreviewPdf,
  onSentSuccess,
  onSentError
}) => {
  const [recipient, setRecipient] = useState(defaultRecipient || '');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sentDone, setSentDone] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(hasGmailAccessToken());

  useEffect(() => {
    if (isOpen) {
      setRecipient(defaultRecipient || '');
      setErrorMsg(null);
      setSentDone(false);
      setGmailConnected(hasGmailAccessToken());
    }
  }, [isOpen, defaultRecipient, report?.monthKey]);

  if (!isOpen || !report) return null;

  const subject = `AmbuFlow - Rapport mensuel des heures travaillées (${report.monthTitle})`;
  const bodyText = [
    `Bonjour,`,
    '',
    `Veuillez trouver en pièce jointe votre rapport mensuel d'heures travaillées AmbuFlow pour ${report.monthTitle} (${report.periodStartLabel} au ${report.periodEndLabel}).`,
    '',
    `Synthèse du mois :`,
    `- Total effectif : ${formatMinutesLabel(report.summary.totalEffectiveMinutes)}`,
    `- Travail réel : ${formatMinutesLabel(report.summary.totalWorkedOnlyMinutes)} (${report.summary.workShiftCount} garde(s))`,
    `- Pauses déduites : ${formatMinutesLabel(report.summary.totalBreakDeductedMinutes)} (${report.summary.totalBreakCount} pause(s))`,
    `- Congés & jours fériés : ${report.summary.cpDaysCount} CP, ${report.summary.ferieDaysCount} Férié(s)`,
    '',
    `Document généré pour archivage externe et impression.`,
    `AmbuFlow`
  ].join('\n');

  const handleConfirmAndSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;

    const cleanRecipient = recipient.trim();
    if (!cleanRecipient || !cleanRecipient.includes('@')) {
      setErrorMsg('Veuillez saisir une adresse e-mail valide.');
      return;
    }

    setSending(true);
    setErrorMsg(null);

    try {
      if (!hasGmailAccessToken()) {
        const authResult = await authorizeGmailAccess(cleanRecipient);
        setGmailConnected(Boolean(authResult.accessToken));
      }

      const sendAttempt = async () => {
        return sendMonthlyPdfViaGmail({
          to: cleanRecipient,
          subject,
          bodyText,
          fileName: report.fileName,
          pdfBase64: report.base64
        });
      };

      let result;
      try {
        result = await sendAttempt();
      } catch (err: any) {
        if (err?.message === 'GMAIL_AUTH_REQUIRED') {
          const authResult = await authorizeGmailAccess(cleanRecipient);
          setGmailConnected(Boolean(authResult.accessToken));
          result = await sendAttempt();
        } else {
          throw err;
        }
      }

      setSentDone(true);
      onSentSuccess({
        monthKey: report.monthKey,
        recipient: cleanRecipient,
        messageId: result.messageId
      });
    } catch (err: any) {
      let friendly = err?.message || "Échec de l'envoi via Gmail.";
      if (err?.code === 'auth/popup-closed-by-user') {
        friendly = "Autorisation Gmail annulée. Vous pouvez réessayer à tout moment depuis l'onglet Agenda.";
      } else if (err?.code === 'auth/popup-blocked') {
        friendly = 'La fenêtre de connexion Google a été bloquée par votre navigateur. Veuillez autoriser les popups pour ce site.';
      }
      setErrorMsg(friendly);
      onSentError?.(report.monthKey, friendly);
    } finally {
      setSending(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !sending && onClose()}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          className={`relative w-full max-w-md rounded-[28px] border p-6 shadow-2xl ${
            darkMode
              ? 'bg-slate-900 border-white/10 text-white'
              : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-600/15 text-indigo-500 flex items-center justify-center shrink-0">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight leading-tight">
                  {isAutoMonthlyTrigger ? 'Rapport mensuel du 1er du mois' : 'Envoyer le PDF par Gmail'}
                </h3>
                <p className={`text-xs mt-0.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {report.monthTitle} · Confirmation avant envoi
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={sending}
              onClick={onClose}
              aria-label="Fermer"
              className={`w-8 h-8 rounded-xl border flex items-center justify-center transition-all ${
                darkMode
                  ? 'border-white/10 text-slate-400 hover:text-white'
                  : 'border-slate-200 text-slate-500 hover:text-slate-900'
              }`}
            >
              <X size={15} />
            </button>
          </div>

          {sentDone ? (
            <div className="py-4 space-y-4 text-center">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 size={28} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black">Rapport PDF envoyé avec succès</p>
                <p className={`text-xs ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Le fichier <span className="font-semibold">{report.fileName}</span> a été transmis à{' '}
                  <span className="font-semibold text-indigo-500">{recipient}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all"
              >
                Fermer
              </button>
            </div>
          ) : (
            <form onSubmit={handleConfirmAndSend} className="space-y-4">
              {/* Attachment summary card */}
              <div
                className={`p-3.5 rounded-2xl border space-y-2 ${
                  darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={16} className="text-indigo-500 shrink-0" />
                    <span className="text-xs font-bold truncate">{report.fileName}</span>
                  </div>
                  {onPreviewPdf && (
                    <button
                      type="button"
                      onClick={onPreviewPdf}
                      className="text-xs font-bold text-indigo-500 hover:underline flex items-center gap-1 shrink-0"
                    >
                      <Eye size={13} />
                      <span>Voir</span>
                    </button>
                  )}
                </div>
                <p className={`text-[11px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Total effectif : <strong>{formatMinutesLabel(report.summary.totalEffectiveMinutes)}</strong> ·{' '}
                  {report.summary.workShiftCount} garde(s) · {report.summary.totalBreakCount} pause(s)
                </p>
              </div>

              {/* Recipient input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="gmail-recipient-input"
                  className={`block text-xs font-bold ${darkMode ? 'text-slate-300' : 'text-slate-700'}`}
                >
                  Adresse e-mail de réception
                </label>
                <input
                  id="gmail-recipient-input"
                  type="email"
                  required
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="prenom.nom@gmail.com"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-semibold outline-none transition-all ${
                    darkMode
                      ? 'bg-slate-950 border-white/10 text-white focus:border-indigo-500'
                      : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500'
                  }`}
                />
              </div>

              <div
                className={`p-3 rounded-xl text-[11px] leading-relaxed ${
                  darkMode ? 'bg-indigo-500/10 text-indigo-200' : 'bg-indigo-50 text-indigo-900'
                }`}
              >
                <p className="font-bold">Objet : {subject}</p>
                <p className="mt-1 opacity-80">
                  {gmailConnected
                    ? 'Votre session Gmail est prête. Confirmez pour envoyer ce rapport PDF en pièce jointe.'
                    : 'Une confirmation Google Gmail sera demandée pour autoriser l’envoi de ce rapport PDF vers votre boîte mail.'}
                </p>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-semibold flex items-start gap-2">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={sending}
                  onClick={onClose}
                  className={`flex-1 min-h-[44px] py-2.5 px-4 rounded-2xl text-xs font-bold transition-all ${
                    darkMode
                      ? 'bg-white/5 text-slate-300 hover:bg-white/10'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  Plus tard
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="flex-[1.5] min-h-[44px] py-2.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-60"
                >
                  {sending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Envoi en cours...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>{gmailConnected ? 'Confirmer et envoyer' : 'Autoriser Gmail et envoyer'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
