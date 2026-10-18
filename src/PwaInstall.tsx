import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { isTauri } from '@tauri-apps/api/core'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export default function PwaInstall() {
  const [installed, setInstalled] = useState(isInstalled)
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const handleDisplayModeChange = () => setInstalled(isInstalled())
    const handleBeforeInstallPrompt = (event: BeforeInstallPromptEvent) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    const handleAppInstalled = () => {
      setInstalled(true)
      setInstallPrompt(null)
      setManualOpen(false)
    }

    displayMode.addEventListener('change', handleDisplayModeChange)
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    return () => {
      displayMode.removeEventListener('change', handleDisplayModeChange)
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const install = async () => {
    if (!installPrompt) {
      setManualOpen((open) => !open)
      setFeedback('')
      return
    }

    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      setInstallPrompt(null)
      if (outcome === 'accepted') {
        setInstalled(true)
        setManualOpen(false)
        setFeedback('')
      } else {
        setFeedback('Chưa cài đặt. Bạn có thể thử lại từ menu trình duyệt.')
        setManualOpen(true)
      }
    } catch (error) {
      console.error('Không thể mở lời nhắc cài đặt época.', error)
      setInstallPrompt(null)
      setFeedback('Không thể mở lời nhắc cài đặt. Hãy dùng hướng dẫn bên dưới.')
      setManualOpen(true)
    }
  }

  if (isTauri() || installed) return null

  return (
    <div className="install-action">
      <button
        className="button button-secondary"
        type="button"
        aria-expanded={manualOpen}
        aria-controls="install-help"
        onClick={() => { void install() }}
      >
        <Download size={16} />
        <span>Install época</span>
      </button>
      <div id="install-help" className="install-help" role="region" aria-label="Hướng dẫn cài época" hidden={!manualOpen}>
        <button className="icon-button install-help-close" type="button" aria-label="Đóng hướng dẫn" onClick={() => setManualOpen(false)}><X size={15} /></button>
        <h2>Cài época từ trình duyệt</h2>
        <p><strong>Chrome hoặc Edge trên máy tính:</strong> mở menu trình duyệt rồi chọn “Install época” hoặc “Apps → Install this site as an app”.</p>
        <p><strong>Chrome trên Android:</strong> mở menu ⋮ rồi chọn “Install app” hoặc “Add to Home screen”.</p>
        <p><strong>Safari trên iPhone/iPad:</strong> chọn Chia sẻ → “Thêm vào Màn hình chính”. Firefox và một số trình duyệt không hỗ trợ cài PWA.</p>
        {feedback && <span className="install-feedback" role="status">{feedback}</span>}
      </div>
    </div>
  )
}
