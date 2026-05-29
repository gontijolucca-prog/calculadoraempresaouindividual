/**
 * Toast notification for app updates
 * Shows when a new version is available
 * Provides manual reload button if unsaved edits exist
 */

import {X} from 'lucide-react';
import {useEffect, useState} from 'react';
import {manualReload} from '../lib/version-checker';

interface UpdateNotificationProps {
  show: boolean;
  hasUnsavedEdits: boolean;
  onDismiss: () => void;
}

export function UpdateNotification({
  show,
  hasUnsavedEdits,
  onDismiss,
}: UpdateNotificationProps) {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);
  }, [show]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 rounded-lg border border-[#0677FF] bg-white/95 shadow-xl backdrop-blur-sm"
      role="alert"
      aria-live="polite"
    >
      <div className="p-4 max-w-sm">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1">
            <h3 className="font-semibold text-[#0B1D2D]">Nova versão disponível</h3>
            <p className="text-sm text-[#525C66] mt-1">
              {hasUnsavedEdits
                ? 'Termina as tuas edições e recarrega para obter as atualizações.'
                : 'Atualizando para a versão mais recente...'}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="text-[#525C66] hover:text-[#0B1D2D] transition-colors"
            aria-label="Fechar notificação"
          >
            <X size={18} />
          </button>
        </div>

        {hasUnsavedEdits && (
          <button
            onClick={() => {
              manualReload();
            }}
            className="w-full mt-3 px-3 py-2 rounded bg-[#0677FF] text-white text-sm font-medium hover:bg-[#0B5BC4] transition-colors"
          >
            Recarregar agora
          </button>
        )}
      </div>
    </div>
  );
}
