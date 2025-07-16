<div style="max-width: 900px; margin: auto; padding: 2rem; background-color: #1e293b; color: #e2e8f0; font-family: 'Segoe UI', sans-serif; border-radius: 1rem; box-shadow: 0 0 30px rgba(0,255,136,0.15);">

  <h1 style="color: #00ff88;">HyperStorage6D Multicapa</h1>
  <p>Compresión real de archivos con algoritmos avanzados implementados en JavaScript. Inspirado en arquitecturas de codificación de 6 dimensiones para almacenamiento eficiente a nivel de bit.</p>
  
  <p>🌐 <strong>Sitio en vivo:</strong> <a href="https://arnaldozpy.github.io/hS6Dv2/" target="_blank" style="color:#00ff88;">https://arnaldozpy.github.io/hS6Dv2/</a></p>

  <hr style="border-color: #334155; margin: 2rem 0;">

  <h2 style="color: #00ff88;">🔍 ¿Qué hace este sistema?</h2>
  <p>Permite subir, comprimir y descomprimir archivos reales desde el navegador utilizando una arquitectura multicapa:</p>

  <hr style="border-color: #334155; margin: 2rem 0;">

  <h2 style="color: #00ff88;">⚙️ Características principales</h2>
  <ul>
    <li>✅ Compresión y descompresión real (bit a bit)</li>
    <li>📥 Carga de archivos en tiempo real</li>
    <li>📊 Visualización de tamaño original, comprimido y porcentaje de compresión</li>
    <li>📂 Descarga del archivo .hs6d comprimido</li>
    <li>🔁 Recuperación exacta del archivo original</li>
    <li>⚙️ 100% en JavaScript puro, compatible con HTML y plataformas web</li>
  </ul>

  <hr style="border-color: #334155; margin: 2rem 0;">

  <h2 style="color: #00ff88;">📊 Comparativa de compresión</h2>
  <p><strong>Archivo original:</strong> 3.81 MB (3,808,689 bytes)</p>
  <table style="width: 100%; border-collapse: collapse; background-color: #0f172a; border: 1px solid #334155; margin-top: 1rem;">
    <thead>
      <tr style="background-color: #334155;">
        <th style="padding: 0.5rem; border: 1px solid #334155;">Compresor</th>
        <th style="padding: 0.5rem; border: 1px solid #334155;">Tamaño Comprimido</th>
        <th style="padding: 0.5rem; border: 1px solid #334155;">Ratio</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding: 0.5rem; border: 1px solid #334155;">Gzip</td>
        <td style="padding: 0.5rem;">952,335 bytes</td>
        <td style="padding: 0.5rem;">25.0 %</td>
      </tr>
      <tr>
        <td style="padding: 0.5rem; border: 1px solid #334155;">Bzip2</td>
        <td style="padding: 0.5rem;">719,404 bytes</td>
        <td style="padding: 0.5rem;">18.9 %</td>
      </tr>
      <tr>
        <td style="padding: 0.5rem; border: 1px solid #334155;">XZ (LZMA)</td>
        <td style="padding: 0.5rem;">676,956 bytes</td>
        <td style="padding: 0.5rem;">17.8 %</td>
      </tr>
      <tr style="background-color: #00ff8866;">
        <td style="padding: 0.5rem;"><strong>HyperStorage6D</strong></td>
        <td style="padding: 0.5rem;">705,736 bytes</td>
        <td style="padding: 0.5rem;"><strong>18.5 % ✅</strong></td>
      </tr>
    </tbody>
  </table>

  <hr style="border-color: #334155; margin: 2rem 0;">

  <h2 style="color: #00ff88;">🧪 Cómo usar</h2>
  <ol>
    <li><strong>Subir un archivo:</strong><br>
      Haz clic en <em>“Comprimir Archivo”</em> y subí cualquier archivo .txt, .json, .csv, etc.<br>
      Verás el tamaño original, comprimido y el porcentaje logrado.
    </li>
    <li><strong>Descargar el archivo .hs6d:</strong><br>
      Se genera un botón para descargar automáticamente el archivo comprimido.
    </li>
    <li><strong>Descomprimir:</strong><br>
      En la sección <em>“Descomprimir Archivo”</em> podés subir un archivo .hs6d generado por el sistema y recuperar el original.
    </li>
  </ol>

  <hr style="border-color: #334155; margin: 2rem 0;">

  <h2 style="color: #00ff88;">📁 Estructura del Proyecto</h2>
  <pre style="background-color: #0f172a; padding: 1rem; border-radius: 0.5rem; overflow-x: auto;">
📦 hS6Dv2/
├── index.html              # Interfaz visual principal
├── index-main.js           # Lógica completa de compresión y descompresión
├── bwt-rle.js              # Capa 3: Burrows-Wheeler + RLE
├── hyper-huffman.js        # Capa 4: Árbol de Huffman adaptativo
├── style.css               # Estilos personalizados
  </pre>

  <hr style="border-color: #334155; margin: 2rem 0;">

  <h2 style="color: #00ff88;">🚀 Próximas mejoras</h2>
  <ul>
    <li>📐 Visualización del Árbol de Huffman en tiempo real</li>
    <li>🔄 Capa 2 predictiva adaptativa mejorada</li>
    <li>🧪 Comparativa en vivo contra ZIP, BZ2, GZIP</li>
    <li>💽 Módulo exportable para Python / Rust / C++</li>
    <li>🔏 Validación técnica para aplicación en sistemas operativos</li>
  </ul>

  <hr style="border-color: #334155; margin: 2rem 0;">

  <h2 style="color: #00ff88;">👤 Autor</h2>
  <p>
    <strong>Arnaldo Adrian Ozorio Olea</strong><br>
    📍 Capiatá - Paraguay<br>
    📧 <a href="mailto:asesor.teducativo@gmail.com" style="color:#00ff88;">asesor.teducativo@gmail.com</a><br>
    🔗 <a href="https://github.com/ArnaldOzPy" target="_blank" style="color:#00ff88;">github.com/ArnaldOzPy</a>
  </p>

  <hr style="border-color: #334155; margin: 2rem 0;">

  <h2 style="color: #00ff88;">📄 Licencia</h2>
  <p>
    Este proyecto está en proceso de registro y protección como parte de la arquitectura <strong>HyperStorage6D - Almacenamiento 1Bit-6D</strong>.<br>
    El uso comercial sin autorización está prohibido y protegido por ley.
  </p>

</div>
