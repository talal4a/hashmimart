import { useCallback, useEffect, useRef, useState } from 'react'

const MAX_DURATION = 120

// `onStop(blob)` (optional) runs whenever a recording finishes — a manual
// stop or the MAX_DURATION auto-stop — but not after cancelRecording.
export default function useVoiceRecorder({ onStop } = {}) {
  const [state, setState] = useState('idle')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)
  const startTimeRef = useRef(null)
  const stopResolversRef = useRef([])
  const cancelledRef = useRef(false)
  const onStopRef = useRef(onStop)

  useEffect(() => {
    onStopRef.current = onStop
  }, [onStop])

  const buildBlob = useCallback(() => {
    if (chunksRef.current.length === 0) return null
    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
    return new Blob(chunksRef.current, { type: mimeType })
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  // Resolves with the finished recording once the recorder has flushed its
  // last chunk (the final dataavailable fires after stop(), so reading the
  // blob synchronously can miss the tail). Callers that don't need the blob
  // can ignore the returned promise.
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const recorder = mediaRecorderRef.current
    const done = new Promise((resolve) => {
      if (recorder && recorder.state !== 'inactive') {
        stopResolversRef.current.push(resolve)
        recorder.stop()
      } else {
        resolve(buildBlob())
      }
    })
    setState('stopped')
    return done
  }, [buildBlob])

  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    cancelledRef.current = true
    stopResolversRef.current.splice(0).forEach((resolve) => resolve(null))
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    chunksRef.current = []
    setDuration(0)
    setState('idle')
    setError(null)
  }, [])

  useEffect(() => {
    if (state !== 'recording' || !startTimeRef.current) return
    const tid = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setDuration(elapsed)
      if (elapsed >= MAX_DURATION) {
        stopRecording()
      }
    }, 200)
    timerRef.current = tid
    return () => clearInterval(tid)
  }, [state, stopRecording])

  const startRecording = useCallback(async () => {
    setError(null)
    setDuration(0)
    chunksRef.current = []
    cancelledRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = recorder

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
        if (cancelledRef.current) return
        const blob = buildBlob()
        stopResolversRef.current.splice(0).forEach((resolve) => resolve(blob))
        onStopRef.current?.(blob)
      }

      recorder.onerror = () => {
        setError('Recording failed')
        setState('idle')
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
      }

      recorder.start(250)
      startTimeRef.current = Date.now()
      setState('recording')
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Microphone permission denied')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found')
      } else {
        setError(err.message || 'Failed to start recording')
      }
      setState('error')
    }
  }, [buildBlob])

  const getBlob = buildBlob

  const formatDuration = useCallback((sec) => {
    const safe = Math.max(0, sec ?? 0)
    const m = Math.floor(safe / 60)
    const s = safe % 60
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }, [])

  return {
    state,
    duration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
    getBlob,
    formatDuration,
  }
}
