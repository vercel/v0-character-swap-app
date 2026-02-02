# Plan: Background Video Processing con Web Worker

## Problema Actual
Cuando el usuario graba un video, el procesamiento con ffmpeg.wasm bloquea la UI y el usuario ve un overlay de "Processing video" sin poder interactuar.

## Solución
Usar un **Web Worker** para mover el procesamiento de ffmpeg.wasm fuera del main thread, permitiendo que el usuario continúe interactuando mientras el video se procesa en segundo plano.

## Cambios a Implementar

### 1. Crear Worker (`lib/video-processor.worker.ts`)
- Mover lógica de ffmpeg a un Web Worker dedicado
- Comunicación via postMessage con progress updates

### 2. Modificar `hooks/use-video-processor.ts`
- Crear y gestionar el Web Worker
- Exponer Promise que resuelve cuando termina
- No bloquear el main thread

### 3. Modificar `hooks/use-video-recording.ts`
- Mostrar video original inmediatamente
- Procesar en background sin bloquear
- Subir cuando esté listo

### 4. Modificar `app/page.tsx`
- Quitar overlay bloqueante de "Processing video"
- Permitir interacción mientras procesa

## Status: COMPLETADO
