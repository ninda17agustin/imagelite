/**
 * ImageLite – App JavaScript
 * Semua proses kompresi gambar dilakukan di browser menggunakan Canvas API.
 * Tidak ada data yang dikirim ke server.
 */

"use strict";

/* =============================================
   DOM References
   ============================================= */
const fileInput        = document.getElementById("file-input");
const browseBtn        = document.getElementById("browse-btn");
const uploadZone       = document.getElementById("upload-zone");
const workspace        = document.getElementById("workspace");
const uploadCard       = document.getElementById("upload-card");

const originalPreview   = document.getElementById("original-preview");
const compressedPreview = document.getElementById("compressed-preview");
const resultPlaceholder = document.getElementById("result-placeholder");

const originalFilename   = document.getElementById("original-filename");
const originalSize       = document.getElementById("original-size");
const compressedFilename = document.getElementById("compressed-filename");
const compressedSize     = document.getElementById("compressed-size");

const qualitySlider  = document.getElementById("quality-slider");
const qualityValue   = document.getElementById("quality-value");
const presetBtns     = document.querySelectorAll(".preset-btn");

const compressBtn    = document.getElementById("compress-btn");
const resetBtn       = document.getElementById("reset-btn");
const downloadBtn    = document.getElementById("download-btn");
const homeBtn        = document.getElementById("home-btn");
const logoBtn        = document.getElementById("logo-btn");

const statsCard      = document.getElementById("stats-card");
const statOriginal   = document.getElementById("stat-original");
const statCompressed = document.getElementById("stat-compressed");
const statSavings    = document.getElementById("stat-savings");

const loadingOverlay = document.getElementById("loading-overlay");
const toast          = document.getElementById("toast");
const heroSection    = document.querySelector(".hero");

/* =============================================
   State
   ============================================= */
let originalFile      = null;
let compressedBlob    = null;
let originalFileSize  = 0;

/* =============================================
   Utility Functions
   ============================================= */

/** Format bytes ke KB / MB yang mudah dibaca */
function formatSize(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Hitung persentase penghematan */
function savingsPercent(original, compressed) {
  if (original === 0) return 0;
  return (((original - compressed) / original) * 100).toFixed(1);
}

/** Tampilkan toast notifikasi */
let toastTimer = null;
function showToast(message, duration = 3000) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
}

/** Update warna slider secara dinamis */
function updateSliderTrack(val) {
  qualitySlider.style.setProperty("--slider-pct", val + "%");
}

/* =============================================
   Event: Slider & Presets
   ============================================= */
qualitySlider.addEventListener("input", () => {
  const val = parseInt(qualitySlider.value);
  qualityValue.textContent = val + "%";
  updateSliderTrack(val);

  // Sync preset highlight
  presetBtns.forEach(btn => {
    btn.classList.toggle("active", parseInt(btn.dataset.quality) === val);
  });
});

presetBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    const val = parseInt(btn.dataset.quality);
    qualitySlider.value = val;
    qualityValue.textContent = val + "%";
    updateSliderTrack(val);
    presetBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

// Init slider track on load
updateSliderTrack(75);

/* =============================================
   Event: File Input & Drag-Drop
   ============================================= */
browseBtn.addEventListener("click", () => fileInput.click());
uploadZone.addEventListener("click", (e) => {
  if (e.target !== browseBtn && !browseBtn.contains(e.target)) {
    fileInput.click();
  }
});

fileInput.addEventListener("change", (e) => {
  if (e.target.files[0]) loadImage(e.target.files[0]);
});

uploadZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  uploadZone.classList.add("drag-over");
});
uploadZone.addEventListener("dragleave", () => {
  uploadZone.classList.remove("drag-over");
});
uploadZone.addEventListener("drop", (e) => {
  e.preventDefault();
  uploadZone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && isValidImage(file)) {
    loadImage(file);
  } else {
    showToast("❌ Format tidak didukung. Gunakan JPG atau PNG.");
  }
});

/** Validasi tipe file */
function isValidImage(file) {
  return ["image/jpeg", "image/jpg", "image/png"].includes(file.type);
}

/* =============================================
   Load & Preview Original Image
   ============================================= */
function loadImage(file) {
  if (!isValidImage(file)) {
    showToast("❌ Format tidak didukung. Gunakan JPG atau PNG.");
    return;
  }

  originalFile     = file;
  originalFileSize = file.size;

  const reader = new FileReader();
  reader.onload = (e) => {
    // Show original preview
    originalPreview.src = e.target.result;
    originalFilename.textContent = file.name;
    originalSize.textContent = formatSize(file.size);

    // Reset compressed side
    compressedPreview.style.display = "none";
    compressedPreview.src = "";
    resultPlaceholder.style.display = "flex";
    compressedFilename.textContent = "—";
    compressedSize.textContent = "—";

    // Reset stats
    statsCard.classList.add("hidden");
    statsCard.classList.remove("visible");
    compressedBlob = null;

    // Show workspace, hide upload card and hero section (halaman 2 space saving)
    uploadCard.classList.add("hidden");
    if (heroSection) heroSection.classList.add("hidden");
    workspace.classList.remove("hidden");

    showToast("✅ Gambar berhasil dimuat!");
  };
  reader.readAsDataURL(file);
}

