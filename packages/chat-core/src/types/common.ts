/** Function that removes an event subscription when called. */
export type Unsubscribe = () => void;

/** Sort direction for paginated queries. */
export type SortDirection = 'asc' | 'desc';

/** Image width and height in pixels. */
export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}
