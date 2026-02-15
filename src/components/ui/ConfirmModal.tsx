import { motion } from 'framer-motion'

interface ConfirmModalProps {
  title: string
  message: string
  detail?: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export function ConfirmModal({
  title,
  message,
  detail,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmModalProps) {
  return (
    <motion.div
      className="fixed inset-0 bg-black/70 z-[300] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div
        className="w-full max-w-[340px] bg-card border border-border-elevated rounded-xl p-5 mx-4 shadow-modal"
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className={`text-[14px] font-bold mb-2 ${danger ? 'text-danger' : 'text-accent'}`}>
          {title}
        </div>
        <div className="text-[12px] text-text mb-1">{message}</div>
        {detail && <div className="text-[11px] text-muted mb-3">{detail}</div>}
        {!detail && <div className="mb-3" />}
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 min-h-[44px] border-none rounded-lg cursor-pointer text-white text-[13px] font-semibold ${
              danger ? 'bg-danger' : 'bg-[#238636]'
            }`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2.5 min-h-[44px] border border-border-elevated rounded-lg cursor-pointer bg-transparent text-muted text-[13px]"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
