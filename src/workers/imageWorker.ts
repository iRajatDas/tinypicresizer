// ----------------------------------------
// 1) TYPES (Optional, for clarity)
// ----------------------------------------
interface WorkerData {
  imageDataUrl: string; // Base64 data URL of the original image
  targetSizeKB: number; // Desired upper bound on file size
  maxWidth: number; // Starting width
  maxHeight: number; // Starting height
  format: "jpeg" | "png"; // "jpeg" or "png"
}

interface WorkerResult {
  resizedImage?: string; // Output Base64 data URL
  fileSize?: number; // Output size in KB
  progress?: number; // (Optional) progress for UI
  error?: string; // Error message if something fails
}

// ----------------------------------------
// 2) GLOBAL OffscreenCanvas
// ----------------------------------------
let offscreenCanvas: OffscreenCanvas | null = null;
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

/** Initialize once. */
const initOffscreenCanvas = () => {
  if (!offscreenCanvas) {
    offscreenCanvas = new OffscreenCanvas(1, 1);
    offscreenCtx = offscreenCanvas.getContext("2d");
  }
};

// ----------------------------------------
// 3) HELPER FUNCTIONS
// ----------------------------------------
/** Compute file size in KB from a Base64 data URL. */
const calculateFileSizeKB = (base64: string): number => {
  // base64 length * 3/4 => bytes, then /1024 => KB
  return Math.round((base64.length * 3) / 4 / 1024);
};

/**
 * Resize an ImageBitmap to (width x height) with given quality & format.
 * Returns a Base64 data URL.
 */
