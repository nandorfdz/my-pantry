import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Cuando corres "npm run dev", las rutas /api no existen (son funciones
      // serverless de Vercel). Si usas "vercel dev" en su lugar, esto no se usa.
    },
  },
});
