import { describe, expect, it } from 'vitest';
import { traceContextHeaders } from '../src/tracing.js';

describe('traceContextHeaders', () => {
  it('sets traceparent and optional tracestate', () => {
    expect(
      traceContextHeaders(
        '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
      )
    ).toEqual({
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
    });
    expect(
      traceContextHeaders(
        '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        'vendor=v1'
      )
    ).toEqual({
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
      tracestate: 'vendor=v1'
    });
  });

  it('omits empty tracestate', () => {
    expect(
      traceContextHeaders(
        '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
        ''
      )
    ).toEqual({
      traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
    });
  });
});