const resizeImage = async (
  bitmap: ImageBitmap,
  width: number,
  height: number,
  quality: number,
  format: "jpeg" | "png"
): Promise<string> => {
  if (!offscreenCanvas || !offscreenCtx) {
    throw new Error("OffscreenCanvas not initialized.");
  }
  offscreenCanvas.width = width;
  offscreenCanvas.height = height;

  offscreenCtx.clearRect(0, 0, width, height);
  offscreenCtx.drawImage(bitmap, 0, 0, width, height);

  const blob = await offscreenCanvas.convertToBlob({
    type: `image/${format === "png" ? "webp" : "jpeg"}`,
    quality: format === "png" ? 1.0 : quality, // PNG ignores quality, but we pass it anyway
  });
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

/**
 * Strict binary search that returns the *largest* quality under (or equal to) targetSizeKB.
 * If *no* quality under the target is found (even at quality=0), returns an empty string.
 */
const strictBinarySearchQuality = async (
  bitmap: ImageBitmap,
  width: number,
  height: number,
  format: "jpeg" | "png",
  targetSizeKB: number
): Promise<{ image: string; fileSize: number }> => {
  let low = 0.0;
  let high = 1.0;
  let bestUnderLimitImage = "";
  let bestUnderLimitSize = 0;

  // We'll do ~7-8 iterations (while high - low > ~0.01).
  while (high - low > 0.01) {
    const mid = (low + high) / 2;
    const candidate = await resizeImage(bitmap, width, height, mid, format);
    const size = calculateFileSizeKB(candidate);

    if (size <= targetSizeKB) {
      // Under or equal to the limit => record if it's bigger than our current bestUnderLimit
      if (size > bestUnderLimitSize) {
        bestUnderLimitSize = size;
        bestUnderLimitImage = candidate;
      }
      // Try a higher quality
      low = mid;
    } else {
      // Over limit => go lower
      high = mid;
    }
  }

  // If we never found an under-limit candidate, do a final check at 'low'
  if (!bestUnderLimitImage) {
    const finalCandidate = await resizeImage(
      bitmap,
      width,
      height,
      low,
      format
    );
    const finalSize = calculateFileSizeKB(finalCandidate);
    if (finalSize <= targetSizeKB) {
      return { image: finalCandidate, fileSize: finalSize };
    } else {
      // Means even at "low", it's above => no solution at these dimensions
      return { image: "", fileSize: Infinity };
    }
  }

  return { image: bestUnderLimitImage, fileSize: bestUnderLimitSize };
};

/**
 * Scale dimensions by a factor. E.g. factor=0.9 => -10%.
 */
const scaleDimensions = (
  width: number,
  height: number,
  factor: number
): { width: number; height: number } => {
  return {
    width: Math.round(width * factor),
    height: Math.round(height * factor),
  };
};

// ----------------------------------------
// 4) MAIN WORKER
// ----------------------------------------
self.onmessage = async (evt: MessageEvent<WorkerData>) => {
  try {
    const { imageDataUrl, targetSizeKB, maxWidth, maxHeight, format } =
      evt.data;

    // (A) Init OffscreenCanvas
    initOffscreenCanvas();
    if (!offscreenCanvas || !offscreenCtx) {
      throw new Error("OffscreenCanvas or context not available.");
    }

    // (B) Convert dataUrl -> Blob -> ImageBitmap
    const resp = await fetch(imageDataUrl);
    const blob = await resp.blob();
    const originalBitmap = await self.createImageBitmap(blob);

    // We'll track the best (max) file size that is still under the target.
    let bestOverallImage = "";
    let bestOverallSize = 0;

    // Current working dimensions
    let width = maxWidth;
    let height = maxHeight;

    // We do a dimension loop that ensures we *never* accept an over-limit result
    const maxIterations = 12;
    for (let i = 0; i < maxIterations; i++) {
      // 1) Run a strict binary search at these dimensions
      const { image, fileSize } = await strictBinarySearchQuality(
        originalBitmap,
        width,
        height,
        format,
        targetSizeKB
      );

      // 2) If found an under-limit candidate
      if (image) {
        // Update global best if it's larger but still under limit
        if (fileSize > bestOverallSize) {
          bestOverallSize = fileSize;
          bestOverallImage = image;
        }

        // Decide how close we are
        const diff = targetSizeKB - fileSize; // how many KB away from the limit

        if (diff <= 2) {
          // If within 2 KB, that's "very close" => break
          break;
        } else if (diff >= 20) {
          // If we're 20+ KB below target, let's scale up more aggressively
          const newDims = scaleDimensions(width, height, 1.1); // +10%
          width = newDims.width;
          height = newDims.height;
        } else if (diff >= 5) {
          // 5-20 KB below => smaller scale-up (e.g. +5%)
          const newDims = scaleDimensions(width, height, 1.05);
          width = newDims.width;
          height = newDims.height;
        } else {
          // If 2-5 KB away, let's do a *tiny* scale up (e.g. +2%)
          const newDims = scaleDimensions(width, height, 1.02);
          width = newDims.width;
          height = newDims.height;
        }
      } else {
        // 3) Means we didn't find *any* quality under the target => dimension too big
        // Let's scale down by 10%
        const newDims = scaleDimensions(width, height, 0.9);
        width = newDims.width;
        height = newDims.height;
      }

      // 4) Post optional progress
      const progress = Math.round(((i + 1) / maxIterations) * 100);
      self.postMessage({ progress } as WorkerResult);
    }

    // 5) If we never got *any* under-limit result, do a final forced minimal approach:
    if (!bestOverallImage) {
      // We'll forcibly set quality=0 + keep scaling down until we go under target
      let forcedImage = "";
      let forcedSize = Infinity;

      let attempt = 0;
      while (attempt < 10) {
        const candidate = await resizeImage(
          originalBitmap,
          width,
          height,
          0.0,
          format
        );
        const size = calculateFileSizeKB(candidate);
        if (size <= targetSizeKB) {
          forcedImage = candidate;
          forcedSize = size;
          break;
        } else {
          // keep shrinking more aggressively
          const newDims = scaleDimensions(width, height, 0.8);
          width = newDims.width;
          height = newDims.height;
        }
        attempt++;
      }

      if (!forcedImage) {
        // Worst-case fallback: it's still over the limit even at small dims => we do what we can
        forcedImage = await resizeImage(
          originalBitmap,
          width,
          height,
          0.0,
          format
        );
        forcedSize = calculateFileSizeKB(forcedImage);
      }

      bestOverallImage = forcedImage;
      bestOverallSize = forcedSize;
    }

    // 6) Final small-step approach:
    //    If we ended up well below the target, let's see if we can nudge up a bit more,
    //    in very small increments (1-2%), still strictly below the limit.
    let finalDiff = targetSizeKB - bestOverallSize;
    let smallStepIteration = 0;

    // We'll allow up to 5 small steps of +2%
    while (finalDiff >= 5 && smallStepIteration < 5) {
      const newDims = scaleDimensions(width, height, 1.02); // +2% each step
      width = newDims.width;
      height = newDims.height;

      // Re-run strict binary search
      const { image, fileSize } = await strictBinarySearchQuality(
        originalBitmap,
        width,
        height,
        format,
        targetSizeKB
      );

      if (image && fileSize > bestOverallSize) {
        bestOverallSize = fileSize;
        bestOverallImage = image;
      } else if (!image) {
        // Means that even at these dims, we can't stay under => revert the small step
        width = Math.round(width / 1.02);
        height = Math.round(height / 1.02);
        break;
      }

      finalDiff = targetSizeKB - bestOverallSize;
      smallStepIteration++;
    }

    // 7) Return final
    self.postMessage({
      resizedImage: bestOverallImage,
      fileSize: bestOverallSize,
      progress: 100,
    } as WorkerResult);
  } catch (err) {
    if (err instanceof Error) {
      self.postMessage({ error: `Error: ${err.message}` } as WorkerResult);
    } else {
      self.postMessage({ error: "An unknown error occurred." } as WorkerResult);
    }
  }
};
