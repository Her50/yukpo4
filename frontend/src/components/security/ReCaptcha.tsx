import React, { useEffect, useRef, useState } from 'react';

interface ReCaptchaProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  siteKey: string;
  theme?: 'light' | 'dark';
  size?: 'compact' | 'normal' | 'invisible';
  className?: string;
}

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      render: (container: HTMLElement, options: any) => number;
      reset: (widgetId: number) => void;
      getResponse: (widgetId: number) => string;
      execute: (widgetId: number) => void;
    };
  }
}

const ReCaptcha: React.FC<ReCaptchaProps> = ({
  onVerify,
  onExpire,
  onError,
  siteKey,
  theme = 'light',
  size = 'normal',
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const loadReCaptcha = () => {
      if (window.grecaptcha) {
        setIsLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://www.google.com/recaptcha/api.js?render=explicit`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        window.grecaptcha.ready(() => {
          setIsLoaded(true);
        });
      };
      script.onerror = () => {
        console.error('Erreur chargement reCAPTCHA');
        onError?.();
      };
      document.head.appendChild(script);
    };

    loadReCaptcha();
  }, [onError]);

  useEffect(() => {
    if (isLoaded && containerRef.current && !widgetIdRef.current) {
      try {
        const widgetId = window.grecaptcha.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          size,
          callback: (token: string) => {
            setIsVerified(true);
            onVerify(token);
          },
          'expired-callback': () => {
            setIsVerified(false);
            onExpire?.();
          },
          'error-callback': () => {
            setIsVerified(false);
            onError?.();
          }
        });
        widgetIdRef.current = widgetId;
      } catch (error) {
        console.error('Erreur initialisation reCAPTCHA:', error);
        onError?.();
      }
    }
  }, [isLoaded, siteKey, theme, size, onVerify, onExpire, onError]);

  const reset = () => {
    if (widgetIdRef.current !== null) {
      window.grecaptcha.reset(widgetIdRef.current);
      setIsVerified(false);
    }
  };

  const execute = () => {
    if (widgetIdRef.current !== null) {
      window.grecaptcha.execute(widgetIdRef.current);
    }
  };

  return (
    <div className={`recaptcha-container ${className}`}>
      <div ref={containerRef} />
      {isVerified && (
        <div className="text-green-600 text-sm mt-2 flex items-center gap-1">
          <span>✓</span>
          <span>Vérification réussie</span>
        </div>
      )}
    </div>
  );
};

export default ReCaptcha;
