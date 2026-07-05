/**
 * ============================================================================
 *  ESM RESOLVE HOOK — cho phép chạy THẬT route + store + pure logic trong test
 * ============================================================================
 *  Node --test KHÔNG hiểu alias `@/` (tsconfig paths) và một số specifier chỉ
 *  sống trong Next runtime. Hook này CHỈ remap specifier → file thật trên đĩa
 *  (resolve-only), để Node tự strip type (.ts) như các unit test hiện có.
 *
 *  Remap:
 *    server-only            → stub no-op
 *    next/server            → stub NextResponse.json → Response
 *    @/lib/supabase/server  → stub fake client (đọc)
 *    @/lib/supabase/admin   → stub fake client (ghi/rpc)
 *    @/xxx                  → <src>/xxx (+ thử .ts / /index.ts)
 *    ./rel hoặc ../rel      → thêm .ts nếu thiếu đuôi (source dùng import extensionless)
 * ============================================================================
 */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve as pathResolve } from 'node:path';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));      // .../src/test-int
const srcDir = pathResolve(here, '..');                    // .../src
const stubs = {
  'server-only': pathToFileURL(pathResolve(here, 'stubs/server-only.mjs')).href,
  'next/server': pathToFileURL(pathResolve(here, 'stubs/next-server.mjs')).href,
  '@/lib/supabase/server': pathToFileURL(pathResolve(here, 'stubs/supabase-server.mjs')).href,
  '@/lib/supabase/admin': pathToFileURL(pathResolve(here, 'stubs/supabase-admin.mjs')).href,
};

function withTsExt(absPath) {
  if (existsSync(absPath)) return absPath;
  if (existsSync(absPath + '.ts')) return absPath + '.ts';
  if (existsSync(absPath + '.tsx')) return absPath + '.tsx';
  if (existsSync(pathResolve(absPath, 'index.ts'))) return pathResolve(absPath, 'index.ts');
  return absPath;
}

export async function resolve(specifier, context, nextResolve) {
  // 1) stub cố định
  if (stubs[specifier]) {
    return { url: stubs[specifier], shortCircuit: true };
  }

  // 2) alias @/ → src/
  if (specifier.startsWith('@/')) {
    const abs = withTsExt(pathResolve(srcDir, specifier.slice(2)));
    return { url: pathToFileURL(abs).href, shortCircuit: true };
  }

  // 3) relative import extensionless bên trong source (.ts) → thêm đuôi
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    const hasExt = /\.[a-z]+$/i.test(specifier);
    if (!hasExt) {
      const parentPath = fileURLToPath(context.parentURL);
      const abs = withTsExt(pathResolve(dirname(parentPath), specifier));
      if (abs.endsWith('.ts') || abs.endsWith('.tsx')) {
        return { url: pathToFileURL(abs).href, shortCircuit: true };
      }
    }
  }

  return nextResolve(specifier, context);
}
