// A body weight or a working weight, typed or picked: the +/- buttons and the read-out cover
// exact values, the slider is the coarse pick (a 1 kg step is coarser precision per pixel).
// The ceiling follows the profile's unit: 300 covers a body weight or a working weight in kg,
// but as pounds it cut off at 136 kg, below plenty of people's body weight and well below an
// everyday squat.
import Icon from './Icon.jsx'
import { NumberField, Slider } from './ui.jsx'
import { fmtNum } from '../lib/format.js'
import { t } from '../lib/i18n.js'

const W_LO = 1
const wHi = unit => (unit === 'lb' ? 660 : 300)

export default function WeightInput({ value, setValue, unit }) {
  const W_HI = wHi(unit)
  const clamp = x => Math.max(W_LO, Math.min(W_HI, Math.round((x || 0) * 10) / 10))
  const sv = Math.max(W_LO, Math.min(W_HI, value))
  const onSlide = v => setValue(clamp(v))
  const onType = v => setValue(v)

  return <>
    <div className="bwstep">
      <button className="bw-pm" onClick={() => onSlide(value - 0.1)} aria-label={t('Decrease by {0}', fmtNum(0.1))}><Icon name="minus" /></button>
      <label className="bw-read">
        <NumberField fit value={value} onChange={onType} aria-label={t('Weight ({0})', unit)} enterKeyHint="done"
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
        <span className="u"> {unit}</span>
      </label>
      <button className="bw-pm" onClick={() => onSlide(value + 0.1)} aria-label={t('Increase by {0}', fmtNum(0.1))}><Icon name="plus" /></button>
    </div>
    <div className="chips fit" style={{ justifyContent: 'center', margin: '8px 0' }}>
      <button className="chip" onClick={() => onSlide(value - 1)}>−1</button>
      <button className="chip" onClick={() => onSlide(value - 0.5)}>−{fmtNum(0.5)}</button>
      <button className="chip" onClick={() => onSlide(value + 0.5)}>+{fmtNum(0.5)}</button>
      <button className="chip" onClick={() => onSlide(value + 1)}>+1</button>
    </div>
    <Slider value={sv} min={W_LO} max={W_HI} step={0.5} onChange={onSlide} ariaLabel={t('Weight ({0})', unit)} />
  </>
}
