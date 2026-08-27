/**
 * WebView Bridge - Communication between React Native and WebView
 * Handles message passing and event coordination
 */

export type WebViewMessageType =
  | 'logout'
  | 'navigate'
  | 'tokenRefresh'
  | 'ready'
  | 'error'
  | 'console';

export interface WebViewMessage {
  type: WebViewMessageType;
  payload?: any;
}

export interface NavigatePayload {
  screen: string;
  params?: Record<string, any>;
}

/**
 * Parse incoming message from WebView
 */
export const parseWebViewMessage = (data: string): WebViewMessage | null => {
  try {
    const message = JSON.parse(data);
    return message as WebViewMessage;
  } catch (e) {
    console.error('Failed to parse WebView message', e);
    return null;
  }
};

/**
 * Create a message to send to WebView
 */
export const createWebViewMessage = (
  type: WebViewMessageType,
  payload?: any
): string => {
  const message: WebViewMessage = { type, payload };
  return JSON.stringify(message);
};

/**
 * JavaScript code to inject into WebView for token authentication
 * This will be injected BEFORE the page loads
 */
export const getTokenInjectionScript = (token: string | null): string => {
  if (!token) return '';

  return `
    (function() {
      // Store token in localStorage for the web app to use
      try {
        localStorage.setItem('authToken', '${token}');
        localStorage.setItem('sessionId', '${token}');
        console.log('Auth token injected successfully');
      } catch (e) {
        console.error('Failed to inject auth token', e);
      }

      // Set up message listener for React Native
      window.addEventListener('message', function(event) {
        try {
          const message = JSON.parse(event.data);
          console.log('Received message from RN:', message);
          
          // Handle different message types
          if (message.type === 'updateToken') {
            localStorage.setItem('authToken', message.payload.token);
            localStorage.setItem('sessionId', message.payload.token);
          }
        } catch (e) {
          console.error('Error handling RN message', e);
        }
      });

      // Notify React Native that WebView is ready
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'ready',
          payload: { timestamp: Date.now() }
        }));
      }
    })();
  `;
};

/**
 * JavaScript code to handle logout from WebView
 */
export const getLogoutHandlerScript = (): string => {
  return `
    (function() {
      // Override logout functions to notify React Native
      const originalFetch = window.fetch;
      window.fetch = function(...args) {
        const [url, options] = args;
        
        // Convert url to string (it might be a Request object or URL object)
        const urlString = typeof url === 'string' ? url : url.toString();
        
        // Detect logout requests
        if (urlString.includes('/logout') || urlString.includes('/signout')) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'logout',
              payload: { url: urlString }
            }));
          }
        }
        
        return originalFetch.apply(this, args);
      };

      // Add global logout function
      window.RNLogout = function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'logout',
            payload: { source: 'manual' }
          }));
        }
      };
    })();
  `;
};

/**
 * JavaScript code to capture console logs and check WebGL support
 * Helps debug Mapbox rendering issues
 */
export const getConsoleLogCaptureScript = (): string => {
  return `
    (function() {
      const originalLog = console.log;
      const originalError = console.error;
      const originalWarn = console.warn;
      
      console.log = function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'console',
            level: 'log',
            data: Array.from(arguments).join(' ')
          }));
        }
        originalLog.apply(console, arguments);
      };
      
      console.error = function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'console',
            level: 'error',
            data: Array.from(arguments).join(' ')
          }));
        }
        originalError.apply(console, arguments);
      };
      
      console.warn = function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'console',
            level: 'warn',
            data: Array.from(arguments).join(' ')
          }));
        }
        originalWarn.apply(console, arguments);
      };
      
      // Check WebGL support for Mapbox
      setTimeout(function() {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) {
          console.error('❌ WebGL is NOT supported in this WebView! Mapbox will not render.');
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'error',
              payload: { message: 'WebGL not supported' }
            }));
          }
        } else {
          console.log('✅ WebGL is supported - Mapbox should render correctly');
        }
      }, 1000);
    })();
  `;
};
