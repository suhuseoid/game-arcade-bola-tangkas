# Game Arcade Bola Tangkas

> ⚠️ **Hanya untuk hiburan dan nostalgia. Tidak ada uang sungguhan.**
> Baca [Disclaimer](#%EF%B8%8F-disclaimer--penafian) sebelum memakai kode ini.

Game kartu bergaya mesin arcade **bola tangkas** yang dulu banyak dijumpai di Indonesia
(keluarga 7PK & Joker Poker). Serasa kembali ke nostalgia era 80-an, dengan tampilan neo-retro
dan musik chiptune orisinal, berjalan sepenuhnya di browser. Hanya untuk hiburan mengisi waktu luang.

**▶ Main sekarang:** [suhuseoid.github.io/game-arcade-bola-tangkas](https://suhuseoid.github.io/game-arcade-bola-tangkas/)

## Fitur

- 7 kartu, mode **Pakai Joker** (dek 53) dan **Tanpa Joker** (dek 52)
- Tombol **Tambah** (taruhan 2×), **Buka**, **Ambil**, dan **Double** (tebak kecil/besar)
- Tampilan neo-retro, animasi kartu, efek visual, dan musik chiptune buatan sendiri
- **100% offline**: tanpa server, tanpa akun, tanpa pembayaran
- Kredit hanya angka permainan yang tersimpan di browser Anda (`localStorage`), **tidak bernilai uang**
  dan tidak bisa dibeli, ditukar, atau dicairkan

## Cara main

1. Unduh atau clone repositori ini.
2. Buka `index.html` di browser. Tidak perlu build atau server.
3. Pilih mode, pasang taruhan kredit (1–50), tekan **MAIN**.
4. Pilih **TAMBAH** atau **BUKA** untuk membuka 2 kartu terakhir.
5. Dari 7 kartu diambil 5 kartu terbaik. Jika menang: **AMBIL** atau **DOUBLE**.

| Kombinasi | Pakai Joker | Tanpa Joker |
|---|---:|---:|
| Five of a Kind | 150× | – |
| Royal Flush | 80× | 500× |
| Straight Flush | 30× | 100× |
| Four of a Kind | 10× | 30× |
| Full House | 4× | 6× |
| Flush | 3× | 4× |
| Straight | 2× | 3× |
| Three of a Kind | 1× | 2× |
| Two Pair | 1× | 1× |

Font diambil dari Google Fonts saat online; saat offline browser memakai font cadangan.

## Struktur

| File | Isi |
|---|---|
| `index.html` | Halaman game |
| `style.css` | Tampilan neo-retro |
| `js/engine.js` | Logika murni: dek, penilaian kombinasi, alur ronde |
| `js/ui.js` | Tampilan, tombol, animasi, keyboard, penyimpanan kredit |
| `js/effects.js` | Efek visual |
| `js/sound.js` | Musik & efek suara chiptune (Web Audio) |

## ⚖️ Disclaimer / Penafian

**Bahasa Indonesia**

1. Proyek ini dibuat **semata-mata untuk hiburan, nostalgia, dan pembelajaran pemrograman**.
   Game ini tidak melibatkan uang sungguhan dalam bentuk apa pun.
2. **Segala bentuk penyalahgunaan** kode ini, termasuk namun tidak terbatas pada penggunaan untuk
   **perjudian**, taruhan dengan uang atau barang bernilai, penipuan, atau kegiatan lain yang
   **melanggar hukum**, **sepenuhnya menjadi tanggung jawab pihak yang menyalahgunakannya** dan
   **bukan tanggung jawab suhuseoid** selaku pembuat.
3. Perjudian dilarang oleh hukum di Indonesia dan di banyak negara lain. Setiap pengguna wajib
   mematuhi hukum yang berlaku di wilayahnya.
4. suhuseoid tidak mengoperasikan, mendukung, atau berafiliasi dengan situs perjudian mana pun,
   dan tidak memberikan izin penggunaan nama atau karya ini untuk tujuan tersebut.
5. Kode ini disediakan **"sebagaimana adanya"** tanpa jaminan apa pun. Lihat [LICENSE](LICENSE).

**English**

This project is made **solely for entertainment, nostalgia, and learning purposes** and involves no
real money. **Any misuse** of this code, including for **gambling**, wagering money or items of value,
fraud, or any other **unlawful activity**, is **solely the responsibility of the person misusing it
and not the responsibility of suhuseoid**. Gambling is prohibited in Indonesia and many other
jurisdictions; users must comply with the laws that apply to them. The code is provided "as is",
without warranty of any kind.

## Lisensi

[MIT](LICENSE) dengan pemberitahuan tambahan tentang penggunaan yang sah. © 2026 suhuseoid
