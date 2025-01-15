"use client";
import { useState, useRef } from "react";
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

  const workerRef = useRef<Worker | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size should be less than 10MB");
      return;
    }

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
        setError(null);
        setProgress(0);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleResize = () => {
    if (!image || !imageInfo || !preview) return;

    setLoading(true);
    setProgress(0);

    workerRef.current = new Worker(
      new URL("../workers/imageWorker.ts", import.meta.url)
    );

    workerRef.current.onmessage = (event) => {
      const { resizedImage, fileSize, progress, error } = event.data;
      console.log({
        resizedImage,
        fileSize,
        progress,
        error,
      });

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

    workerRef.current.postMessage({
      imageDataUrl: preview,
      format,
      targetSizeKB,
      maxWidth: image.width,
      maxHeight: image.height,
    });
  };

  const resetState = () => {
    setImage(null);
    setPreview(null);
    setError(null);
    setImageInfo(null);
    setProgress(0);
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 w-full">
      <div className="max-w-4xl mx-auto px-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">
              Image Resizer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {!preview ? (
              <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-gray-300 rounded-lg">
                <ImageIcon className="w-12 h-12 text-gray-400" />
                <div className="flex flex-col items-center">
                  <label className="cursor-pointer" htmlFor="file">
                    <div>
                      <Upload className="w-4 h-4 mr-2" />
                      Choose Image
                    </div>
                    <input
                      name="file"
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                  </label>
                  <p className="mt-2 text-sm text-gray-500">
                    PNG, JPG up to 10MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-100">
                  <Image
                    height={800}
                    width={600}
                    src={preview}
                    alt="Preview"
                    className="object-contain w-full h-full"
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

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Target Size (KB)
                    </label>
                    <Input
                      value={targetSizeKB.toString()}
                      type="number"
                      onChange={(input) => {
                        setTargetSizeKB(input.target.valueAsNumber);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
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
                </div>

                {loading && (
                  <div className="space-y-2">
                    <Progress value={progress} />
                    <p className="text-sm text-center text-gray-500">
                      Processing image... {progress}%
                    </p>
                  </div>
                )}

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

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
