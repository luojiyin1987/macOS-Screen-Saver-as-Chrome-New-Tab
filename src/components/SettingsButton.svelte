<script>
  import IconSettings from '~icons/mingcute/settings-3-line';
  import { t } from '../lib/i18n.svelte.js';

  // The extension exposes settings via the toolbar icon; the website
  // needs its own button, so this only renders in the web build.
  const isWeb = import.meta.env.VITE_WEB_BUILD === 'true';

  function openSettings() {
    try {
      chrome.runtime.openOptionsPage();
    } catch {
      window.open('/options', '_blank', 'noopener,noreferrer');
    }
  }
</script>

{#if isWeb}
  <button
    type="button"
    class="flex h-9.5 w-9.5 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white shadow-md backdrop-blur-md transition hover:bg-white/25"
    onclick={openSettings}
    title={t('settings_label')}
    aria-label={t('settings_label')}
  >
    <IconSettings class="h-4.5 w-4.5" />
  </button>
{/if}
