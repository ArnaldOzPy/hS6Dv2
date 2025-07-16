 HyperStorage6D Multicapa

Compresión real de archivos con algoritmos avanzados implementados en JavaScript. Inspirado en arquitecturas de codificación de 6 dimensiones para almacenamiento eficiente a nivel de bit.

🌐 Sitio en vivo: https://arnaldozpy.github.io/hS6Dv2/


 ¿Qué hace este sistema?

Permite subir, comprimir y descomprimir archivos reales desde el navegador utilizando una arquitectura multicapa:

Capa	Técnica Usada	Función

1	Mapeo Fibonacci por cuadrantes	Selección y análisis de bits estratégicos para reducción predictiva
2	Predictivo adaptativo (en desarrollo)	Análisis de patrones de redundancia intra-capa
3	BWT + RLE	Agrupación de patrones + codificación por repeticiones
4	Huffman adaptativo	Codificación final basada en árbol de frecuencia



---

 Características principales

✅ Compresión y descompresión real (bit a bit)

📥 Carga de archivos en tiempo real

📊 Visualización de tamaño original, comprimido y porcentaje de compresión

📂 Descarga del archivo .h6d comprimido

🔁 Recuperación exacta del archivo original

⚙️ 100% en JavaScript puro, compatible con HTML y plataformas web


---

📊 Comparativa de compresión del archivo

Archivo original: 3.81 MB (3,808,689 bytes)

Compresor	Tamaño       Comprimido	Ratio (%)

Gzip	      952,335 bytes 	 25.0 %
Bzip2	     719,404 bytes	  18.9 %
XZ (LZMA) 	676,956 bytes	  17.8 %
HyperStorage6D	705,736 bytes	18.5 % ✅


---

 Cómo usar

🧪 1. Subir un archivo:

Haz clic en "Comprimir Archivo"

Sube cualquier archivo .txt, .json, .csv, etc.

El sistema comprimirá automáticamente y mostrará:

Tamaño original

Tamaño comprimido

Porcentaje de compresión lograda



📤 2. Descargar el archivo .h6d

Se generará un botón para descargar el archivo comprimido con extensión .h6d.


🔁 3. Descomprimir

En la sección "Descomprimir .h6d"

Sube un archivo .h6d generado por este sistema

Verás el tamaño recuperado y podrás descargar el archivo original



---

 Estructura del Proyecto

📦 hS6Dv2/
├── index.html              # Interfaz visual principal
├── index-main.js           # Lógica completa de compresión y descompresión
├── bwt-rle.js              # Capa 3: Burrows-Wheeler Transform + Run Length Encoding
├── hyper-huffman.js        # Capa 4: Árbol de Huffman adaptativo
├── style.css (opcional)   # Estilos personalizados


---

---

 Próximas mejoras

📐 Visualización del Árbol de Huffman en tiempo real

🔄 Capa 2 predictiva adaptativa mejorada

🧪 Comparativa en vivo contra ZIP, BZ2, GZIP

💽 Módulo exportable para Python / Rust / C++

🔏 Validación técnica para aplicación en sistemas operativos



---

 Autor

Arnaldo Adrian Ozorio Olea
📍 Capiatá - Paraguay
📧 asesor.teducativo@gmail.com
🔗 https://github.com/ArnaldOzPy


---

 Licencia

Este proyecto se encuentra en proceso de registro y protección de propiedad intelectual como parte de la arquitectura HyperStorage6D - Almacenamiento 1Bit-6D.
Su uso sin autorización para fines comerciales queda restringido y penalizado conforme a la legislación vigente.
