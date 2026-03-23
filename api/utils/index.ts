// 返回数据库有效值， 否则返回默认值
export function getDbValue<T>(value: T | undefined, defaultValue: T): T {
  return value !== undefined ? value : defaultValue;
}

// Metadata cleaning utilities
export * from "./metadataCleaner.ts";
// Cover extraction utilities
export * from "./coverExtractor.ts";
