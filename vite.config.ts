import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load every env var (no prefix filter) so we can read the Supabase
  // integration vars, which are NEXT_PUBLIC_* / unprefixed rather than VITE_*.
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };

  const supabaseUrl =
    env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '';
  const supabaseAnonKey =
    env.VITE_SUPABASE_ANON_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    env.SUPABASE_ANON_KEY ||
    '';

  return {
    // Inject resolved values so the browser bundle always has a real URL/key,
    // regardless of which prefix the host platform provisioned.
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
      include: ['recharts', 'recharts/lib/cartesian/CartesianAxis'],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            recharts: ['recharts'],
          },
        },
      },
    },
  };
});
