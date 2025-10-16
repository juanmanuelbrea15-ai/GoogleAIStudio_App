/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateEditedImage, generateFilteredImage, generateAdjustedImage } from './services/geminiService';
import Header from './components/Header';
import Spinner from './components/Spinner';
import FilterPanel from './components/FilterPanel';
import AdjustmentPanel from './components/AdjustmentPanel';
import ManualAdjustmentPanel, { type ManualAdjustments, defaultAdjustments } from './components/ManualAdjustmentPanel';
import CropPanel from './components/CropPanel';
import RestorePanel from './components/RestorePanel';
import { UndoIcon, RedoIcon, EyeIcon, UploadIcon } from './components/icons';
import StartScreen from './components/StartScreen';

// Helper to convert a data URL string to a File object
const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

type Tab = 'retouch' | 'crop' | 'manual' | 'adjust' | 'filters' | 'restore';

const App: React.FC = () => {
  const [history, setHistory] = useState<File[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number, y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ x: number, y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [isComparing, setIsComparing] = useState<boolean>(false);
  
  // State for prop images
  const [propImages, setPropImages] = useState<File[]>([]);
  const [propImageUrls, setPropImageUrls] = useState<string[]>([]);
  const [isDraggingProp, setIsDraggingProp] = useState<boolean>(false);

  // State for Restore tool
  const [brushSize, setBrushSize] = useState<number>(40);
  const [brushOpacity, setBrushOpacity] = useState<number>(100);
  const [isPainting, setIsPainting] = useState<boolean>(false);
  const [showBrushCursor, setShowBrushCursor] = useState(false);
  const [brushPosition, setBrushPosition] = useState({ x: 0, y: 0 });

  // State for Manual Adjustments
  const [adjustments, setAdjustments] = useState<ManualAdjustments>(defaultAdjustments);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null); // off-screen
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const imageObjectsRef = useRef<{ current?: HTMLImageElement, previous?: HTMLImageElement }>({});

  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (currentImage) {
      const url = URL.createObjectURL(currentImage);
      setCurrentImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCurrentImageUrl(null);
    }
  }, [currentImage]);
  
  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalImageUrl(null);
    }
  }, [originalImage]);
  
    useEffect(() => {
    // Cleanup for prop image URLs
    return () => {
        propImageUrls.forEach(url => URL.revokeObjectURL(url));
    }
  }, [propImageUrls]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setAdjustments(defaultAdjustments); // Reset adjustments after any history change
  }, [history, historyIndex]);

  const handleClearAllPropImages = useCallback(() => {
    propImageUrls.forEach(url => URL.revokeObjectURL(url));
    setPropImages([]);
    setPropImageUrls([]);
  }, [propImageUrls]);

  const handleRemovePropImage = useCallback((indexToRemove: number) => {
    const newImages = propImages.filter((_, index) => index !== indexToRemove);
    const newUrls = propImageUrls.filter((_, index) => index !== indexToRemove);
    
    // Revoke the URL of the removed image
    URL.revokeObjectURL(propImageUrls[indexToRemove]);

    setPropImages(newImages);
    setPropImageUrls(newUrls);
  }, [propImages, propImageUrls]);


  const handleImageUpload = useCallback((file: File) => {
    handleClearAllPropImages();
    setError(null);
    setHistory([file]);
    setHistoryIndex(0);
    setEditHotspot(null);
    setDisplayHotspot(null);
    setActiveTab('retouch');
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, [handleClearAllPropImages]);

  const handleGenerate = useCallback(async () => {
    if (!currentImage) return;
    if (!prompt.trim() || !editHotspot) return;

    setIsLoading(true);
    setError(null);
    
    try {
        const editedImageUrl = await generateEditedImage(currentImage, prompt, editHotspot, propImages);
        const newImageFile = dataURLtoFile(editedImageUrl, `edited-${Date.now()}.png`);
        addImageToHistory(newImageFile);
        setEditHotspot(null);
        setDisplayHotspot(null);
        handleClearAllPropImages();
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, prompt, editHotspot, propImages, addImageToHistory, handleClearAllPropImages]);
  
  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) return;
    setIsLoading(true);
    setError(null);
    
    try {
        const filteredImageUrl = await generateFilteredImage(currentImage, filterPrompt);
        const newImageFile = dataURLtoFile(filteredImageUrl, `filtered-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);
  
  const handleApplyAdjustment = useCallback(async (adjustmentPrompt: string) => {
    if (!currentImage) return;
    setIsLoading(true);
    setError(null);
    
    try {
        const adjustedImageUrl = await generateAdjustedImage(currentImage, adjustmentPrompt);
        const newImageFile = dataURLtoFile(adjustedImageUrl, `adjusted-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyManualAdjustment = useCallback(() => {
    if (!currentImage) return;
    
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Note: CSS filters are complex to replicate perfectly on canvas.
      // This is a simplified mapping. Highlights/Shadows/etc. are particularly complex.
      // This implementation focuses on the most direct mappings.
      const filters = [
        `brightness(${1 + adjustments.exposure / 100})`,
        `contrast(${1 + adjustments.contrast / 100})`,
        `saturate(${1 + adjustments.saturation / 100})`,
      ];
      ctx.filter = filters.join(' ');
      ctx.drawImage(image, 0, 0);

      // Temperature & Tint are applied as color overlays
      ctx.globalCompositeOperation = 'overlay';
      if (adjustments.temperature > 0) {
        ctx.fillStyle = `rgba(255, 165, 0, ${adjustments.temperature / 200})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (adjustments.temperature < 0) {
        ctx.fillStyle = `rgba(0, 100, 255, ${-adjustments.temperature / 200})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      ctx.globalCompositeOperation = 'color-dodge';
       if (adjustments.tint > 0) {
        ctx.fillStyle = `rgba(255, 0, 255, ${adjustments.tint / 400})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (adjustments.tint < 0) {
        ctx.fillStyle = `rgba(0, 255, 0, ${-adjustments.tint / 400})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const adjustedUrl = canvas.toDataURL('image/png');
      const newImageFile = dataURLtoFile(adjustedUrl, `manual-adjusted-${Date.now()}.png`);
      addImageToHistory(newImageFile);
    };
    image.src = URL.createObjectURL(currentImage);
  }, [currentImage, adjustments, addImageToHistory]);


  const handleApplyCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) return;
    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(image, completedCrop.x * scaleX, completedCrop.y * scaleY, completedCrop.width * scaleX, completedCrop.height * scaleY, 0, 0, completedCrop.width, completedCrop.height);
    const croppedImageUrl = canvas.toDataURL('image/png');
    const newImageFile = dataURLtoFile(croppedImageUrl, `cropped-${Date.now()}.png`);
    addImageToHistory(newImageFile);
  }, [completedCrop, addImageToHistory]);

  const handleApplyRestore = useCallback(() => {
    if (!displayCanvasRef.current) {
      setError('Canvas not ready for applying restoration.');
      return;
    }
    const canvas = displayCanvasRef.current;
    const restoredImageUrl = canvas.toDataURL('image/png');
    const newImageFile = dataURLtoFile(restoredImageUrl, `restored-${Date.now()}.png`);
    addImageToHistory(newImageFile);
    setActiveTab('retouch');
  }, [addImageToHistory]);

  useEffect(() => {
    if (activeTab !== 'restore' || !canUndo || !currentImage || !originalImage || !canvasContainerRef.current) {
        return;
    }

    const displayCanvas = displayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!displayCanvas || !maskCanvas) return;

    const displayCtx = displayCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!displayCtx || !maskCtx) return;

    let isMounted = true;
    
    const currentImgObj = new Image();
    const originalImgObj = new Image();

    const currentImageUrl = URL.createObjectURL(currentImage);
    const originalImgUrl = URL.createObjectURL(originalImage);

    const loadImages = Promise.all([
        new Promise(resolve => { currentImgObj.onload = resolve; currentImgObj.src = currentImageUrl; }),
        new Promise(resolve => { originalImgObj.onload = resolve; originalImgObj.src = originalImgUrl; })
    ]);

    loadImages.then(() => {
        if (!isMounted) return;

        imageObjectsRef.current = { current: currentImgObj, previous: originalImgObj };
        const { naturalWidth, naturalHeight } = currentImgObj;
        
        displayCanvas.width = naturalWidth;
        displayCanvas.height = naturalHeight;
        maskCanvas.width = naturalWidth;
        maskCanvas.height = naturalHeight;

        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        displayCtx.drawImage(currentImgObj, 0, 0, naturalWidth, naturalHeight);
    });

    return () => {
      isMounted = false;
      URL.revokeObjectURL(currentImageUrl);
      URL.revokeObjectURL(originalImgUrl);
    };
  }, [activeTab, currentImage, originalImage, canUndo]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLDivElement>) => {
      const canvas = displayCanvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();

      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
          return null;
      }

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      
      return { x: x * scaleX, y: y * scaleY };
  };

  const redrawComposite = useCallback(() => {
    const displayCanvas = displayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const { current, previous } = imageObjectsRef.current;
    if (!displayCanvas || !maskCanvas || !current || !previous) return;
    const displayCtx = displayCanvas.getContext('2d');
    if (!displayCtx) return;
    
    const { width, height } = displayCanvas;
    displayCtx.globalCompositeOperation = 'source-over';
    displayCtx.clearRect(0, 0, width, height);
    displayCtx.drawImage(current, 0, 0, width, height);
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCtx.drawImage(previous, 0, 0, width, height);
    tempCtx.globalCompositeOperation = 'destination-in';
    tempCtx.drawImage(maskCanvas, 0, 0);
    displayCtx.drawImage(tempCanvas, 0, 0);
  }, []);

  const drawOnMask = useCallback((start: { x: number, y: number }, end: { x: number, y: number }) => {
    const maskCtx = maskCanvasRef.current?.getContext('2d');
    const displayCanvas = displayCanvasRef.current;
    if (!maskCtx || !displayCanvas) return;
    
    const rect = displayCanvas.getBoundingClientRect();
    const scale = displayCanvas.width / rect.width; 

    maskCtx.beginPath();
    maskCtx.moveTo(start.x, start.y);
    maskCtx.lineTo(end.x, end.y);
    maskCtx.lineWidth = brushSize * scale;
    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';
    maskCtx.strokeStyle = `rgba(255, 255, 255, ${brushOpacity / 100})`;
    maskCtx.stroke();
    redrawComposite();
  }, [brushSize, brushOpacity, redrawComposite]);
  
  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      const coords = getCanvasCoordinates(e);
      if (!coords) return;
      setIsPainting(true);
      lastPointRef.current = coords;
      drawOnMask(coords, coords);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      if (!container) return;
      
      const containerRect = container.getBoundingClientRect();
      setBrushPosition({ x: e.clientX - containerRect.left, y: e.clientY - containerRect.top });

      if (!isPainting) return;

      const coords = getCanvasCoordinates(e);
      if (!coords) {
          lastPointRef.current = null;
          return;
      }
      
      if (!lastPointRef.current) {
          lastPointRef.current = coords;
      }
      
      drawOnMask(lastPointRef.current, coords);
      lastPointRef.current = coords;
  };
  
  const handleCanvasMouseUp = () => {
      setIsPainting(false);
      lastPointRef.current = null;
  };

  const handleCanvasMouseLeave = () => {
    setShowBrushCursor(false);
    setIsPainting(false);
    lastPointRef.current = null;
  };

  const handleUndo = useCallback(() => canUndo && setHistoryIndex(historyIndex - 1), [canUndo, historyIndex]);
  const handleRedo = useCallback(() => canRedo && setHistoryIndex(historyIndex + 1), [canRedo, historyIndex]);
  const handleReset = useCallback(() => history.length > 0 && setHistoryIndex(0), [history]);
  const handleUploadNew = useCallback(() => {
      handleClearAllPropImages();
      setHistory([]);
      setHistoryIndex(-1);
      setError(null);
      setPrompt('');
  }, [handleClearAllPropImages]);

  const handleDownload = useCallback(() => {
      if (currentImage) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(currentImage);
          link.download = `edited-${currentImage.name}`;
          link.click();
          URL.revokeObjectURL(link.href);
      }
  }, [currentImage]);
  
  const handleFileSelect = (files: FileList | null) => files && files[0] && handleImageUpload(files[0]);

  const handlePropImageSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
        const newFiles = Array.from(files);
        const newUrls = newFiles.map(file => URL.createObjectURL(file));

        setPropImages(prev => [...prev, ...newFiles]);
        setPropImageUrls(prev => [...prev, ...newUrls]);
    }
  };

    const handlePropDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDraggingProp(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handlePropImageSelect(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    };

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (activeTab !== 'retouch' || !imageContainerRef.current) return;
    const img = e.currentTarget;
    const imgRect = img.getBoundingClientRect();
    const containerRect = imageContainerRef.current.getBoundingClientRect();

    const clickXInImageElement = e.clientX - imgRect.left;
    const clickYInImageElement = e.clientY - imgRect.top;

    const imgLeftInContainer = imgRect.left - containerRect.left;
    const imgTopInContainer = imgRect.top - containerRect.top;

    const displayX = imgLeftInContainer + clickXInImageElement;
    const displayY = imgTopInContainer + clickYInImageElement;

    const { naturalWidth, naturalHeight, clientWidth, clientHeight } = img;
    const naturalAspect = naturalWidth / naturalHeight;
    const clientAspect = clientWidth / clientHeight;

    let renderedWidth, renderedHeight, offsetX, offsetY;
    if (naturalAspect > clientAspect) {
        renderedWidth = clientWidth;
        renderedHeight = clientWidth / naturalAspect;
        offsetX = 0;
        offsetY = (clientHeight - renderedHeight) / 2;
    } else {
        renderedHeight = clientHeight;
        renderedWidth = clientHeight * naturalAspect;
        offsetX = (clientWidth - renderedWidth) / 2;
        offsetY = 0;
    }

    if (clickXInImageElement < offsetX || clickXInImageElement > offsetX + renderedWidth || clickYInImageElement < offsetY || clickYInImageElement > offsetY + renderedHeight) {
        setEditHotspot(null);
        setDisplayHotspot(null);
        return;
    }
    
    setDisplayHotspot({ x: displayX, y: displayY });

    const imageX = clickXInImageElement - offsetX;
    const imageY = clickYInImageElement - offsetY;

    const scale = naturalWidth / renderedWidth;
    const finalX = Math.round(imageX * scale);
    const finalY = Math.round(imageY * scale);

    setEditHotspot({ x: finalX, y: finalY });
  };
  
  const generateManualAdjustmentStyle = useCallback((): React.CSSProperties => {
    if (activeTab !== 'manual') return {};
    const filters = [
        `brightness(${1 + adjustments.exposure / 100})`,
        `contrast(${1 + adjustments.contrast / 100})`,
        `saturate(${1 + adjustments.saturation + adjustments.vibrance / 2})`, // Simplified vibrance
    ];
    // A complex way to simulate highlights/shadows with CSS filters
    if (adjustments.highlights < 0) filters.push(`brightness(${1 + adjustments.highlights / 150})`);
    if (adjustments.shadows > 0) filters.push(`brightness(${1 + adjustments.shadows / 150})`);
    
    return { filter: filters.join(' ') };
  }, [adjustments, activeTab]);

  const renderContent = () => {
    if (error) {
       return (
           <div className="text-center animate-fade-in bg-red-500/10 border border-red-500/20 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold text-red-300">An Error Occurred</h2>
            <p className="text-md text-red-400">{error}</p>
            <button onClick={() => setError(null)} className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors">Try Again</button>
          </div>
        );
    }
    
    if (!currentImageUrl) {
      return <StartScreen onFileSelect={handleFileSelect} />;
    }
    
    const cropImageElement = <img ref={imgRef} key={`crop-${currentImageUrl}`} src={currentImageUrl} alt="Crop this image" className="max-h-full object-contain rounded-xl" />;
    
    const restoreCanvasElement = (
      <div ref={canvasContainerRef} onMouseDown={handleCanvasMouseDown} onMouseMove={handleCanvasMouseMove} onMouseUp={handleCanvasMouseUp} onMouseLeave={handleCanvasMouseLeave} onMouseEnter={() => setShowBrushCursor(true)} className="relative w-full h-full flex items-center justify-center cursor-none">
        <canvas ref={displayCanvasRef} className="max-w-full max-h-full rounded-xl" />
        <canvas ref={maskCanvasRef} className="hidden" />
        {showBrushCursor && <div className="absolute rounded-full border-2 border-white bg-white/30 pointer-events-none -translate-x-1/2 -translate-y-1/2" style={{ left: brushPosition.x, top: brushPosition.y, width: brushSize, height: brushSize }} />}
      </div>
    );
    
    const adjustmentOverlayStyle: React.CSSProperties = {};
    if (activeTab === 'manual') {
        if (adjustments.temperature > 0) {
            adjustmentOverlayStyle.backgroundColor = `rgba(255, 165, 0, ${adjustments.temperature / 200})`;
            adjustmentOverlayStyle.mixBlendMode = 'overlay';
        } else if (adjustments.temperature < 0) {
            adjustmentOverlayStyle.backgroundColor = `rgba(0, 100, 255, ${-adjustments.temperature / 200})`;
            adjustmentOverlayStyle.mixBlendMode = 'overlay';
        }
    }

    return (
      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
        {/* Left Column: Controls */}
        <div className="lg:col-span-1 flex flex-col gap-6">
            <div className="w-full bg-gray-800/80 border border-gray-700/80 rounded-lg p-2 grid grid-cols-3 gap-2 backdrop-blur-sm">
                {(['retouch', 'crop', 'manual', 'adjust', 'filters', 'restore'] as Tab[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        disabled={tab === 'restore' && !canUndo}
                        className={`w-full capitalize font-semibold py-3 px-1 rounded-md transition-all duration-200 text-sm ${ activeTab === tab ? 'bg-gradient-to-br from-blue-500 to-cyan-400 text-white shadow-lg shadow-cyan-500/40' : 'text-gray-300 hover:text-white hover:bg-white/10'} disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
                    >
                        {tab === 'adjust' ? 'AI Adjust' : tab}
                    </button>
                ))}
            </div>
            
            <div className="w-full">
                {activeTab === 'retouch' && (
                    <div className="flex flex-col items-center gap-4">
                        <p className="text-md text-gray-400 text-center">{editHotspot ? 'Great! Now describe your localized edit below.' : 'Click an area on the image to make a precise edit.'}</p>
                        
                        {editHotspot && !isLoading && (
                            <div 
                                className={`w-full p-4 bg-gray-900/50 border rounded-lg flex flex-col gap-3 animate-fade-in transition-colors ${isDraggingProp ? 'border-blue-400 border-dashed' : 'border-gray-700'}`}
                                onDragOver={(e) => { e.preventDefault(); setIsDraggingProp(true); }}
                                onDragLeave={() => setIsDraggingProp(false)}
                                onDrop={handlePropDrop}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 flex items-center gap-3 overflow-x-auto pb-2 -mb-2">
                                        {propImageUrls.map((url, index) => (
                                            <div key={url} className="relative flex-shrink-0">
                                                <img src={url} alt={`Prop preview ${index + 1}`} className="w-20 h-20 object-cover rounded-md" />
                                                <button onClick={() => handleRemovePropImage(index)} title="Remove prop image" className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs hover:bg-red-700 transition-transform hover:scale-110 active:scale-95 z-10">X</button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex-shrink-0">
                                        <label htmlFor="prop-image-upload" className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-gray-500 rounded-md cursor-pointer hover:border-blue-400 hover:bg-gray-800 transition-colors">
                                            <UploadIcon className="w-7 h-7 text-gray-400" />
                                            <span className="text-xs text-gray-400 mt-1 text-center">Add More</span>
                                        </label>
                                        <input id="prop-image-upload" type="file" className="hidden" accept="image/*" multiple onChange={(e) => handlePropImageSelect(e.target.files)} />
                                    </div>
                                </div>
                                <p className="text-sm text-gray-400 pt-2 border-t border-gray-700/50 w-full text-center">
                                    {propImages.length > 0 ? `The AI will incorporate these ${propImages.length} object(s).` : 'Add objects by uploading or dragging images here.'}
                                </p>
                            </div>
                        )}

                        <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="w-full flex items-center gap-2">
                            <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={editHotspot ? "e.g., 'add the cats to the sofa'" : "First click a point on the image"} className="flex-grow bg-gray-800 border border-gray-700 text-gray-200 rounded-lg p-5 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60" disabled={isLoading || !editHotspot} />
                            <button type="submit" className="bg-gradient-to-br from-blue-600 to-blue-500 text-white font-bold py-5 px-8 text-lg rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:from-blue-800 disabled:to-blue-700 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none" disabled={isLoading || !prompt.trim() || !editHotspot}>Generate</button>
                        </form>
                    </div>
                )}
                {activeTab === 'crop' && <CropPanel onApplyCrop={handleApplyCrop} onSetAspect={setAspect} isLoading={isLoading} isCropping={!!completedCrop?.width && completedCrop.width > 0} />}
                {activeTab === 'manual' && <ManualAdjustmentPanel adjustments={adjustments} onAdjustmentChange={setAdjustments} onApply={handleApplyManualAdjustment} onReset={() => setAdjustments(defaultAdjustments)} isLoading={isLoading}/>}
                {activeTab === 'adjust' && <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} />}
                {activeTab === 'filters' && <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />}
                {activeTab === 'restore' && canUndo && <RestorePanel brushSize={brushSize} onBrushSizeChange={setBrushSize} brushOpacity={brushOpacity} onBrushOpacityChange={setBrushOpacity} onApplyRestore={handleApplyRestore} isLoading={isLoading} />}
            </div>
            
            <div className="grid grid-cols-2 gap-3 mt-auto pt-6">
                <button onClick={handleUndo} disabled={!canUndo} className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5" aria-label="Undo last action"><UndoIcon className="w-5 h-5 mr-2" />Undo</button>
                <button onClick={handleRedo} disabled={!canRedo} className="flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-white/5" aria-label="Redo last action"><RedoIcon className="w-5 h-5 mr-2" />Redo</button>
                {canUndo && <button onMouseDown={() => setIsComparing(true)} onMouseUp={() => setIsComparing(false)} onMouseLeave={() => setIsComparing(false)} onTouchStart={() => setIsComparing(true)} onTouchEnd={() => setIsComparing(false)} className="col-span-2 flex items-center justify-center text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base" aria-label="Press and hold to see original image"><EyeIcon className="w-5 h-5 mr-2" />Compare</button>}
                <button onClick={handleReset} disabled={!canUndo} className="col-span-1 text-center bg-transparent border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/10 hover:border-white/30 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent">Reset</button>
                <button onClick={handleUploadNew} className="col-span-1 text-center bg-white/10 border border-white/20 text-gray-200 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/30 active:scale-95 text-base">Upload New</button>
                <button onClick={handleDownload} className="col-span-2 bg-gradient-to-br from-green-600 to-green-500 text-white font-bold py-3 px-5 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/40 hover:-translate-y-px active:scale-95 active:shadow-inner text-base">Download Image</button>
            </div>
        </div>
        
        {/* Right Column: Image */}
        <div className="lg:col-span-2 h-[85vh] w-full">
            <div ref={imageContainerRef} className="relative w-full h-full flex items-center justify-center shadow-2xl rounded-xl overflow-hidden bg-black/20">
                {isLoading && (
                    <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
                        <Spinner />
                        <p className="text-gray-300">AI is working its magic...</p>
                    </div>
                )}

                {activeTab === 'crop' 
                  ? <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)} aspect={aspect} className="h-full w-full flex items-center justify-center">{cropImageElement}</ReactCrop>
                  : activeTab === 'restore' 
                  ? restoreCanvasElement
                  : <div className="relative w-full h-full flex items-center justify-center">
                      {originalImageUrl && <img key={`orig-${originalImageUrl}`} src={originalImageUrl} alt="Original" className="w-full h-full object-contain rounded-xl pointer-events-none" />}
                      <img ref={imgRef} key={`current-${currentImageUrl}`} src={currentImageUrl} alt="Current" onClick={handleImageClick} style={generateManualAdjustmentStyle()} className={`absolute top-0 left-0 w-full h-full object-contain rounded-xl transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'} ${activeTab === 'retouch' ? 'cursor-crosshair' : ''}`} />
                      <div className="absolute inset-0 pointer-events-none" style={adjustmentOverlayStyle}></div>
                    </div> 
                }

                {displayHotspot && !isLoading && activeTab === 'retouch' && (
                    <div className="absolute rounded-full w-6 h-6 bg-blue-500/50 border-2 border-white pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10" style={{ left: `${displayHotspot.x}px`, top: `${displayHotspot.y}px` }}>
                        <div className="absolute inset-0 rounded-full w-6 h-6 animate-ping bg-blue-400"></div>
                    </div>
                )}
            </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="min-h-screen text-gray-100 flex flex-col">
      <Header />
      <main className={`flex-grow w-full max-w-[1800px] mx-auto p-4 md:p-8 flex ${currentImage ? 'items-start' : 'items-center justify-center'}`}>
        {renderContent()}
      </main>
    </div>
  );
};

export default App;