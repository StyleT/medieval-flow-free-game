import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { createWebAudioPlayer } from './audio/audioEngine.ts'
import { applyPixelScale } from './ui/pixel/pixelScale.ts'
import './index.css'

const audio = createWebAudioPlayer()

// Keep one art pixel a whole number of device pixels (retina / HiDPI), also after zoom or window moves.
const updateScale = () => applyPixelScale(document.documentElement, window)
updateScale()
window.addEventListener('resize', updateScale)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App audio={audio} />
  </StrictMode>,
)