/* =============================================
   Compress Image
   ============================================= */
compressBtn.addEventListener("click", compressImage);

function compressImage() {
  if (!originalFile) {
    showToast("⚠️ Pilih gambar terlebih dahulu.");
    return;
  }

  const quality = parseInt(qualitySlider.value) / 100;

  // Show loading
  loadingOverlay.classList.remove("hidden");

  // Small delay for UX feel
  setTimeout(() => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");

      // Optionally downscale jika gambar terlalu besar (lebih dari 4000px)
      let { width, height } = img;
      const MAX_DIM = 4000;
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width  = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width  = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Tentukan output MIME
      // PNG dikonversi ke JPEG untuk kompresi lebih baik (kecuali user pilih quality=100 → tetap PNG)
      const outputMime = originalFile.type === "image/png" && quality >= 1
        ? "image/png"
        : "image/jpeg";

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            loadingOverlay.classList.add("hidden");
            showToast("❌ Terjadi kesalahan saat kompresi. Coba lagi.");
            return;
          }

          compressedBlob = blob;

          // Show compressed preview
          const compressedURL = URL.createObjectURL(blob);
          compressedPreview.src = compressedURL;
          compressedPreview.style.display = "block";
          resultPlaceholder.style.display = "none";

          // Filename
          const ext = outputMime === "image/png" ? "png" : "jpg";
          const baseName = originalFile.name.replace(/\.[^.]+$/, "");
          compressedFilename.textContent = `${baseName}_lite.${ext}`;
          compressedSize.textContent = formatSize(blob.size);

          // Stats
          const savings = savingsPercent(originalFileSize, blob.size);
          statOriginal.textContent   = formatSize(originalFileSize);
          statCompressed.textContent = formatSize(blob.size);
          statSavings.textContent    = savings + "%";

          statsCard.classList.remove("hidden");
          // Force reflow for animation
          void statsCard.offsetWidth;
          statsCard.classList.add("visible");

          loadingOverlay.classList.add("hidden");

          if (blob.size >= originalFileSize) {
            showToast("💡 Ukuran tidak berkurang. Coba turunkan kualitas atau gambar sudah teroptimasi.");
          } else {
            showToast(`🎉 Berhasil! Hemat ${savings}% ukuran file.`);
          }
        },
        outputMime,
        quality
      );
    };
    img.onerror = () => {
      loadingOverlay.classList.add("hidden");
      showToast("❌ Gagal membaca gambar. Pastikan file tidak rusak.");
    };
    img.src = URL.createObjectURL(originalFile);
  }, 300);
}

/* =============================================
   Download
   ============================================= */
downloadBtn.addEventListener("click", () => {
  if (!compressedBlob) {
    showToast("⚠️ Kompres gambar terlebih dahulu.");
    return;
  }

  const ext      = compressedBlob.type === "image/png" ? "png" : "jpg";
  const baseName = originalFile.name.replace(/\.[^.]+$/, "");
  const filename = `${baseName}_lite.${ext}`;

  const a = document.createElement("a");
  a.href     = URL.createObjectURL(compressedBlob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);

  showToast(`⬇️ Download dimulai: ${filename}`);
});

/* =============================================
   Reset / Kembali ke Halaman Utama
   ============================================= */
function resetToHome(toastMessage = "🔄 Siap untuk gambar baru!") {
  originalFile     = null;
  compressedBlob   = null;
  originalFileSize = 0;
  fileInput.value  = "";

  originalPreview.src   = "";
  compressedPreview.src = "";
  compressedPreview.style.display = "none";
  resultPlaceholder.style.display = "flex";

  originalFilename.textContent   = "—";
  originalSize.textContent       = "—";
  compressedFilename.textContent = "—";
  compressedSize.textContent     = "—";

  statsCard.classList.add("hidden");
  statsCard.classList.remove("visible");

  workspace.classList.add("hidden");
  uploadCard.classList.remove("hidden");
  if (heroSection) heroSection.classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
  showToast(toastMessage);
}

resetBtn.addEventListener("click", () => resetToHome("🔄 Siap untuk gambar baru!"));
if (homeBtn) homeBtn.addEventListener("click", () => resetToHome("🏠 Kembali ke Halaman Utama"));
if (logoBtn) logoBtn.addEventListener("click", () => resetToHome("🏠 Kembali ke Halaman Utama"));

/* =============================================
   Keyboard Shortcut
   ============================================= */
document.addEventListener("keydown", (e) => {
  // Ctrl + Enter = Compress
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && originalFile) {
    e.preventDefault();
    compressImage();
  }
});

/* =============================================
   Prevent browser opening dropped files
   ============================================= */
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => e.preventDefault());
