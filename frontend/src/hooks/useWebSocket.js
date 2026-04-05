import { useEffect, useRef, useState, useCallback } from 'react'

const MAX_RETRIES = 10
const RETRY_DELAY_MS = 3000

export function useWebSocket(asset) {
  const [data, setData]       = useState(null)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const retriesRef = useRef(0)

  const connect = useCallback(() => {
    if (!asset) return
    if (retriesRef.current >= MAX_RETRIES) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const url   = `${proto}://${window.location.host}/ws/prices/${asset}`
    const ws    = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      retriesRef.current = 0
    }
    ws.onclose = () => {
      setConnected(false)
      retriesRef.current += 1
      if (retriesRef.current < MAX_RETRIES) {
        setTimeout(connect, RETRY_DELAY_MS)
      }
    }
    ws.onerror   = () => ws.close()
    ws.onmessage = (e) => {
      try { const msg = JSON.parse(e.data); if (msg.type === 'price_update') setData(msg) }
      catch {}
    }
  }, [asset])

  useEffect(() => {
    retriesRef.current = 0
    connect()
    return () => { wsRef.current?.close() }
  }, [connect])

  return { data, connected }
}
