if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = function (...args) {
    const message = args.map(arg => {
      try {
        if (arg instanceof Error) {
          return arg.message + ' ' + (arg.stack || '');
        }
        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
      } catch (e) {
        return String(arg);
      }
    }).join(' ');

    const isFirestoreQuotaError = 
      message.includes('@firebase/firestore') ||
      message.includes('resource-exhausted') ||
      message.includes('Quota limit exceeded') ||
      message.includes('quota metric') ||
      message.includes('Free daily write units');

    const isGeolocationPolicyError =
      message.includes('Geolocation has been disabled in this document') ||
      message.includes('permissions policy') ||
      message.includes('du suivi de position') ||
      message.includes('suivi GPS') ||
      message.includes('watchPosition') ||
      message.includes('getCurrentPosition');

    if (isFirestoreQuotaError) {
      // Log as brief info/debug to clean up error reports
      console.log("[Local Mode] Suppressed database network log (quota exceeded condition active).");
      return;
    }

    if (isGeolocationPolicyError) {
      console.log("[Local Mode] Suppressed geolocation log (restricted iframe environment).");
      return;
    }
    
    originalError.apply(console, args);
  };

  const originalWarn = console.warn;
  console.warn = function (...args) {
    const message = args.map(arg => {
      try {
        if (arg instanceof Error) {
          return arg.message;
        }
        return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
      } catch (e) {
        return String(arg);
      }
    }).join(' ');

    const isFirestoreQuotaError = 
      message.includes('@firebase/firestore') ||
      message.includes('resource-exhausted') ||
      message.includes('Quota limit exceeded') ||
      message.includes('quota metric') ||
      message.includes('Free daily write units') ||
      message.includes('maximum backoff delay to prevent overloading');

    const isGeolocationPolicyError =
      message.includes('Geolocation has been disabled in this document') ||
      message.includes('permissions policy') ||
      message.includes('du suivi de position') ||
      message.includes('suivi de position GPS') ||
      message.includes('watchPosition') ||
      message.includes('getCurrentPosition');

    if (isFirestoreQuotaError) {
      return;
    }

    if (isGeolocationPolicyError) {
      return;
    }

    originalWarn.apply(console, args);
  };
}
