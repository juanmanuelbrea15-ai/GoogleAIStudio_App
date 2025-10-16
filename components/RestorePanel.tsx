/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface RestorePanelProps {
  brushSize: number;
  brushOpacity: number;
  onBrushSizeChange: (size: number) => void;
  onBrushOpacityChange: (opacity: number) => void;
  onApplyRestore: () => void;
  isLoading: boolean;
}

const RestorePanel: React.FC<RestorePanelProps> = ({
  brushSize,
  brushOpacity,
  onBrushSizeChange,
  onBrushOpacityChange,
  onApplyRestore,
  isLoading
}) => {
  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-gray-300">Restore Brush</h3>
      <p className="text-sm text-gray-400 -mt-2">Paint over areas to restore them to the original image.</p>

      <div className="w-full max-w-sm flex flex-col gap-3">
        <div className="w-full flex items-center gap-4 px-2">
          <label htmlFor="brush-size" className="text-sm font-medium text-gray-400 w-20">Brush Size</label>
          <input
            id="brush-size"
            type="range"
            min="5"
            max="100"
            value={brushSize}
            onChange={(e) => onBrushSizeChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            disabled={isLoading}
          />
          <span className="text-sm font-semibold text-gray-200 w-8 text-center">{brushSize}</span>
        </div>
        <div className="w-full flex items-center gap-4 px-2">
          <label htmlFor="brush-opacity" className="text-sm font-medium text-gray-400 w-20">Opacity</label>
          <input
            id="brush-opacity"
            type="range"
            min="10"
            max="100"
            step="5"
            value={brushOpacity}
            onChange={(e) => onBrushOpacityChange(Number(e.target.value))}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
            disabled={isLoading}
          />
          <span className="text-sm font-semibold text-gray-200 w-8 text-center">{brushOpacity}%</span>
        </div>
      </div>
      
      <button
        onClick={onApplyRestore}
        disabled={isLoading}
        className="w-full max-w-xs mt-2 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:from-green-800 disabled:to-green-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        Apply Restoration
      </button>
    </div>
  );
};

export default RestorePanel;