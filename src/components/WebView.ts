import { WebView as BaseWebView, type WebViewProps } from 'react-native-webview';

// react-native-webview 14 declares `class WebView<P = undefined> extends
// Component<WebViewProps & P>`. With current React/TS types `WebViewProps &
// undefined` collapses to `never`, so no prop or ref would type-check. This is
// the same component, re-typed with an empty extra-props object.
export type WebView = BaseWebView<{}>;
export const WebView = BaseWebView as unknown as new (props: WebViewProps) => BaseWebView<{}>;
export type { WebViewProps };
