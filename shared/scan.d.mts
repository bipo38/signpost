export const ENTRIES: string[]
export const SKIP: string[]
export const FIXABLE: RegExp
export interface Folder { path: string; count: number }
export interface ScanResult {
  entry: string
  docs: string
  nodes: { path: string; title: string }[]
  edges: { from: string; to: string; count: number }[]
  returnTables: string[]
  broken: { from: string; ref: string; line: number; text: string; fixable: boolean }[]
}
export function docsUnder(paths: string[], docs: string): string[]
export function foldersOf(paths: string[]): Folder[]
export function scanFiles(o: { docs?: string; paths: string[]; read: (path: string) => string | undefined }): ScanResult
