"use client";

import { useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Download, Image as ImageIcon, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { readableBytes } from "@/lib/utils";
import Wrapper from "@/components/wrapper";

interface ImageInfo {
  originalSize: number;
  resizedSize: number;
  name: string;
}

export default function ImageResizePage() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<"jpeg" | "png">("jpeg");
  const [loading, setLoading] = useState<boolean>(false);
  const [imageInfo, setImageInfo] = useState<ImageInfo | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [targetSizeKB, setTargetSizeKB] = useState<number>(100);
  const [maintainAspect, setMaintainAspect] = useState<boolean>(true); // Example new feature

  const workerRef = useRef<Worker | null>(null);

  // ---------------------------------------
  // 1) Handle File(s) via Dropzone
  // ---------------------------------------
  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    // limit 10MB
    if (file.size > 10 * 1024 * 1024) {
      setError("File size should be less than 10MB");
      return;
    }

    setError(null);
    setProgress(0);

    // Convert file to dataURL
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement("img");
      img.onload = () => {
        setImage(img);
        setPreview(event.target?.result as string);
        setImageInfo({
          originalSize: Math.round(file.size),
          resizedSize: 0,
          name: file.name,
        });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // We only allow single file; up to 10MB; accept images
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxSize: 10 * 1024 * 1024,
    accept: {
      "image/*": [],
    },
  });

  // ---------------------------------------
  // 2) Handle Worker-based Resizing
  // ---------------------------------------
  const handleResize = () => {
    if (!image || !imageInfo || !preview) return;

    setLoading(true);
    setProgress(0);

    // Create new worker if not existing
    workerRef.current = new Worker(
      new URL("../workers/imageWorker.ts", import.meta.url)
    );

    workerRef.current.onmessage = (event) => {
      const { resizedImage, fileSize, progress, error } = event.data;

      if (error) {
        setError(error);
        setLoading(false);
        workerRef.current?.terminate();
        workerRef.current = null;
        return;
      }

      if (progress !== undefined) {
        setProgress(progress);
      }

      if (progress === 100 && resizedImage) {
        // Download result automatically
        const link = document.createElement("a");
        const fileName = imageInfo.name.replace(/\.[^/.]+$/, "");
        link.download = `${fileName}-resized.${format}`;
        link.href = resizedImage;
        link.click();

        setImageInfo((prev) =>
          prev
            ? {
                ...prev,
                resizedSize: fileSize,
              }
            : null
        );

        setLoading(false);
        workerRef.current?.terminate();
        workerRef.current = null;
      }
    };

    workerRef.current.onerror = () => {
      setError("An unexpected error occurred during processing.");
      setLoading(false);
      workerRef.current?.terminate();
      workerRef.current = null;
    };

    // In case you want to override dimensions before sending to worker:
    // e.g., if maintainAspect is OFF, you might let user specify custom width/height
    const maxWidth = maintainAspect ? image.width : image.width; // or custom
    const maxHeight = maintainAspect ? image.height : image.height; // or custom

    workerRef.current.postMessage({
      imageDataUrl: preview,
      format,
      targetSizeKB,
      maxWidth,
      maxHeight,
    });
  };

  // ---------------------------------------
  // 3) Reset State
  // ---------------------------------------
  const resetState = () => {
    setImage(null);
    setPreview(null);
    setError(null);
    setImageInfo(null);
    setProgress(0);
    setLoading(false);
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  };

  // ---------------------------------------
  // 4) UI
  // ---------------------------------------
  return (
    <Wrapper as="section" className="w-full py-10">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              Image Resizer
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Dropzone or Preview */}
            {!preview ? (
              <div
                {...getRootProps()}
                className={`flex flex-col items-center justify-center gap-4 p-8 border-2 rounded-lg transition-colors ${
                  isDragActive
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-300 bg-white"
                } cursor-pointer text-center`}
              >
                <input {...getInputProps()} />
                <ImageIcon className="w-12 h-12 text-gray-400" />
                <p className="text-gray-500">
                  Drag & Drop or Click to upload (PNG/JPG up to 10MB)
                </p>
                <Button variant="ghost" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Choose Image
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Preview Image */}
                <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-200">
                  <Image
                    src={preview}
                    alt="Preview"
                    fill
                    className="object-contain"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={resetState}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Change Image
                  </Button>
                </div>

                {/* File sizes */}
                {imageInfo && (
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Original Size</p>
                      <p className="font-medium">
                        {readableBytes(imageInfo.originalSize)}
                      </p>
                    </div>
                    {imageInfo.resizedSize > 0 && (
                      <div>
                        <p className="text-gray-500">Resized Size</p>
                        <p className="font-medium">
                          {readableBytes(imageInfo.resizedSize * 1024)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Settings */}
                <div className="space-y-4">
                  {/* Target Size */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Target Size (KB)
                    </label>
                    <Input
                      value={targetSizeKB.toString()}
                      type="number"
                      min={1}
                      onChange={(e) => {
                        setTargetSizeKB(e.target.valueAsNumber || 1);
                      }}
                    />
                  </div>

                  {/* Format */}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Output Format</label>
                    <Select
                      value={format}
                      onValueChange={(value) =>
                        setFormat(value as "jpeg" | "png")
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="jpeg">JPEG</SelectItem>
                        <SelectItem value="png">PNG</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Maintain Aspect Ratio - example new feature */}
                  <div className="flex items-center gap-2">
                    <input
                      id="maintainAspect"
                      type="checkbox"
                      disabled
                      checked={maintainAspect}
                      onChange={(e) => setMaintainAspect(e.target.checked)}
                    />
                    <label htmlFor="maintainAspect" className="text-sm">
                      Maintain aspect ratio
                    </label>
                  </div>
                </div>

                {/* Progress */}
                {loading && (
                  <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-sm text-center text-gray-500">
                      Processing image... {progress}%
                    </p>
                  </div>
                )}

                {/* Action Button */}
                <Button
                  className="w-full"
                  onClick={handleResize}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Download Resized Image
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </Wrapper>
  );
}
