/// <reference types="vite/client" />
/// <reference types="@react-three/fiber" />

import { ThreeElements } from '@react-three/fiber';

interface ImportMetaEnv {
    readonly VITE_GEMINI_API_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare module 'react' {
    namespace JSX {
        interface IntrinsicElements extends ThreeElements { }
    }
}
