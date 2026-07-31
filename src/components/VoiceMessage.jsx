import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

let currentPlayingRef = null

const LOADING_TIMEOUT = 10000

export default function VoiceMessage({ voiceUrl, duration: propDuration, isOwn, onRemove }) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const audioRef = useRef(null)
  const animFrameRef = useRef(null)
  const mountedRef = useRef(true)
  const signedUrlRef = useRef(null)
  const loadingTimerRef = useRef(null)
  const removedRef = useRef(false)

  const triggerRemove = useCallback(() => {
    if (removedRef.current) return
    removedRef.current = true
    if (onRemove) onRemove(voiceUrl)
  }, [onRemove, voiceUrl])

  useEffect(() => {
    const audio = audioRef.current
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (audio) {
        audio.pause()
        audio.src = ''
        audio.load()
      }
    }
  }, [])

  // Loading timeout: if loading stays true for too long, remove
  useEffect(() => {
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current)
      loadingTimerRef.current = null
    }
    if (!loading) return
    loadingTimerRef.current = setTimeout(() => {
      if (mountedRef.current && loading) {
        triggerRemove()
      }
    }, LOADING_TIMEOUT)
    return () => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current)
        loadingTimerRef.current = null
      }
    }
  }, [loading, triggerRemove])

  const getAudioUrl = useCallback(async () => {
    if (signedUrlRef.current) return signedUrlRef.current

    setLoading(true)

    const { data, error: signedErr } = await supabase.storage
      .from('chat-voice')
      .createSignedUrl(voiceUrl, 3600)

    if (!mountedRef.current) return null

    if (signedErr) {
      triggerRemove()
      return null
    }

    if (!data?.signedUrl) {
      triggerRemove()
      return null
    }

    signedUrlRef.current = data.signedUrl
    setReady(false)
    return data.signedUrl
  }, [voiceUrl, triggerRemove])

  const stopCurrent = useCallback(() => {
    if (currentPlayingRef && currentPlayingRef !== audioRef.current) {
      currentPlayingRef.pause()
      currentPlayingRef.currentTime = 0
    }
  }, [])

  const toggle = useCallback(async () => {
    if (!audioRef.current) return

    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      return
    }

    const signedUrl = await getAudioUrl()
    if (!signedUrl) return
    if (!mountedRef.current) return

    const audio = audioRef.current

    audio.src = signedUrl

    const clearHandlers = () => {
      audio.onerror = null
      audio.onloadedmetadata = null
      audio.oncanplay = null
      audio.onplaying = null
      audio.onended = null
    }

    clearHandlers()

    audio.onloadedmetadata = () => {
      setLoading(false)
      setReady(true)
    }

    audio.oncanplay = () => {
      setLoading(false)
      setReady(true)
    }

    audio.onplaying = () => {
      setLoading(false)
      setReady(true)
    }

    audio.onended = () => {
      if (mountedRef.current) {
        setPlaying(false)
        setCurrentTime(0)
      }
      currentPlayingRef = null
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }

    audio.onerror = () => {
      if (mountedRef.current) {
        triggerRemove()
      }
    }

    audio.load()

    stopCurrent()
    currentPlayingRef = audio

    try {
      await audio.play()
      setPlaying(true)

      const updateProgress = () => {
        if (!audioRef.current || !mountedRef.current) return
        setCurrentTime(audioRef.current.currentTime)
        animFrameRef.current = requestAnimationFrame(updateProgress)
      }
      animFrameRef.current = requestAnimationFrame(updateProgress)
    } catch {
      if (mountedRef.current) {
        triggerRemove()
      }
    }
  }, [playing, getAudioUrl, stopCurrent, triggerRemove])

  const formatTime = (sec) => {
    const safe = Math.max(0, sec || 0)
    const m = Math.floor(safe / 60)
    const s = Math.floor(safe % 60)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }

  const displayDuration = propDuration > 0 ? propDuration : 0
  const progress = displayDuration > 0 ? (currentTime / displayDuration) * 100 : 0

  return (
    <button
      type="button"
      className={`voice-message ${isOwn ? 'voice-message--own' : ''} ${playing ? 'voice-message--playing' : ''}`}
      onClick={toggle}
      disabled={loading && !ready}
      aria-label={playing ? 'Pause voice message' : 'Play voice message'}
    >
      {loading && !ready ? (
        <span className="voice-message__spinner" aria-hidden="true" />
      ) : (
        <svg className="voice-message__icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          {playing ? (
            <>
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </>
          ) : (
            <polygon points="8,5 19,12 8,19" />
          )}
        </svg>
      )}
      <div className="voice-message__track">
        <div className="voice-message__progress" style={{ width: `${progress}%` }} />
      </div>
      <span className="voice-message__duration">
        {loading && !ready ? '...' : formatTime(playing ? currentTime : displayDuration)}
      </span>
      <audio key={voiceUrl} ref={audioRef} preload="none" />
    </button>
  )
}
