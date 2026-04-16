/**
 * Build W3C Trace Context headers for outbound requests.
 *
 * @see https://www.w3.org/TR/trace-context/
 */
export const traceContextHeaders = (
  traceparent: string,
  tracestate?: string
): Readonly<Record<string, string>> => {
  const headers: Record<string, string> = { traceparent };
  if (tracestate !== undefined && tracestate.length > 0) {
    headers.tracestate = tracestate;
  }
  return headers;
};
