import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useVoiceRecorder from '../hooks/useVoiceRecorder'
import { uploadSupportVoice, sendSupportMessage } from '../lib/supportChat'
import { IconMic } from '../components/Icons'

// Urdu, Arabic and Persian ranges — used to switch a bubble to RTL so Urdu
// script renders correctly. Roman Urdu stays LTR, which is what we want.
// Written as escapes: the literal characters include an Arabic space that
// trips ESLint's no-irregular-whitespace.
const RTL_PATTERN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/

function isRtl(text) {
  return RTL_PATTERN.test(text || '')
}

const GREETING =
  'Assalam-o-Alaikum! Hashmi Mart support here. Aap apna sawal likh sakte hain ya voice note bhej sakte hain — Urdu, Roman Urdu ya English, jo bhi aasan ho.'

let idCounter = 0
function nextId(prefix) {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

export default function SupportChatPage() {
  const [messages, setMessages] = useState(() => [
    {
      id: 'bot-greeting',
      sender: 'bot',
      type: 'text',
      content: GREETING,
      time: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)
  // Object URLs for local playback of the user's own voice notes. Revoked on
  // unmount so recordings don't leak for the life of the session.
  const objectUrlsRef = useRef([])

  const {
    state: voiceState,
    duration: voiceDuration,
    error: voiceError,
    startRecording,
    stopRecording,
    cancelRecording,
    getBlob,
    formatDuration,
  } = useVoiceRecorder()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    const urls = objectUrlsRef.current
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [])

  // Only real text turns go to the model. Voice bubbles contribute their
  // transcript, which is what the assistant actually "heard".
  const buildHistory = useCallback(
    (list) =>
      list
        .filter((m) => m.id !== 'bot-greeting')
        .map((m) => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.type === 'voice' ? m.transcript || '' : m.content || '',
        }))
        .filter((m) => m.content),
    [],
  )

  const ask = useCallback(
    async (payload, optimistic) => {
      setError('')
      setSending(true)
      const history = buildHistory(messages)
      setMessages((prev) => [...prev, optimistic])

      try {
        const { reply, transcript } = await sendSupportMessage({
          ...payload,
          history,
        })

        setMessages((prev) => {
          const next = transcript
            ? prev.map((m) =>
                m.id === optimistic.id ? { ...m, transcript } : m,
              )
            : prev
          return [
            ...next,
            {
              id: nextId('bot'),
              sender: 'bot',
              type: 'text',
              content: reply,
              time: new Date(),
            },
          ]
        })
      } catch (err) {
        setError(err.message || 'Could not reach support. Please try again.')
        // Mark the sent bubble as failed rather than silently dropping it.
        setMessages((prev) =>
          prev.map((m) =>
            m.id === optimistic.id ? { ...m, failed: true } : m,
          ),
        )
      } finally {
        setSending(false)
      }
    },
    [messages, buildHistory],
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || sending) return
    setInput('')
    ask(
      { message: trimmed },
      {
        id: nextId('user'),
        sender: 'user',
        type: 'text',
        content: trimmed,
        time: new Date(),
      },
    )
  }

  const handleStopVoice = async () => {
    stopRecording()
    // MediaRecorder flushes its last chunk asynchronously; give it a tick so
    // getBlob() doesn't miss the tail of the recording.
    await new Promise((r) => setTimeout(r, 250))
    const blob = getBlob()
    cancelRecording()
    if (!blob || blob.size === 0) {
      setError('Nothing was recorded. Please try again.')
      return
    }

    const url = URL.createObjectURL(blob)
    objectUrlsRef.current.push(url)
    const optimistic = {
      id: nextId('user'),
      sender: 'user',
      type: 'voice',
      audioUrl: url,
      transcript: '',
      time: new Date(),
    }

    setError('')
    setSending(true)
    setMessages((prev) => [...prev, optimistic])
    const history = buildHistory(messages)

    try {
      const audioPath = await uploadSupportVoice(blob)
      const { reply, transcript } = await sendSupportMessage({
        audioPath,
        history,
      })
      setMessages((prev) => [
        ...prev.map((m) =>
          m.id === optimistic.id ? { ...m, transcript } : m,
        ),
        {
          id: nextId('bot'),
          sender: 'bot',
          type: 'text',
          content: reply,
          time: new Date(),
        },
      ])
    } catch (err) {
      setError(err.message || 'Could not send the voice note. Please try again.')
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? { ...m, failed: true } : m)),
      )
    } finally {
      setSending(false)
    }
  }

  const recording = voiceState === 'recording'
  const canSend = useMemo(() => input.trim() && !sending, [input, sending])

  return (
    <div className="support-chat-page">
      <div className="chat-topbar">
        <div className="chat-topbar-info">
          <h2>Hashmi Support</h2>
          <span className="chat-timestamp">
            AI assistant · Urdu, Roman Urdu &amp; English
          </span>
          <div className="chat-online">
            <span className="chat-online-dot" />
            <span>Online</span>
          </div>
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`chat-bubble ${
              msg.sender === 'user' ? 'chat-bubble--own' : 'chat-bubble--other'
            }`}
          >
            {msg.type === 'voice' ? (
              <>
                <audio
                  controls
                  src={msg.audioUrl}
                  style={{ width: '200px', height: '40px' }}
                />
                {msg.transcript && (
                  <div
                    className="chat-bubble-text"
                    dir={isRtl(msg.transcript) ? 'rtl' : 'ltr'}
                    style={{ marginTop: '0.4rem', fontStyle: 'italic', opacity: 0.85 }}
                  >
                    {msg.transcript}
                  </div>
                )}
              </>
            ) : (
              <div
                className="chat-bubble-text"
                dir={isRtl(msg.content) ? 'rtl' : 'ltr'}
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {msg.content}
              </div>
            )}
            <div className="chat-bubble-meta">
              <span className="chat-bubble-time">
                {msg.time.toLocaleTimeString('en-PK', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {msg.failed && (
                <span style={{ color: '#ef4444', marginLeft: '0.4rem' }}>
                  Not delivered
                </span>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="chat-bubble chat-bubble--other">
            <div className="chat-bubble-text" style={{ opacity: 0.7 }}>
              Typing…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {(error || voiceError) && (
        <div
          className="field-error"
          style={{ padding: '0.5rem 1rem', textAlign: 'center' }}
        >
          {error || voiceError}
        </div>
      )}

      <div className="chat-input-area">
        {recording ? (
          <div className="chat-voice-recording">
            <span className="chat-voice-recording-indicator" />
            <span className="chat-voice-recording-label">
              {formatDuration(voiceDuration)}
            </span>
            <button
              type="button"
              className="chat-voice-btn chat-voice-btn--stop"
              onClick={handleStopVoice}
              aria-label="Send recording"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
            <button
              type="button"
              className="chat-voice-btn chat-voice-btn--cancel"
              onClick={cancelRecording}
              aria-label="Cancel recording"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <form className="chat-input-wrapper" onSubmit={handleSubmit}>
            <input
              type="text"
              className="chat-input"
              style={{ flex: 1 }}
              placeholder="Message likhein ya voice note bhejein..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sending}
            />
            {/* Both options stay available: the mic is always shown so a voice
                note is one tap away, and Send appears once there is text. */}
            <button
              type="button"
              className="chat-send-btn"
              onClick={startRecording}
              disabled={sending}
              title="Record a voice note"
              aria-label="Record voice message"
            >
              <IconMic size={20} />
            </button>
            {input.trim() && (
              <button type="submit" className="chat-send-btn" disabled={!canSend}>
                Send
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
