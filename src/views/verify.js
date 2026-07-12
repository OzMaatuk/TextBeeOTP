const form = document.getElementById('verifyForm');
const codeInput = document.getElementById('code');
const errorMessage = document.getElementById('errorMessage');
const successMessage = document.getElementById('successMessage');
const submitBtn = document.getElementById('submitBtn');
const loading = document.getElementById('loading');
const timer = document.getElementById('timer');
const timeLeft = document.getElementById('timeLeft');
const recipientDisplay = document.getElementById('recipientDisplay');
const verificationForm = document.getElementById('verificationForm');
const verificationSuccess = document.getElementById('verificationSuccess');
const tokenDisplay = document.getElementById('tokenDisplay');
const signInAgainBtn = document.getElementById('signInAgainBtn');

if (signInAgainBtn) {
  signInAgainBtn.addEventListener('click', () => {
    window.location.href = '/login';
  });
}

// Retrieve recipient and channel from sessionStorage
const recipient = sessionStorage.getItem('otpRecipient');
const channel = sessionStorage.getItem('otpChannel');
const returnUrl = window.RETURN_URL || sessionStorage.getItem('otpReturnUrl') || '';

if (!recipient) {
  window.location.href = '/login';
} else {
  const masked = maskRecipient(recipient);
  recipientDisplay.textContent = `Code sent to: ${masked}`;
}

function maskRecipient(str) {
  if (str.includes('@')) {
    const [local, domain] = str.split('@');
    const visibleChars = Math.max(1, Math.floor(local.length / 3));
    const masked = local.substring(0, visibleChars) + '*'.repeat(local.length - visibleChars);
    return `${masked}@${domain}`;
  } else {
    const digits = str.replace(/\D/g, '');
    const last4 = digits.slice(-4);
    return `+***${last4}`;
  }
}

// Timer functionality
let secondsLeft = window.OTP_TTL_SECONDS || 600;
const timerInterval = setInterval(() => {
  secondsLeft--;
  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  timeLeft.textContent = `${minutes}:${secs.toString().padStart(2, '0')}`;

  if (secondsLeft <= 0) {
    clearInterval(timerInterval);
    timer.classList.add('expired');
    timeLeft.textContent = 'Code expired';
    codeInput.disabled = true;
    submitBtn.disabled = true;
  }
}, 1000);

// Auto-format input (only numbers, max 6 digits)
codeInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').substring(0, 6);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const code = codeInput.value.trim();

  if (code.length !== 6) {
    showError('Please enter a 6-digit code');
    return;
  }

  submitBtn.style.display = 'none';
  form.style.opacity = '0.6';
  loading.style.display = 'block';
  errorMessage.classList.remove('show');

  try {
    const baseUrl = window.API_BASE_URL || '';
    const response = await fetch(baseUrl + '/otp/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient, code }),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg =
        data.error === 'invalid_code' ? 'Invalid code. Check and try again.' : data.error || 'Verification failed';
      showError(errorMsg);
      submitBtn.style.display = 'block';
      form.style.opacity = '1';
      loading.style.display = 'none';
      return;
    }

    clearInterval(timerInterval);
    verificationForm.style.display = 'none';
    verificationSuccess.style.display = 'block';

    if (data.token) {
      if (returnUrl) {
        // POST the token to the return URL via a hidden auto-submitting form.
        // This keeps the token out of the browser history, server logs, and Referer headers.
        const f = document.createElement('form');
        f.method = 'POST';
        f.action = returnUrl;

        const addField = (name, value) => {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = name;
          input.value = value;
          f.appendChild(input);
        };

        addField('token', data.token);
        addField('email', data.email || recipient);

        document.body.appendChild(f);
        f.submit();
      } else {
        const maskedToken = data.token.substring(0, 8) + '...' + data.token.substring(data.token.length - 8);
        tokenDisplay.innerHTML = `Token: <span id="tokenVal" style="display:none;">${data.token}</span><span id="tokenMasked">${maskedToken}</span> <button id="copyTokenBtn" style="padding: 2px 8px; font-size: 11px; margin-left: 8px; width: auto; display: inline-block;">Copy</button>`;
        document.getElementById('copyTokenBtn').addEventListener('click', () => {
          navigator.clipboard.writeText(data.token);
          const btn = document.getElementById('copyTokenBtn');
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        });
      }
    } else {
      tokenDisplay.textContent = 'Verification complete. You can now proceed.';
    }

    sessionStorage.removeItem('otpRecipient');
    sessionStorage.removeItem('otpChannel');
    sessionStorage.removeItem('otpReturnUrl');
  } catch (err) {
    showError('Network error. Please try again.');
    submitBtn.style.display = 'block';
    form.style.opacity = '1';
    loading.style.display = 'none';
  }
});

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('show');
}
