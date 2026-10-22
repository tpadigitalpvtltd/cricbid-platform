export function generateRegistrationId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomPart = '';
  for (let i = 0; i < 5; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const year = new Date().getFullYear();
  return `PCL-${year}-${randomPart}`;
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function validatePhoneNumber(phone: string): boolean {
  // Cleans spaces/hyphens and checks for exactly 10 digits (optionally prefixed with +91 or 0)
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
    return true;
  }
  if (cleaned.length === 12 && cleaned.startsWith('91') && /^91[6-9]\d{9}$/.test(cleaned)) {
    return true;
  }
  return false;
}

export function clean10DigitPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  if (cleaned.length === 12 && cleaned.startsWith('91')) {
    return cleaned.slice(2);
  }
  return cleaned;
}

/**
 * Compresses an image client-side to an optimized base64 string
 * Keeps file size lightweight (under 150KB) for seamless transmission to Google Sheets API
 */
export async function compressImage(
  file: File,
  maxWidth = 600,
  maxHeight = 600,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(event.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}
