"use client";
import React, { useState, useRef } from 'react';
import { Sliders, Upload, Download, Image as ImageIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const ImageResizer = () => {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [error, setError] = useState(null);
  const [quality, setQuality] = useState(90);
  const [format, setFormat] = useState('jpeg');
  const [loading, setLoading] = useState(false);
  
  const canvasRef = useRef(null);
  
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setDimensions({
          width: img.width,
          height: img.height
        });
        setPreview(event.target.result);
        setImage(img);
        setError(null);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };
  
  const handleResize = () => {
    if (!image || !canvasRef.current) return;
    
    setLoading(true);
    
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      canvas.width = dimensions.width;
      canvas.height = dimensions.height;
      
      ctx.drawImage(image, 0, 0, dimensions.width, dimensions.height);
      
      const resizedImage = canvas.toDataURL(`image/${format}`, quality / 100);
      
      // Create download link
      const link = document.createElement('a');
      link.download = `resized-image.${format}`;
      link.href = resizedImage;
      link.click();
      
      setLoading(false);
    } catch (err) {
      setError('Error processing image');
      setLoading(false);
    }
  };
  
  const handleDimensionChange = (type, value) => {
    if (!image) return;
    
    const aspectRatio = image.width / image.height;
    
    if (type === 'width') {
      setDimensions({
        width: value,
        height: Math.round(value / aspectRatio)
      });
    } else {
      setDimensions({
        width: Math.round(value * aspectRatio),
        height: value
      });
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex flex-col items-center gap-4 p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
        <ImageIcon className="w-12 h-12 text-gray-400" />
        <div className="flex flex-col items-center">
          <label className="px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors">
            <span className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Choose Image
            </span>
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
          </label>
          <p className="mt-2 text-sm text-gray-500">PNG, JPG up to 10MB</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {preview && (
        <div className="space-y-6">
          <div className="aspect-video relative rounded-lg overflow-hidden bg-gray-100">
            <img
              src={preview}
              alt="Preview"
              className="object-contain w-full h-full"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Width</span>
                <input
                  type="number"
                  value={dimensions.width}
                  onChange={(e) => handleDimensionChange('width', Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </label>
              
              <label className="block">
                <span className="text-sm font-medium">Height</span>
                <input
                  type="number"
                  value={dimensions.height}
                  onChange={(e) => handleDimensionChange('height', Number(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </label>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium">Quality ({quality}%)</span>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="mt-1 block w-full"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">Format</span>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="jpeg">JPEG</option>
                  <option value="png">PNG</option>
                </select>
              </label>
            </div>
          </div>

          <button
            onClick={handleResize}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-blue-300"
          >
            <Download className="w-4 h-4" />
            {loading ? 'Processing...' : 'Download Resized Image'}
          </button>
        </div>
      )}
      
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default ImageResizer;