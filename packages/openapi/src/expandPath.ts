import { err, ok, type Result } from 'trembita';

export type ExpandPathError = Readonly<{
  kind: 'openapi_path_unexpanded';
  template: string;
  segments: readonly string[];
}>;

const escapeRe = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Replace `{param}` segments in an OpenAPI-style path template.
 */
export const expandOpenapiPath = (
  template: string,
  params: Readonly<Record<string, string | number>>
): Result<string, ExpandPathError> => {
  let out = template;
  for (const [key, value] of Object.entries(params)) {
    out = out.replace(new RegExp(`\\{${escapeRe(key)}\\}`, 'g'), String(value));
  }
  const re = /\{([^}]+)\}/g;
  const missing: string[] = [];
  for (const m of out.matchAll(re)) {
    const seg = m[1];
    if (seg !== undefined && seg.length > 0) {
      missing.push(seg);
    }
  }
  if (missing.length > 0) {
    return err({
      kind: 'openapi_path_unexpanded',
      template,
      segments: missing
    });
  }
  return ok(out);
};
