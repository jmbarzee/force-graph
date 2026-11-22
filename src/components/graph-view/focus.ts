// The declarative focus request and how two of them compare.

/**
 * A request to reveal, frame and select a node — the declarative form of the
 * handle's `focusNode`, for a host whose pane mounts lazily or whose data
 * arrives after the request. Compared by value: a new `id` or `key` is a new
 * request, the same pair on a re-render is not, so a host repeats a request
 * for one node by changing `key`. A request waits until its node is in the
 * graph; then the view runs the focus recipe once and `onFocusResult` says
 * whether the filter could show the node. `null`, or a newer request,
 * withdraws a waiting one; a withdrawn request is not reported.
 */
export interface FocusRequest {
  /** The node to focus. */
  id: string
  /** Changed to repeat a request for the same node. */
  key?: number | string
}

/** Whether two requests are the same ask: both absent, or the same id and key. */
export function sameFocusRequest(a: FocusRequest | null, b: FocusRequest | null): boolean {
  return a === b || (a !== null && b !== null && a.id === b.id && a.key === b.key)
}

/** Whether a request names a node: one carrying a target's values alone does not, and the view leaves it to the switch that widened its filter. */
export function namesNode(request: Partial<FocusRequest> | null | undefined): request is FocusRequest {
  return request?.id !== undefined
}
