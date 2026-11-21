// Plain Office data contracts shared by the parser, service and browser UI; no Node or renderer code.
export interface OfficeReply { author: string; at: string; text: string }
export interface OfficeComment { id: string; author: string; date: string; text: string; anchor: string; color?: string; replies?: OfficeReply[]; range?: { start: number; end: number } }
export interface WordDocument { readOnly?: boolean; html: string; paragraphs: { id: string; text: string; editable: boolean }[]; comments: OfficeComment[] }
export type WordChange = { op: 'text'; paragraph: string; text: string } | { op: 'format'; paragraph: string; mark: 'b' | 'i' | 'u' } | { op: 'insert'; after: string; text: string } | { op: 'comment'; paragraph: string; text: string; author: string; color?: string; range?: { start: number; end: number } } | { op: 'edit-comment'; id: string; text: string } | { op: 'reply'; id: string; text: string; author: string } | { op: 'color'; id: string; color: string } | { op: 'delete-comment'; id: string };
export interface CellInfo { value: string; formula?: string; style: Record<string, string> }
export interface WorksheetInfo { name: string; path: string; protected: boolean; cells: Record<string, CellInfo>; comments: OfficeComment[] }
export interface WorkbookInfo { readOnly?: boolean; sheets: WorksheetInfo[] }
export type SheetChange = { op: 'cell'; sheet: number; ref: string; value: string } | { op: 'comment'; sheet: number; ref: string; text: string; author: string; color?: string } | { op: 'reply'; sheet: number; ref: string; text: string; author: string } | { op: 'color'; sheet: number; ref: string; color: string } | { op: 'delete-comment'; sheet: number; ref: string };
// A presentation's speaker notes and comments, slide by slide (in the order of the slide show). area: what the comment
// marks, in fractions of the slide (0, 0, 1, 1 = the whole slide); pin: where a comment made in PowerPoint sits, when it
// marks no area. readOnly: a comment of the newer PowerPoint format, shown but edited in PowerPoint.
export interface SlideArea { x: number; y: number; w: number; h: number }
export interface SlideComment { id: string; author: string; date: string; text: string; color?: string; replies?: OfficeReply[]; area?: SlideArea; pin?: { x: number; y: number }; readOnly?: boolean }
export interface SlideNotes { notes: string; formatted: boolean; comments: SlideComment[] }
export interface DeckNotes { readOnly?: boolean; slides: SlideNotes[] }
export type SlideChange = { op: 'notes'; slide: number; text: string }
  | { op: 'comment'; slide: number; text: string; author: string; color?: string; area: SlideArea }
  | { op: 'edit-comment'; slide: number; id: string; text: string }
  | { op: 'reply'; slide: number; id: string; text: string; author: string }
  | { op: 'color'; slide: number; id: string; color: string }
  | { op: 'delete-comment'; slide: number; id: string };
