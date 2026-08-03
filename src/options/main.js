import '../styles/tailwind.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { initSettings, settings } from '../lib/settings.svelte.js';
import { loadLanguage, resolveLanguage } from '../lib/i18n.svelte.js';

// Web build only — installs the chrome.* shim (localStorage-backed
// storage, first-run stamping).
import '../lib/web/chrome-shim.js';

await initSettings();
loadLanguage(resolveLanguage(settings.userLanguage));

mount(App, { target: document.getElementById('app') });
