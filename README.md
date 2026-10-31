# Agenda Pro

Agenda profesional para el celular, con calendario, prioridades, categorías, actividades que se repiten y recordatorios insistentes que siguen sonando hasta que marcas la actividad como **realizada**.

- `server/`: API en Node/Express conectada a PostgreSQL (Neon). La llave de la base de datos solo vive aquí.
- `mobile/`: app en Expo (React Native) para Android/iOS.

## Recordatorios

Cada actividad puede tener varios avisos (2 días antes, 1 día antes, 3 h, 1 h, 30, 15 o 5 min antes y a la hora).
Con **Insistir** activado, después de la hora sigue avisando cada 15/30/60/120/180 min (solo de 7:00 a 22:00 y hasta 3 días)
hasta que toques **✅ Realizado** en la notificación o en la app. **⏰ Recordar en 10 min** pospone el aviso.

## Ejecutar en la PC

```bash
# 1. Servidor
cd server
npm install
# crea server/.env con:
#   DATABASE_URL=postgresql://...neon.tech/neondb?sslmode=verify-full&channel_binding=require
#   API_KEY=una-clave-larga-secreta
npm start

# 2. App (celular conectado por USB con depuración activada y Expo Go instalado)
cd mobile
npm install --legacy-peer-deps
# crea mobile/.env con:
#   EXPO_PUBLIC_API_URL=http://localhost:3000
#   EXPO_PUBLIC_API_KEY=la-misma-clave-del-servidor
adb reverse tcp:8081 tcp:8081
adb reverse tcp:3000 tcp:3000
npx expo start --localhost --android
```

## Usarla sin la PC (servidor en la nube)

1. Sube este repositorio a GitHub (los archivos `.env` están ignorados y no se suben).
2. En [render.com](https://render.com), elige **New → Blueprint**, conecta el repo y Render leerá `render.yaml`.
3. Llena `DATABASE_URL` y `API_KEY` con los mismos valores de `server/.env`.
4. En la app, ve a **Ajustes → Servidor**, pon la URL que te da Render (`https://agenda-pro-api.onrender.com`) y toca **Guardar y probar conexión**.

## Instalar como app propia (APK)

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

Con eso obtienes un APK instalable que ya no necesita Expo Go.
