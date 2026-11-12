import { useEffect, useState } from 'react'
import { artUrl } from '../art/manifest.ts'
import { ART } from '../art/manifest.ts'
import { SCENES, SCENE_H, SCENE_W, coverScale } from './sceneLayout.ts'
import type { SceneName } from './sceneLayout.ts'

const viewport = () => ({ w: window.innerWidth, h: window.innerHeight })

/** Fixed pixel-art backdrop, scaled by an integer, with torches, banners and drifting clouds. */
export function SceneBackground({ scene, dim = false }: { scene: SceneName; dim?: boolean }) {
  const [size, setSize] = useState(viewport)
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const onResize = () => setSize(viewport())
    const onVisibility = () => setHidden(document.visibilityState === 'hidden')
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const spec = SCENES[scene]
  const scale = coverScale(size.w, size.h)
  return (
    <div
      aria-hidden="true"
      data-testid="scene"
      data-scene={scene}
      className={`scene${hidden ? ' scene--paused' : ''}${dim ? ' scene--dim' : ''}`}
    >
      <div className="scene-box" style={{ width: SCENE_W, height: SCENE_H, transform: `translate(-50%, -50%) scale(${scale})` }}>
        <img className="scene-art" src={artUrl(spec.art)} alt="" draggable={false} width={SCENE_W} height={SCENE_H} />
        {spec.cloudsY !== null && (
          <div className="scene-clouds" style={{ top: spec.cloudsY, backgroundImage: `url(${artUrl('clouds')})` }} />
        )}
        {spec.overlays.map((o, i) => {
          const { w, h, frames = 1 } = ART[o.sprite] as { w: number; h: number; frames?: number }
          return (
            <span
              key={i}
              className="scene-sprite"
              data-sprite={o.sprite}
              style={{
                left: o.x,
                top: o.y,
                width: w,
                height: h,
                backgroundImage: `url(${artUrl(o.sprite)})`,
                '--frames': frames,
                '--fw': w,
                '--dur': `${frames / (o.sprite === 'torch' ? 8 : 6)}s`,
                animationDelay: `${-(i * 130)}ms`,
              } as React.CSSProperties}
            />
          )
        })}
      </div>
    </div>
  )
}
