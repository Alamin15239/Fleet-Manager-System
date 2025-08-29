'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Crop, Scissors, Palette, RotateCw, FlipHorizontal, 
  Download, X, Check, Move, Square
} from 'lucide-react';

interface ImageEditorProps {
  imageUrl: string;
  onSave: (editedImageUrl: string) => void;
  onCancel: () => void;
}

export default function ImageEditor({ imageUrl, onSave, onCancel }: ImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [isCropping, setIsCropping] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 300, height: 200 });
  const [filters, setFilters] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0
  });

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      setDimensions({ width: img.width, height: img.height });
      drawImage(img);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  const drawImage = (img: HTMLImageElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Apply filters
    ctx.filter = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) blur(${filters.blur}px)`;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, dimensions.width, dimensions.height);
  };

  useEffect(() => {
    if (image) {
      drawImage(image);
    }
  }, [dimensions, filters, image]);

  const handleCrop = () => {
    if (!image || !canvasRef.current) return;
    
    // Validate crop area
    if (cropArea.width <= 0 || cropArea.height <= 0) {
      alert('Please set valid crop dimensions');
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Create new canvas for cropped image
    const croppedCanvas = document.createElement('canvas');
    const croppedCtx = croppedCanvas.getContext('2d');
    if (!croppedCtx) return;

    croppedCanvas.width = cropArea.width;
    croppedCanvas.height = cropArea.height;

    // Draw cropped portion
    croppedCtx.drawImage(
      canvas,
      cropArea.x, cropArea.y, cropArea.width, cropArea.height,
      0, 0, cropArea.width, cropArea.height
    );

    // Update main canvas
    canvas.width = cropArea.width;
    canvas.height = cropArea.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(croppedCanvas, 0, 0);

    setDimensions({ width: cropArea.width, height: cropArea.height });
    setCropArea({ x: 0, y: 0, width: 0, height: 0 });
    setIsCropping(false);
  };

  const removeBackground = async () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png');
      });

      // Use AI background removal service
      const formData = new FormData();
      formData.append('image_file', blob);
      formData.append('size', 'auto');

      const response = await fetch('/api/remove-background', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const resultBlob = await response.blob();
        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          setDimensions({ width: img.width, height: img.height });
        };
        img.src = URL.createObjectURL(resultBlob);
      } else {
        // Fallback to simple background removal
        fallbackBackgroundRemoval();
      }
    } catch (error) {
      console.error('AI background removal failed:', error);
      // Fallback to simple background removal
      fallbackBackgroundRemoval();
    }
  };

  const fallbackBackgroundRemoval = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Simple edge-based background removal
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Remove white/light backgrounds
      if (r > 240 && g > 240 && b > 240) {
        data[i + 3] = 0;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCropping) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);

    setStartPoint({ x, y });
    setCropArea({ x, y, width: 0, height: 0 });
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isCropping) return;

    if (isDragging) {
      handleCornerDrag(e);
      return;
    }

    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const currentX = Math.floor(e.clientX - rect.left);
    const currentY = Math.floor(e.clientY - rect.top);

    const width = Math.abs(currentX - startPoint.x);
    const height = Math.abs(currentY - startPoint.y);
    const x = Math.min(startPoint.x, currentX);
    const y = Math.min(startPoint.y, currentY);

    setCropArea({ x, y, width, height });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setIsDragging(false);
    setDragHandle(null);
  };

  const handleCornerMouseDown = (e: React.MouseEvent, corner: string) => {
    e.stopPropagation();
    setIsDragging(true);
    setDragHandle(corner);
  };

  const handleCornerDrag = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragHandle || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = Math.floor(e.clientX - rect.left);
    const mouseY = Math.floor(e.clientY - rect.top);

    let newCropArea = { ...cropArea };

    switch (dragHandle) {
      case 'nw': // Northwest corner
        newCropArea.width = cropArea.x + cropArea.width - mouseX;
        newCropArea.height = cropArea.y + cropArea.height - mouseY;
        newCropArea.x = mouseX;
        newCropArea.y = mouseY;
        break;
      case 'ne': // Northeast corner
        newCropArea.width = mouseX - cropArea.x;
        newCropArea.height = cropArea.y + cropArea.height - mouseY;
        newCropArea.y = mouseY;
        break;
      case 'sw': // Southwest corner
        newCropArea.width = cropArea.x + cropArea.width - mouseX;
        newCropArea.height = mouseY - cropArea.y;
        newCropArea.x = mouseX;
        break;
      case 'se': // Southeast corner
        newCropArea.width = mouseX - cropArea.x;
        newCropArea.height = mouseY - cropArea.y;
        break;
    }

    // Ensure positive dimensions
    if (newCropArea.width > 0 && newCropArea.height > 0) {
      setCropArea(newCropArea);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Image Editor</h2>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Canvas */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-4">
                <div className="flex justify-center">
                  <div className="relative inline-block">
                    <canvas
                      ref={canvasRef}
                      className={`border border-gray-300 max-w-full h-auto ${isCropping ? 'cursor-crosshair' : 'cursor-default'}`}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                    />
                    {isCropping && cropArea.width > 0 && cropArea.height > 0 && (
                      <div
                        className="absolute border-2 border-red-500 bg-red-200 bg-opacity-30"
                        style={{
                          left: cropArea.x,
                          top: cropArea.y,
                          width: cropArea.width,
                          height: cropArea.height
                        }}
                      >
                        {/* Corner Handles */}
                        <div
                          className="absolute w-3 h-3 bg-red-500 border border-white cursor-nw-resize"
                          style={{ left: -6, top: -6 }}
                          onMouseDown={(e) => handleCornerMouseDown(e, 'nw')}
                        />
                        <div
                          className="absolute w-3 h-3 bg-red-500 border border-white cursor-ne-resize"
                          style={{ right: -6, top: -6 }}
                          onMouseDown={(e) => handleCornerMouseDown(e, 'ne')}
                        />
                        <div
                          className="absolute w-3 h-3 bg-red-500 border border-white cursor-sw-resize"
                          style={{ left: -6, bottom: -6 }}
                          onMouseDown={(e) => handleCornerMouseDown(e, 'sw')}
                        />
                        <div
                          className="absolute w-3 h-3 bg-red-500 border border-white cursor-se-resize"
                          style={{ right: -6, bottom: -6 }}
                          onMouseDown={(e) => handleCornerMouseDown(e, 'se')}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <Tabs defaultValue="resize" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="resize">Resize</TabsTrigger>
                <TabsTrigger value="crop">Crop</TabsTrigger>
                <TabsTrigger value="filters">Filters</TabsTrigger>
              </TabsList>

              <TabsContent value="resize" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Dimensions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <Label>Width</Label>
                      <Input
                        type="number"
                        value={dimensions.width}
                        onChange={(e) => setDimensions(prev => ({ ...prev, width: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                    <div>
                      <Label>Height</Label>
                      <Input
                        type="number"
                        value={dimensions.height}
                        onChange={(e) => setDimensions(prev => ({ ...prev, height: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="crop" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Crop Tool</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant={isCropping ? "default" : "outline"}
                      onClick={() => {
                        if (!isCropping) {
                          // Set default crop area (center 50% of image)
                          const defaultWidth = Math.floor(dimensions.width * 0.5);
                          const defaultHeight = Math.floor(dimensions.height * 0.5);
                          const defaultX = Math.floor((dimensions.width - defaultWidth) / 2);
                          const defaultY = Math.floor((dimensions.height - defaultHeight) / 2);
                          setCropArea({ x: defaultX, y: defaultY, width: defaultWidth, height: defaultHeight });
                        }
                        setIsCropping(!isCropping);
                      }}
                      className="w-full"
                    >
                      <Crop className="h-4 w-4 mr-2" />
                      {isCropping ? 'Cancel Crop' : 'Start Crop'}
                    </Button>
                    
                    {isCropping && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>X</Label>
                            <Input
                              type="number"
                              value={cropArea.x}
                              onChange={(e) => setCropArea(prev => ({ ...prev, x: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div>
                            <Label>Y</Label>
                            <Input
                              type="number"
                              value={cropArea.y}
                              onChange={(e) => setCropArea(prev => ({ ...prev, y: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Width</Label>
                            <Input
                              type="number"
                              value={cropArea.width}
                              onChange={(e) => setCropArea(prev => ({ ...prev, width: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                          <div>
                            <Label>Height</Label>
                            <Input
                              type="number"
                              value={cropArea.height}
                              onChange={(e) => setCropArea(prev => ({ ...prev, height: parseInt(e.target.value) || 0 }))}
                            />
                          </div>
                        </div>
                        <Button 
                          onClick={handleCrop} 
                          className="w-full"
                          disabled={cropArea.width <= 0 || cropArea.height <= 0}
                        >
                          <Scissors className="h-4 w-4 mr-2" />
                          Apply Crop
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="filters" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Filters & Effects</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Brightness: {filters.brightness}%</Label>
                      <Slider
                        value={[filters.brightness]}
                        onValueChange={([value]) => setFilters(prev => ({ ...prev, brightness: value }))}
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>
                    <div>
                      <Label>Contrast: {filters.contrast}%</Label>
                      <Slider
                        value={[filters.contrast]}
                        onValueChange={([value]) => setFilters(prev => ({ ...prev, contrast: value }))}
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>
                    <div>
                      <Label>Saturation: {filters.saturation}%</Label>
                      <Slider
                        value={[filters.saturation]}
                        onValueChange={([value]) => setFilters(prev => ({ ...prev, saturation: value }))}
                        min={0}
                        max={200}
                        step={1}
                      />
                    </div>
                    <div>
                      <Label>Blur: {filters.blur}px</Label>
                      <Slider
                        value={[filters.blur]}
                        onValueChange={([value]) => setFilters(prev => ({ ...prev, blur: value }))}
                        min={0}
                        max={10}
                        step={0.1}
                      />
                    </div>
                    <Button onClick={removeBackground} variant="outline" className="w-full">
                      <Palette className="h-4 w-4 mr-2" />
                      AI Remove Background
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button onClick={handleSave} className="flex-1">
                <Check className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button onClick={onCancel} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}