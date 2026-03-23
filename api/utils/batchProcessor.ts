/**
 * Batch processing utility for parallel file operations
 */

export interface BatchOptions {
  batchSize: number;
  concurrency: number;
  maxMemoryMB?: number;
}

export interface BatchResult<R> {
  results: R[];
  errors: Array<{ item: unknown; error: Error }>;
}

/**
 * Process items in parallel batches
 *
 * @param items - Array of items to process
 * @param processor - Async function to process each item
 * @param options - Batch configuration options
 * @returns Object with results and errors arrays
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: BatchOptions,
): Promise<BatchResult<R>> {
  const { batchSize, concurrency, maxMemoryMB = 512 } = options;
  const results: R[] = [];
  const errors: Array<{ item: T; error: Error }> = [];

  // Split items into batches
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  // Process batches with limited concurrency
  const activeBatches: Promise<void>[] = [];
  let batchIndex = 0;

  async function processBatchItems(batch: T[]): Promise<void> {
    for (const item of batch) {
      try {
        // Check memory usage before processing
        if (maxMemoryMB) {
          const memUsage = getMemoryUsageMB();
          if (memUsage > maxMemoryMB) {
            console.warn(
              `Memory usage (${memUsage.toFixed(0)}MB) exceeds limit (${maxMemoryMB}MB), pausing...`,
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }

        const result = await processor(item);
        results.push(result);
      } catch (error) {
        errors.push({ item, error: error as Error });
      }
    }
  }

  while (batchIndex < batches.length) {
    // Wait if we've reached max concurrency
    if (activeBatches.length >= concurrency) {
      await Promise.race(activeBatches);
    }

    // Remove completed batches
    const completedIndex = activeBatches.findIndex(
      async (p) => {
        try {
          await p;
          return true;
        } catch {
          return true;
        }
      },
    );

    if (completedIndex >= 0) {
      activeBatches.splice(completedIndex, 1);
    }

    // Start new batch
    if (batchIndex < batches.length) {
      const batch = batches[batchIndex];
      const promise = processBatchItems(batch);
      activeBatches.push(promise);
      batchIndex++;
    }
  }

  // Wait for all remaining batches to complete
  await Promise.all(activeBatches);

  return { results, errors };
}

/**
 * Get current memory usage in MB
 */
function getMemoryUsageMB(): number {
  const mem = Deno.memoryUsage();
  return mem.heapUsed / (1024 * 1024);
}

/**
 * Process items with a simple concurrency limit (not batched)
 * Useful for simpler cases where batching isn't needed
 */
export async function processConcurrent<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
): Promise<BatchResult<R>> {
  const results: R[] = [];
  const errors: Array<{ item: T; error: Error }> = [];
  const active: Promise<void>[] = [];
  let index = 0;

  async function processNext(): Promise<void> {
    if (index >= items.length) return;

    const currentIndex = index++;
    const item = items[currentIndex];

    try {
      const result = await processor(item);
      results[currentIndex] = result;
    } catch (error) {
      errors.push({ item, error: error as Error });
    }
  }

  while (index < items.length || active.length > 0) {
    // Start new tasks up to concurrency limit
    while (active.length < concurrency && index < items.length) {
      active.push(processNext());
    }

    // Wait for at least one task to complete
    if (active.length > 0) {
      await Promise.race(active);

      // Remove completed tasks
      const stillActive: Promise<void>[] = [];
      for (const promise of active) {
        const settled = await Promise.race([
          promise.then(() => true, () => true),
          Promise.resolve(false),
        ]);
        if (!settled) {
          stillActive.push(promise);
        }
      }
      active.length = 0;
      active.push(...stillActive);
    }
  }

  return { results, errors };
}
