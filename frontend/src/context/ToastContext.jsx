import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const COLORS = {
  success: 'border-green-500/40 bg-green-500/10 text-green-400',
  error: 'border-red-500/40 bg-red-500/10 text-red-400',
  info: 'border-accent-blue/40 bg-accent-blue/10 text-accent-blue',
}

function Toast({ toast, onDismiss }) {
  const Icon = ICONS[toast.type] ?? Info
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg animate-slide-up ${COLORS[toast.type] ?? COLORS.info}`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="flex-1 text-sm">{toast.message}</p>
      <button onClick={() => onDismiss(toast.id)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++idRef.current
    setToasts(prev => [...prev, { id, message, type }])
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration)
    }
    return id
  }, [dismiss])

  const toast = useCallback({
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur ?? 6000),
    info: (msg, dur) => addToast(msg, 'info', dur),
  }, [addToast])

  // Make toast callable as toast.success / toast.error / toast.info
  // but also as toast(msg) for plain info
  const api = Object.assign((msg, type, dur) => addToast(msg, type, dur), toast)

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Toast container — fixed bottom-right */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 w-80 pointer-events-auto">
          {toasts.map(t => (
            <Toast key={t.id} toast={t} onDismiss={dismiss} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
