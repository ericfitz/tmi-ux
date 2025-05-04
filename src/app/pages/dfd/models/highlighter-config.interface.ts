/**
 * Interface for highlighter configuration
 */
export interface HighlighterConfig {
  name: string;
  args: {
    attrs: {
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
    };
  };
}
