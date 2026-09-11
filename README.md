# Panel macro Chile

Interfaz que consulta la API BDE del Banco Central de Chile y muestra, por cada indicador, su evolución en un gráfico y su valor actual al costado. Incluye un conversor entre pesos chilenos y UF, UTM y monedas extranjeras.

## Versiones

- **Computador**: `index.html`, con barra lateral y el valor actual al costado de cada gráfico.
- **Teléfono**: `movil.html`, con pizarra deslizable, tarjetas apiladas y navegación inferior.

En un teléfono, `index.html` abre automáticamente la versión móvil. Cada versión tiene un enlace para cambiar a la otra, y esa elección se recuerda.

## Secciones

| Sección | Contenido |
|---|---|
| Indicadores diarios | Dólar observado, euro, UF, UTM, TPM y swap cámara 90 días |
| Cuentas nacionales y actividad | IMACEC, PIB trimestral y anual, demanda interna, consumo privado y de gobierno, inversión, exportaciones e importaciones |
| Precios e inflación | IPC en 12 meses e IPC sin volátiles (con meta de 3%), IPC mensual |
| Sector externo y tipo de cambio | Balanza comercial, exportaciones e importaciones, cuenta corriente, reservas internacionales, tipo de cambio nominal y real |
| Mercado laboral y monetario | Tasa de desocupación, personas ocupadas, M1/M2/M3, colocaciones |
| Convertir | Monto en UF, UTM, dólar, euro, libra, yuan, yen, real, peso argentino, sol o peso mexicano ↔ pesos chilenos, en la fecha que elijas |

## Uso de los gráficos

- **¿Cómo se calcula?**: cada indicador tiene una explicación breve y un botón que despliega cómo se calcula, en palabras y en fórmulas.
- **Valores sincronizados**: al pasar el mouse (o tocar, en el teléfono) sobre un gráfico, la misma fecha se marca con su valor en todos los gráficos de la sección.
- **Zoom**: haz clic y arrastra de lado dentro de un gráfico para acercar ese rango de fechas en todos los gráficos. Doble clic, la tecla Escape o el botón «Quitar zoom» vuelven al período elegido.

## Usarlo en tu computador

1. Revisa que `.env` tenga `BCCH_USER` y `BCCH_PASS` (ver `.env.example`).
2. Haz doble clic en `iniciar.bat`, o ejecuta:

   ```bash
   py -3 server.py --abrir
   ```

3. El panel se abre en http://127.0.0.1:8050 (versión móvil en http://127.0.0.1:8050/movil.html).

No requiere instalar paquetes: usa solo la biblioteca estándar de Python 3.

> El `python` que viene con Inkscape no trae certificados raíz y falla al conectarse por HTTPS. Usa el lanzador `py` (Python oficial) o instala `certifi`.

## Publicarlo en GitHub Pages

GitHub Pages solo sirve archivos estáticos, y la clave de la API no puede quedar en el sitio. Por eso un GitHub Action descarga las series con las credenciales guardadas como secretos del repositorio, las guarda como JSON y publica la carpeta `static/`. La interfaz detecta sola si está en tu computador (usa `server.py`) o en GitHub Pages (usa los JSON publicados).

1. Crea un repositorio **público** y vacío en GitHub (Pages gratuito requiere repositorio público).
2. Sube este proyecto:

   ```bash
   git remote add origin https://github.com/USUARIO/REPOSITORIO.git
   git push -u origin main
   ```

3. En el repositorio, ve a **Settings → Secrets and variables → Actions → New repository secret** y crea dos secretos: `BCCH_USER` (tu correo de la API) y `BCCH_PASS` (tu clave).
4. Ve a **Settings → Pages** y en **Source** elige **GitHub Actions**.
5. Ve a **Actions → Actualizar datos y publicar → Run workflow**.

El sitio queda en `https://USUARIO.github.io/REPOSITORIO/` y la versión móvil en `https://USUARIO.github.io/REPOSITORIO/movil.html`.

Los datos se actualizan solos cerca de las 8:00, 12:00 y 20:00 (hora de Chile) y en cada push a `main`. GitHub pausa las tareas programadas de repositorios sin actividad por 60 días; si pasa, basta con reactivarlas en la pestaña Actions.

## Estructura

- `server.py`: servidor local y proxy hacia la API, con caché en `cache/` (30 minutos para series diarias, 6 horas para el resto). Si la API no responde, entrega la última copia guardada.
- `bcch_api.py`: cliente de la API compartido por el servidor local y el script de publicación.
- `actualizar_datos.py`: descarga todas las series a `static/data/` (lo usa GitHub Actions).
- `.github/workflows/publicar.yml`: actualización programada y publicación en GitHub Pages.
- `static/index.html` y `static/movil.html`: versiones para computador y teléfono; `base.css` es común, `desktop.css` y `mobile.css` son propios de cada versión.
- `static/indicators.js`: catálogo de secciones, series, formatos y unidades del conversor. Para agregar o cambiar series, edita este archivo: el script de publicación toma de aquí los códigos BDE.
- `static/explanations.js`: resumen y explicación de cálculo (palabras y fórmulas TeX) de cada indicador.
- `static/app.js`, `static/plot.js` y `static/converter.js`: lógica de la interfaz, gráficos y conversor.
