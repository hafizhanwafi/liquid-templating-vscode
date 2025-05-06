# NW Templating

NW Templating adalah extension Visual Studio Code yang dirancang untuk mempermudah pengelolaan dan rendering file template berbasis Liquid. Extension ini mendukung validasi file JSON yang terhubung dengan template Liquid, preview hasil rendering secara langsung di webview, serta fitur seperti penyimpanan output, navigasi cepat ke file template dan data, serta mode pemantauan perubahan file dengan debounce untuk efisiensi.

---

## Fitur

- **Validasi File JSON**  
  Validasi otomatis untuk file `*.liquid-data.json` menggunakan skema JSON yang telah ditentukan.

- **Preview Template**  
  Preview hasil rendering template Liquid di panel webview.

- **Navigasi Cepat**  
  Navigasi langsung ke file template dan data melalui tautan interaktif di webview.

- **Penyimpanan Output**  
  Simpan hasil rendering ke file output dengan mudah.

- **Mode Pemantauan**  
  Pantau perubahan file dengan debounce untuk mencegah pemrosesan berulang.

- **Highlight Syntax**  
  Mendukung highlight syntax menggunakan Prism.js untuk berbagai bahasa.

---

## Cara Menggunakan

1. **Buka File JSON**  
   Buka file `*.liquid-data.json` di Visual Studio Code.

2. **Preview Template**  
   Klik tombol **Preview** untuk melihat hasil rendering template.

3. **Navigasi ke File**  
   Klik tautan pada template atau data untuk membuka file terkait.

4. **Simpan Output**  
   Klik tombol **Save** untuk menyimpan hasil rendering ke file output.

5. **Mode Pemantauan**  
   Aktifkan mode pemantauan untuk memproses perubahan file secara otomatis.

---

## Persyaratan

- Visual Studio Code versi `^1.99.0` atau lebih baru.
- File template berbasis Liquid dan file JSON yang sesuai.

---

## Pengaturan Extension

Extension ini tidak memiliki pengaturan tambahan. Namun, Anda dapat menyesuaikan skema JSON untuk validasi file `*.liquid-data.json`.

---

## Masalah yang Diketahui

- Tidak ada masalah yang diketahui saat ini. Jika Anda menemukan bug, silakan laporkan melalui [GitHub Issues](https://github.com/username/repository/issues).

---

## Catatan Rilis

### 0.0.1

- Rilis awal dengan fitur:
  - Validasi file JSON.
  - Preview hasil rendering template.
  - Navigasi cepat ke file template dan data.
  - Penyimpanan hasil rendering.

---

## Kontribusi

Kontribusi sangat diterima! Jika Anda ingin menambahkan fitur atau memperbaiki bug, silakan buat pull request di [GitHub Repository](https://github.com/username/repository).

---

## Lisensi

Extension ini dilisensikan di bawah [MIT License](https://opensource.org/licenses/MIT).