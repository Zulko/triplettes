import '@fontsource/courgette/latin-400.css';
import '@fontsource/courgette/latin-ext-400.css';
import '@fontsource/patrick-hand/latin-400.css';
import '@fontsource/patrick-hand/latin-ext-400.css';
import '@fontsource/archivo-narrow/latin-400.css';
import '@fontsource/archivo-narrow/latin-600.css';
import '@fontsource/archivo-narrow/latin-700.css';
import '@fontsource/archivo-narrow/latin-ext-400.css';
import '@fontsource/archivo-narrow/latin-ext-600.css';
import '@fontsource/archivo-narrow/latin-ext-700.css';
import '@fontsource/oswald/latin-600.css';
import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const app = mount(App, {
  target: document.getElementById('app'),
});

export default app;
