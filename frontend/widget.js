/**
 * AI Smile Preview widget — client logic.
 *
 * Everything is scoped inside an IIFE and looks up elements within
 * #smile-preview-widget only, so this can safely sit alongside other
 * scripts on a Squarespace page.
 *
 * CONFIGURE ME: set this to your deployed backend's base URL
 * (e.g. the Render service URL). No trailing slash.
 */
(function () {
  'use strict';

  var SMILE_API_BASE_URL = window.SMILE_API_BASE_URL || 'https://your-backend.onrender.com';

  var MAX_FILE_BYTES = 8 * 1024 * 1024; // keep in sync with backend MAX_UPLOAD_MB
  var ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  var root = document.getElementById('smile-preview-widget');
  if (!root) return; // widget markup not present on this page

  // ---- element lookups -------------------------------------------------
  var steps = {
    upload: root.querySelector('[data-step="upload"]'),
    loading: root.querySelector('[data-step="loading"]'),
    result: root.querySelector('[data-step="result"]'),
  };

  var dropzone = root.querySelector('#spwDropzone');
  var fileInput = root.querySelector('#spwFileInput');
  var dropzoneEmpty = root.querySelector('#spwDropzoneEmpty');
  var previewWrap = root.querySelector('#spwPreviewWrap');
  var previewImg = root.querySelector('#spwPreviewImg');
  var removeBtn = root.querySelector('#spwRemoveBtn');
  var consentCheckbox = root.querySelector('#spwConsent');
  var generateBtn = root.querySelector('#spwGenerateBtn');
  var errorEl = root.querySelector('#spwError');
  var privacyLink = root.querySelector('#spwPrivacyLink');
  var privacyNote = root.querySelector('#spwPrivacyNote');

  var beforeImg = root.querySelector('#spwBeforeImg');
  var afterImg = root.querySelector('#spwAfterImg');
  var compareAfter = root.querySelector('#spwCompareAfter');
  var compareHandle = root.querySelector('#spwCompareHandle');
  var compareSlider = root.querySelector('#spwCompareSlider');
  var downloadBtn = root.querySelector('#spwDownloadBtn');
  var restartBtn = root.querySelector('#spwRestartBtn');

  var selectedFile = null;
  var resultDataUrl = null;

  // ---- helpers -----------------------------------------------------------

  function showStep(name) {
    Object.keys(steps).forEach(function (key) {
      if (!steps[key]) return;
      steps[key].hidden = key !== name;
    });
  }

  function showError(message) {
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearError() {
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  function updateGenerateButtonState() {
    generateBtn.disabled = !(selectedFile && consentCheckbox.checked);
  }

  function resetToUpload() {
    selectedFile = null;
    resultDataUrl = null;
    fileInput.value = '';
    previewImg.src = '';
    previewWrap.hidden = true;
    dropzoneEmpty.hidden = false;
    consentCheckbox.checked = false;
    clearError();
    updateGenerateButtonState();
    showStep('upload');
  }

  /**
   * Validates a File object client-side before it's ever sent to the
   * server. This is a UX convenience only — the backend re-validates
   * everything independently and must not be trusted to skip that.
   */
  function validateFile(file) {
    if (!file) return 'No file selected.';
    if (ALLOWED_TYPES.indexOf(file.type) === -1) {
      return 'Please upload a JPEG, PNG, or WEBP image.';
    }
    if (file.size > MAX_FILE_BYTES) {
      return 'Please upload an image smaller than 8MB.';
    }
    return null;
  }

  function handleFileSelected(file) {
    clearError();
    var validationError = validateFile(file);
    if (validationError) {
      showError(validationError);
      return;
    }
    selectedFile = file;

    var reader = new FileReader();
    reader.onload = function (e) {
      previewImg.src = e.target.result;
      dropzoneEmpty.hidden = true;
      previewWrap.hidden = false;
    };
    reader.readAsDataURL(file);

    updateGenerateButtonState();
  }

  // ---- upload interactions ------------------------------------------------

  dropzone.addEventListener('click', function (e) {
    if (e.target === removeBtn) return;
    fileInput.click();
  });

  dropzone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) {
      handleFileSelected(fileInput.files[0]);
    }
  });

  ['dragenter', 'dragover'].forEach(function (evtName) {
    dropzone.addEventListener(evtName, function (e) {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add('spw-dragover');
    });
  });

  ['dragleave', 'drop'].forEach(function (evtName) {
    dropzone.addEventListener(evtName, function (e) {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove('spw-dragover');
    });
  });

  dropzone.addEventListener('drop', function (e) {
    var files = e.dataTransfer && e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelected(files[0]);
    }
  });

  removeBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    selectedFile = null;
    fileInput.value = '';
    previewImg.src = '';
    previewWrap.hidden = true;
    dropzoneEmpty.hidden = false;
    updateGenerateButtonState();
  });

  consentCheckbox.addEventListener('change', updateGenerateButtonState);

  privacyLink.addEventListener('click', function (e) {
    e.preventDefault();
    privacyNote.hidden = !privacyNote.hidden;
  });

  // ---- generate ------------------------------------------------------------

  generateBtn.addEventListener('click', function () {
    if (!selectedFile || !consentCheckbox.checked) return;

    clearError();
    showStep('loading');

    var formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('consent', 'true');

    fetch(SMILE_API_BASE_URL + '/generate', {
      method: 'POST',
      body: formData,
    })
      .then(function (response) {
        return response.json().then(function (data) {
          if (!response.ok) {
            throw new Error(data && data.message ? data.message : 'Something went wrong. Please try again.');
          }
          return data;
        });
      })
      .then(function (data) {
        if (!data || !data.image) {
          throw new Error('The server did not return an image. Please try again.');
        }
        resultDataUrl = data.image;
        beforeImg.src = previewImg.src;
        afterImg.src = resultDataUrl;
        compareSlider.value = 50;
        setComparePosition(50);
        showStep('result');
      })
      .catch(function (err) {
        showStep('upload');
        showError(err.message || 'Something went wrong generating your preview. Please try again.');
      });
  });

  // ---- before/after compare slider -----------------------------------------

  function setComparePosition(percent) {
    var clamped = Math.max(0, Math.min(100, percent));
    compareAfter.style.clipPath = 'inset(0 ' + (100 - clamped) + '% 0 0)';
    compareHandle.style.left = clamped + '%';
  }

  compareSlider.addEventListener('input', function () {
    setComparePosition(Number(compareSlider.value));
  });

  // ---- download --------------------------------------------------------

  downloadBtn.addEventListener('click', function () {
    if (!resultDataUrl) return;
    var link = document.createElement('a');
    link.href = resultDataUrl;
    link.download = 'smile-preview.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  restartBtn.addEventListener('click', resetToUpload);

  // ---- init ---------------------------------------------------------------
  updateGenerateButtonState();
})();
