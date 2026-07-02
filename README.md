# My Pantry 🌽

App personal de inventario de alacena con recomendaciones de comida usando IA, escaneo de tickets de supermercado, y una pestaña de comunidad opcional.

## ¿Qué necesitas?

- [Node.js](https://nodejs.org) 18 o superior.
- Una **API key de Anthropic** (obligatoria, para el escaneo de tickets y las recomendaciones). Se obtiene gratis con saldo de prueba en [console.anthropic.com](https://console.anthropic.com).
- (Opcional) Una base de datos **Upstash Redis** gratuita, solo si quieres que la pestaña "Comunidad" funcione de verdad entre varias personas. Se crea en [upstash.com](https://upstash.com).

## 1. Instalar dependencias

```bash
npm install
```

## 2. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto (copia `.env.example`) con:

```
ANTHROPIC_API_KEY=sk-ant-tu-llave-aqui
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

- `ANTHROPIC_API_KEY` es obligatoria. Sin ella, el escaneo de tickets y las recomendaciones no van a funcionar.
- Las dos variables de Upstash son **opcionales**. Si las dejas vacías, todo lo personal (alacena, diario, recomendaciones) funciona perfecto — solo la pestaña "Comunidad" mostrará un aviso de que no está configurada.

## 3. Correr en tu computadora

Las carpetas `/api` son funciones serverless de Vercel, así que el comando normal de Vite (`npm run dev`) no las ejecuta. Para probar todo localmente, incluyendo el escaneo de tickets y las recomendaciones, usa la CLI de Vercel:

```bash
npm install -g vercel
vercel dev
```

Esto te da una URL local (normalmente `http://localhost:3000`) con la app completa, incluyendo las funciones de `/api`.

Si solo quieres ver la interfaz sin la IA, `npm run dev` (Vite) también funciona, pero los botones que llaman a la IA mostrarán un error de conexión.

## 4. Desplegar (recomendado: Vercel)

1. Sube esta carpeta a un repositorio de GitHub.
2. Entra a [vercel.com](https://vercel.com), conecta tu cuenta de GitHub e importa el repositorio.
3. Vercel detecta automáticamente que es un proyecto Vite + funciones serverless. No necesitas configurar nada más.
4. En **Project Settings → Environment Variables**, agrega las mismas variables del paso 2 (`ANTHROPIC_API_KEY` y, si quieres comunidad, las de Upstash).
5. Despliega. Listo — tendrás una URL pública (puedes agregarla a la pantalla de inicio de tu celular como si fuera una app).

También funciona en Netlify, pero la configuración de funciones serverless es distinta (Netlify Functions en vez de la carpeta `/api`); si prefieres Netlify, dime y te ayudo a adaptarlo.

## Cómo están organizados los datos

- **Tu alacena, diario y ajustes**: se guardan en `localStorage` de tu navegador. Viven solo en ese dispositivo/navegador — si abres la app en otro celular, no los verás ahí (a propósito, para que sea simple y privado).
- **Comunidad** (feed, usuarios públicos, alacenas públicas): vive en tu base de datos de Upstash, visible para cualquiera que use tu despliegue de la app. Tú decides, desde la pestaña Comunidad, si activar "compartir alacena" o "compartir comidas" — por defecto todo está desactivado.

## Límites a tener en cuenta

- Las fotos de tickets muy grandes (más de ~4 MB en base64) pueden fallar por el límite de tamaño de las funciones serverless de Vercel. Si pasa, intenta con una foto más comprimida o recortada.
- La estimación nutricional con IA es una aproximación razonable, no un dato de laboratorio certificado.
- Si compartes el link de tu app desplegada con otras personas, todas comparten la misma base de datos de Comunidad (no hay cuentas/login separados) — bueno para un grupo pequeño de confianza, no pensado para una audiencia masiva.

## Siguientes pasos posibles

- Código de invitación para que "Comunidad" sea privada a un grupo en vez de abierta a quien tenga el link.
- Comprimir imágenes de tickets antes de subirlas (para evitar el límite de tamaño).
- Gráficas de tendencia semanal de macros.
- Inicio de sesión real (para que tu alacena te siga entre dispositivos).
