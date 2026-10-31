# Agenda Pro

Agenda profesional para Android, con calendario, prioridades, categorías, actividades que se repiten y recordatorios insistentes que siguen sonando hasta que marcas la actividad como **realizada**.

- `mobile/`: la app (Expo / React Native). Se instala como APK y se conecta directo a Neon por HTTPS.
- `server/`: API opcional en Node/Express. La app ya no la necesita; también sirve para administrar la base con el usuario dueño.

## Recordatorios

Cada actividad puede tener varios avisos: 2 días antes, 1 día antes, 3 h, 1 h, 30, 15 o 5 min antes y a la hora.
Con **Insistir** activado, después de la hora te sigue avisando cada 15/30/60/120/180 min (solo de 7:00 a 22:00 y hasta 3 días)
hasta que toques **✅ Realizado** en la notificación o en la app. **⏰ Recordar en 10 min** pospone el aviso.
Los avisos se programan en el propio celular, así que suenan aunque no tengas internet.

## Base de datos

La app usa el usuario de Neon `agenda_app`, que **solo** puede leer y escribir la tabla `events` (no puede crear ni borrar tablas).
Su conexión va en `mobile/.env` (no se sube a GitHub):

```
EXPO_PUBLIC_DATABASE_URL=postgresql://agenda_app:CLAVE@ep-...-pooler....neon.tech/neondb?sslmode=require
```

La tabla `events` la crea `server/index.js` al iniciarse (`npm start` en `server/`, usando la llave de dueño en `server/.env`).

## Compilar e instalar el APK

Requisitos: Android Studio (SDK + JDK 21) y el celular con depuración USB activada.

```powershell
cd mobile
npm install --legacy-peer-deps
npx expo prebuild -p android
cd android
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
.\gradlew.bat assembleRelease -PreactNativeArchitectures=arm64-v8a
adb install -r app\build\outputs\apk\release\app-release.apk
```

El APK queda en `mobile/android/app/build/outputs/apk/release/app-release.apk`; también puedes pasarlo al celular y abrirlo para instalarlo.

## Desarrollo (con recarga en vivo)

```bash
cd mobile
npx expo start
```

### Nota para Windows: rutas largas

Si la compilación falla con `Filename longer than 260 characters`, compila desde una ruta corta (por ejemplo `C:\ap\m`)
y usa ninja 1.12 o superior: copia `Sdk\cmake\3.22.1` a `C:\ap\cmake`, reemplaza `bin\ninja.exe` por el de
[ninja-build v1.12.1](https://github.com/ninja-build/ninja/releases/tag/v1.12.1) y añade `cmake.dir=C\:\ap\cmake` a `android/local.properties`.
