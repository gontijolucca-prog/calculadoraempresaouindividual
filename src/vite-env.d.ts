/// <reference types="vite/client" />

// Import de asset com sufixo ?url (ex.: paged.js polyfill servido como ficheiro).
declare module '*?url' {
  const src: string;
  export default src;
}
