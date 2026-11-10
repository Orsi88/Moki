// Plain Office data contracts shared by the parser, service and browser UI; no Node or renderer code.
export interface OfficeComment { id: string; author: string; date: string; text: string; anchor: string }
export interface WordDocument { readOnly?: boolean; html: string; paragraphs: { id: string; text: string; editable: boolean }[]; comments: OfficeComment[] }
export type WordChange = { op: 'text'; paragraph: string; text: string } | { op: 'comment'; paragraph: string; text: string; author: string } | { op: 'delete-comment'; id: string };
export interface CellInfo { value: string; formula?: string; style: Record<string, string> }
export interface WorksheetInfo { name: string; path: string; protected: boolean; cells: Record<string, CellInfo>; comments: OfficeComment[] }
export interface WorkbookInfo { readOnly?: boolean; sheets: WorksheetInfo[] }
export type SheetChange = { op: 'cell'; sheet: number; ref: string; value: string } | { op: 'comment'; sheet: number; ref: string; text: string; author: string } | { op: 'delete-comment'; sheet: number; ref: string };
