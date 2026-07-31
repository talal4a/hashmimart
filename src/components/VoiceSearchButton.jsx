import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IconMic } from './Icons'
import useVoiceRecorder from '../hooks/useVoiceRecorder'
import { useStore } from '../context/StoreContext'
import { uploadVoiceSearch, searchByVoice } from '../lib/voiceSearch'

// Floating voice-search button for the storefront. Tap → record an order in
// Urdu / English / Roman Urdu → the backend transcribes it and finds the best
// matching product → we add it to the cart and head to checkout. On no match
// (or any error) we stay put and show a toast so the shopper can retry.
export default function VoiceSearchButton() {
  const navigate = useNavigate()
  const location = useLocation()
  const { addToCart } = useStore()
  const {
    state,
    duration,
    error,
    startRecording,
    stopRecording,
    getBlob,
    formatDuration,
  } = useVoiceRecorder()

  // 'processing' covers upload → transcription → matching. Toast holds the
  // last user-facing message; { type, text } where type is success|error|info.
  const [processing, setProcessing] = useState(false)
  const [toast, setToast] = useState(null)
  const redirectRef = useRef(null)

  const showToast = useCallback((type, text) => {
    setToast({ type, text })
  }, [])

  // Auto-dismiss the toast (except while a redirect is pending).
  useEffect(() => {
    if (!toast || toast.type === 'success') return
    const id = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(id)
  }, [toast])

  useEffect(() => {
    return () => {
      if (redirectRef.current) clearTimeout(redirectRef.current)
    }
  }, [])

  // Surface recorder-level failures (mic denied / no device).
  useEffect(() => {
    if (state === 'error' && error) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      showToast('error', error)
    }
  }, [state, error, showToast])

  const runSearch = useCallback(async () => {
    const blob = getBlob()
    if (!blob || blob.size === 0) {
      showToast('error', "Didn't catch that — please try again.")
      return
    }

    setProcessing(true)
    try {
      const path = await uploadVoiceSearch(blob)
      const { transcript, product } = await searchByVoice(path)

      if (product) {
        addToCart(product)
        showToast('success', `Found ${product.name}! Redirecting to checkout…`)
        redirectRef.current = setTimeout(() => {
          setToast(null)
          navigate('/checkout')
        }, 1200)
      } else if (transcript) {
        showToast('info', `Couldn't find a match for: "${transcript}"`)
      } else {
        showToast('error', "Didn't catch that — please try again.")
      }
    } catch (err) {
      showToast('error', err.message || 'Voice search failed. Please try again.')
    } finally {
      setProcessing(false)
    }
  }, [getBlob, addToCart, navigate, showToast])

  const handleClick = useCallback(() => {
    if (processing) return
    if (state === 'recording') {
      stopRecording()
      // Recorder flushes on the next tick; give it a beat before reading blob.
      setTimeout(runSearch, 300)
    } else {
      setToast(null)
      startRecording()
    }
  }, [processing, state, stopRecording, startRecording, runSearch])

  const isRecording = state === 'recording'
  const busy = processing

  // Storefront only — the admin panel has its own chrome.
  if (location.pathname.startsWith('/admin')) return null

  let label = 'Search by voice'
  if (isRecording) label = 'Stop recording'
  else if (busy) label = 'Finding your product'

  return (
    <>
      {toast && (
        <div
          className={`voice-search-toast voice-search-toast--${toast.type}`}
          role="status"
          aria-live="polite"
        >
          {toast.text}
        </div>
      )}

      <button
        type="button"
        className={`voice-search-fab ${isRecording ? 'voice-search-fab--recording' : ''} ${busy ? 'voice-search-fab--busy' : ''}`}
        onClick={handleClick}
        aria-label={label}
        title={label}
        disabled={busy}
      >
        {busy ? (
          <span className="voice-search-spinner" aria-hidden="true" />
        ) : (
          <IconMic size={24} />
        )}
        {isRecording && (
          <span className="voice-search-timer" aria-hidden="true">
            {formatDuration(duration)}
          </span>
        )}
      </button>
    </>
  )
}
