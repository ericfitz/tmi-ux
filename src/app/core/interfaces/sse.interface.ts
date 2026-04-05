/** Generic SSE event as parsed from a text/event-stream response. */
export interface SseEvent {
  event: string;
  data: string;
}
