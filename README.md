# Tiny Pic Resizer

Efficiently compress and resize images via a Web Worker without blocking the main thread.

## Features

- **Strict Target Limit**  
  Ensures output image never exceeds the specified file size.

- **Dimension & Quality Control**  
  Dynamically adjusts width, height, and compression quality to achieve optimal results.

- **Performance-Focused**  
  Utilizes a single OffscreenCanvas and a single ImageBitmap creation to minimize overhead.

- **Scalable Logic**  
  Iteratively scales dimensions (up or down) and performs binary searches to fine-tune compression.

- **Configurable**  
  Easily modify scale factors, iteration counts, quality thresholds, and more to suit your project needs.
