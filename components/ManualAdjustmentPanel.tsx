/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

export interface ManualAdjustments {
  temperature: number;
  tint: number;
  exposure: number;
  contrast: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  clarity: number;
  vibrance: number;
  saturation: number;
}

export const defaultAdjustments: ManualAdjustments = {
  temperature: 0,
  tint: 0,
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  clarity: 0,
  vibrance: 0,
  saturation: 0,
};

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onDoubleClick: () => void;
  disabled: boolean;
}

const AdjustmentSlider: React.FC<SliderProps> = ({ label, value, min, max, step = 1, onChange, onDoubleClick, disabled }) => (
  <div className="grid grid-cols-5 items-center gap-2 px-2">
    <label onDoubleClick={onDoubleClick} className="col-span-2 text-sm text-gray-400 cursor-pointer select-none" title="Double click to reset">{label}</label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onDoubleClick={onDoubleClick}
      disabled={disabled}
      className="col-span-2 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer range-sm"
    />
    <span className="col-span-1 text-sm text-gray-200 font-mono text-right">{value.toFixed(value % 1 !== 0 ? 2 : 0)}</span>
  </div>
);


interface ManualAdjustmentPanelProps {
  adjustments: ManualAdjustments;
  onAdjustmentChange: (adjustments: ManualAdjustments) => void;
  onApply: () => void;
  onReset: () => void;
  isLoading: boolean;
}

const ManualAdjustmentPanel: React.FC<ManualAdjustmentPanelProps> = ({ adjustments, onAdjustmentChange, onApply, onReset, isLoading }) => {
  const handleSliderChange = (key: keyof ManualAdjustments, value: number) => {
    onAdjustmentChange({ ...adjustments, [key]: value });
  };
  
  const handleResetSlider = (key: keyof ManualAdjustments) => {
    onAdjustmentChange({ ...adjustments, [key]: defaultAdjustments[key] });
  };
  
  const hasChanges = JSON.stringify(adjustments) !== JSON.stringify(defaultAdjustments);

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
        <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-300">Manual Adjustments</h3>
            <button onClick={onReset} disabled={isLoading || !hasChanges} className="text-sm text-blue-400 hover:text-blue-300 disabled:text-gray-500 disabled:cursor-not-allowed">Reset</button>
        </div>
      
        <div className="flex flex-col gap-3 py-2">
            <AdjustmentSlider label="Temp" value={adjustments.temperature} min={-100} max={100} onChange={(v) => handleSliderChange('temperature', v)} onDoubleClick={() => handleResetSlider('temperature')} disabled={isLoading} />
            <AdjustmentSlider label="Tint" value={adjustments.tint} min={-100} max={100} onChange={(v) => handleSliderChange('tint', v)} onDoubleClick={() => handleResetSlider('tint')} disabled={isLoading} />
        </div>

        <div className="border-t border-gray-700/60 my-1"></div>
        <h4 className="text-md font-semibold text-gray-300 text-center">Tone</h4>
        <div className="flex flex-col gap-3 py-2">
            <AdjustmentSlider label="Exposure" value={adjustments.exposure} min={-100} max={100} step={1} onChange={(v) => handleSliderChange('exposure', v)} onDoubleClick={() => handleResetSlider('exposure')} disabled={isLoading} />
            <AdjustmentSlider label="Contrast" value={adjustments.contrast} min={-100} max={100} onChange={(v) => handleSliderChange('contrast', v)} onDoubleClick={() => handleResetSlider('contrast')} disabled={isLoading} />
            <AdjustmentSlider label="Highlights" value={adjustments.highlights} min={-100} max={100} onChange={(v) => handleSliderChange('highlights', v)} onDoubleClick={() => handleResetSlider('highlights')} disabled={true} />
            <AdjustmentSlider label="Shadows" value={adjustments.shadows} min={-100} max={100} onChange={(v) => handleSliderChange('shadows', v)} onDoubleClick={() => handleResetSlider('shadows')} disabled={true} />
            <AdjustmentSlider label="Whites" value={adjustments.whites} min={-100} max={100} onChange={(v) => handleSliderChange('whites', v)} onDoubleClick={() => handleResetSlider('whites')} disabled={true} />
            <AdjustmentSlider label="Blacks" value={adjustments.blacks} min={-100} max={100} onChange={(v) => handleSliderChange('blacks', v)} onDoubleClick={() => handleResetSlider('blacks')} disabled={true} />
        </div>

        <div className="border-t border-gray-700/60 my-1"></div>
        <h4 className="text-md font-semibold text-gray-300 text-center">Presence</h4>
        <div className="flex flex-col gap-3 py-2">
            <AdjustmentSlider label="Clarity" value={adjustments.clarity} min={-100} max={100} onChange={(v) => handleSliderChange('clarity', v)} onDoubleClick={() => handleResetSlider('clarity')} disabled={true} />
            <AdjustmentSlider label="Vibrance" value={adjustments.vibrance} min={-100} max={100} onChange={(v) => handleSliderChange('vibrance', v)} onDoubleClick={() => handleResetSlider('vibrance')} disabled={true} />
            <AdjustmentSlider label="Saturation" value={adjustments.saturation} min={-100} max={100} onChange={(v) => handleSliderChange('saturation', v)} onDoubleClick={() => handleResetSlider('saturation')} disabled={isLoading} />
        </div>
        <p className="text-xs text-center text-gray-500 px-4">Note: Highlights, Shadows, Whites, Blacks, Clarity, and Vibrance are coming soon.</p>


      <button
        onClick={onApply}
        disabled={isLoading || !hasChanges}
        className="w-full mt-2 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        Apply Adjustments
      </button>
    </div>
  );
};

export default ManualAdjustmentPanel;
