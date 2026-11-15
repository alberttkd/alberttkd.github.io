# Portafolio web · Albert Johan Herrera Sánchez

Sitio estático con la vista general y las hojas de proyecto, en español, inglés y alemán.

- **Sitio publicado:** <https://alberttkd.github.io/>
- **Alojamiento:** GitHub Pages (gratuito), desplegado con GitHub Actions en cada `push` a `main`.
- **Sin dependencias:** solo hace falta [Node.js](https://nodejs.org) 18 o superior para generar el sitio. No hay `npm install`.

## Cómo está organizado

```
content/
  site.json            Perfil, datos de contacto, textos de la interfaz y "otros proyectos"
  projects/            Un archivo .json por proyecto (el orden alfabético es el orden en la web)
  diagrams/            Diagramas SVG de las tiras de los recuadros
assets/
  css/site.css         Diseño (sistema visual "Messbild" adaptado a pantalla)
  img/                 Figuras y tiras
  fonts/               Fuentes locales
build.mjs              Genera el sitio en dist/ a partir de content/ y assets/
tools/check.mjs        Comprueba enlaces, imágenes e idioma del sitio generado
.github/workflows/     Despliegue automático en GitHub Pages
```

El contenido y las traducciones están en `content/`; la estructura y el diseño, en `build.mjs` y
`assets/css/site.css`. Para editar textos o proyectos no hace falta tocar estos dos últimos.

## Editar y publicar

1. Edita los archivos de `content/` (en tu equipo o directamente en GitHub con el botón del lápiz).
2. Opcional, para ver el resultado antes de publicar:

   ```bash
   node build.mjs --serve
   ```

   y abre <http://localhost:4173/>. Si falta una traducción, el generador lo avisa en la terminal.
3. Publica:

   ```bash
   git add -A
   git commit -m "Actualiza contenido"
   git push
   ```

   GitHub Actions genera el sitio y lo publica en uno o dos minutos. El estado se ve en la pestaña
   **Actions** del repositorio. La carpeta `dist/` no se sube: se genera en cada despliegue.

## Textos e idiomas

Cualquier texto puede escribirse de dos formas:

```json
"stack": "Python, PyQGIS, GDAL"
```

si es igual en todos los idiomas, o bien con una versión por idioma:

```json
"kind": { "es": "Proyecto de curso", "en": "Course project", "de": "Studienprojekt" }
```

Dentro de un texto se puede usar `**negrita**` y `` `código` ``. Los decimales se escriben como
corresponde a cada idioma (`"es": "3,21"`, `"en": "3.21"`).

## Añadir un proyecto

1. Copia un archivo de `content/projects/` (por ejemplo `06-supia-risk.json`) con un nombre nuevo,
   como `07-mi-proyecto.json`. El prefijo numérico decide el orden; el número que se muestra en la
   web (01, 02, ...) se calcula solo.
2. Cambia `slug`: será la dirección de la página (`/es/mi-proyecto/`). Solo minúsculas, números y guiones.
3. Rellena los campos:

   | Campo | Dónde aparece |
   |---|---|
   | `title`, `kind`, `summary`, `stack` | Recuadro de la vista general y cabecera de la hoja |
   | `strip` | Tira superior del recuadro: `{"img": "assets/img/....jpg", "caption": ...}` o `{"svg": "nombre", ...}` para un diagrama de `content/diagrams/` |
   | `repo` | URL del repositorio **solo si es público**. Si es privado, pon `null` y explica el motivo en `repoNote` |
   | `headline`, `lead`, `notice` | Título, entradilla y aviso de estado (opcional) de la hoja |
   | `metric`, `facts` | Cifra protagonista y cifras secundarias |
   | `story` | `problem`, `approach`, `result` |
   | `meta` | Ficha: pares `label` / `value` (rol, herramientas, licencia...) |
   | `blocks` | Contenido ampliado, en el orden en que debe aparecer |
   | `credits` | Datos y atribuciones |

4. Tipos de bloque disponibles en `blocks`:

   | `type` | Contenido |
   |---|---|
   | `figure` | Una figura: `src`, `alt`, `caption`, `credit`. Opciones: `plate` (lámina blanca con filete), `narrow` (estrecha, con el pie al lado), `wide` (se puede desplazar en móviles), `full` (ancho completo) |
   | `figures` | Varias figuras en paralelo: `items: [ ...figuras... ]` |
   | `steps` | Pasos numerados: `items: [{ "title", "text" }]` |
   | `lists` | Listas en columnas: `items: [{ "title", "items": [ ... ] }]` |
   | `table` | Tabla: `head`, `rows`, `note`; `emphasis` resalta una fila (empieza en 0); `stack` la apila en móviles |
   | `text` | Párrafos: `paragraphs: [ ... ]` |

   Todos admiten `title` e `intro`.

5. Imágenes: guárdalas en `assets/img/` (ancho máximo recomendado: 1600 px; JPG para mapas y
   fotografías, PNG para gráficos) y escribe la ruta en `src`. Si la figura lleva rótulos, se puede
   dar una versión por idioma: `"src": { "de": "assets/img/x-de.png", "en": "assets/img/x-en.png" }`.
   Si falta un idioma se usa la versión inglesa y la web añade una nota.
   Cada figura necesita `alt` (descripción para lectores de pantalla), `caption` y, si usa datos de
   terceros, `credit` con la atribución que exija su licencia.

Para **quitar** un proyecto, borra su archivo. Para **reordenar**, cambia el prefijo numérico.

## Añadir o quitar un idioma

En `content/site.json`, añade el código a `languages` (por ejemplo `"fr"`) y la clave `"fr"` en los
textos de `ui`, `profile` y `more`. Después añade `"fr"` a los textos de cada proyecto. Mientras
falte alguna traducción, el generador usa el inglés como reserva y lo avisa.

## Datos generales

`content/site.json` contiene el nombre, el correo, los enlaces de LinkedIn y GitHub, la introducción,
los datos de disponibilidad e idiomas, la fecha de actualización (`updated`) y la dirección pública
(`baseUrl`). Si el sitio se muda a otra dirección, hay que cambiar `baseUrl`: se usa para el mapa del
sitio y las etiquetas `canonical` y `hreflang`. Las rutas internas son relativas, así que el sitio
funciona igual en un subdirectorio.

## Reglas de contenido

- Solo cifras y afirmaciones comprobables en el repositorio o en el flyer de cada proyecto.
- No enlazar repositorios privados.
- Mantener el estado de cada proyecto (prototipo, proyecto de curso, manuscrito...), sus coautores
  y sus límites tal como los declara la fuente.
- Mantener las atribuciones de datos (por ejemplo «DOP20 © GeoSN, dl-de/by-2-0» y «Contains
  modified Copernicus Sentinel data»).
- El sitio no publica teléfono, dirección postal ni fecha de nacimiento.

## Licencias

Las fuentes de `assets/fonts/` (Archivo, IBM Plex Sans, IBM Plex Mono) se distribuyen bajo la SIL
Open Font License 1.1. Los textos y las figuras pertenecen a sus autores; los datos de terceros
conservan la licencia indicada en cada página.
