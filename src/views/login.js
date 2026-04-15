// OAuth2-proxy configuration
const OAUTH2_PROXY_URL = (function() {
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  const isDev = hostname === 'localhost' || hostname === '127.0.0.1';
  return isDev ? 'http://localhost:4180' : `${protocol}//${hostname}`;
})();

// Method selection functions
function showOtpForm() {
  document.getElementById('methodSelector').style.display = 'none';
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('recipient').focus();
}

function showMethodSelector() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('methodSelector').style.display = 'block';
}

function loginWithProvider(provider) {
  const currentUrl = window.location.href.split('?')[0];
  const redirectUrl = encodeURIComponent(currentUrl);
  const oauth2StartUrl = `${OAUTH2_PROXY_URL}/oauth2/start?rd=${redirectUrl}&provider=${provider}`;
  window.location.href = oauth2StartUrl;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.add('show');
}

// DOM Elements
const form = document.getElementById('loginForm');
const emailChannel = document.getElementById('emailChannel');
const smsChannel = document.getElementById('smsChannel');
const recipientInput = document.getElementById('recipient');
const recipientLabel = document.getElementById('recipientLabel');
const helperText = document.getElementById('helperText');
const errorMessage = document.getElementById('errorMessage');
const submitBtn = document.getElementById('submitBtn');
const loading = document.getElementById('loading');

// Add event listeners for buttons
document.getElementById('otpBtn').addEventListener('click', showOtpForm);
if (document.getElementById('googleBtn')) {
  document.getElementById('googleBtn').addEventListener('click', () => loginWithProvider('google'));
}
if (document.getElementById('facebookBtn')) {
  document.getElementById('facebookBtn').addEventListener('click', () => loginWithProvider('facebook'));
}
document.getElementById('backBtn').addEventListener('click', showMethodSelector);

// Update labels when channel changes
emailChannel.addEventListener('change', () => {
  recipientLabel.textContent = 'Email Address';
  recipientInput.type = 'email';
  recipientInput.placeholder = 'your@email.com';
  helperText.textContent = "We'll send a 6-digit code to this email";
  recipientInput.value = '';
});

smsChannel.addEventListener('change', () => {
  recipientLabel.textContent = 'Phone Number';
  recipientInput.type = 'tel';
  recipientInput.placeholder = '+1 (555) 123-4567';
  helperText.textContent = "We'll send a 6-digit code to this phone number";
  recipientInput.value = '';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const channel = document.querySelector('input[name="channel"]:checked').value;
  const recipient = recipientInput.value.trim();

  if (!recipient) {
    showError('Please enter your email or phone number');
    return;
  }

  if (channel === 'email' && !recipient.includes('@')) {
    showError('Please enter a valid email address');
    return;
  }

  if (channel === 'sms' && !recipient.replace(/\D/g, '').match(/\d{10,}/)) {
    showError('Please enter a valid phone number');
    return;
  }

  submitBtn.style.display = 'none';
  form.style.opacity = '0.6';
  loading.style.display = 'block';
  errorMessage.classList.remove('show');

  try {
    const baseUrl = window.API_BASE_URL || '';
    const response = await fetch(baseUrl + '/otp/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ recipient, channel }),
    });

    const data = await response.json();

    if (!response.ok) {
      showError(data.error || 'Failed to send code');
      submitBtn.style.display = 'block';
      form.style.opacity = '1';
      loading.style.display = 'none';
      return;
    }

    sessionStorage.setItem('otpRecipient', recipient);
    sessionStorage.setItem('otpChannel', channel);
    window.location.href = '/verify';
  } catch (err) {
    showError('Network error. Please try again.');
    submitBtn.style.display = 'block';
    form.style.opacity = '1';
    loading.style.display = 'none';
  }
});
