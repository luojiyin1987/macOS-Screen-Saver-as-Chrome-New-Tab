<script>
  import { fly } from 'svelte/transition';
  import IconGrid from '~icons/mingcute/grid-line';
  import IconEdit from '~icons/mingcute/edit-2-line';
  import IconClose from '~icons/mingcute/close-line';
  import IconPlus from '~icons/mingcute/add-line';
  import { settings } from '../lib/settings.svelte.js';
  import { t } from '../lib/i18n.svelte.js';
  import {
    getTopSites,
    faviconUrlFor,
    addTopSite,
    removeTopSite,
    isWebTopSites,
  } from '../lib/topsites.js';

  let sites = $state([]);
  let hovering = $state(false);
  let editing = $state(false);
  let newUrl = $state('');

  $effect(() => {
    if (!settings.showTopSites) {
      sites = [];
      return;
    }
    getTopSites().then((data) => {
      sites = data;
    });
  });

  function normalizeUrl(input) {
    let value = input.trim();
    if (!value) return null;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = 'https://' + value;
    try {
      const url = new URL(value);
      return url.hostname ? url.href : null;
    } catch {
      return null;
    }
  }

  async function handleAdd() {
    const url = normalizeUrl(newUrl);
    if (!url) return;
    sites = await addTopSite(url);
    newUrl = '';
  }

  async function handleRemove(url) {
    sites = await removeTopSite(url);
  }

  function onInputKeydown(event) {
    if (event.key === 'Enter') {
      handleAdd();
    } else if (event.key === 'Escape') {
      editing = false;
      newUrl = '';
    }
  }

  function toggleEditing() {
    editing = !editing;
    newUrl = '';
  }

  function open(url) {
    return () => {
      window.location.href = url;
    };
  }
</script>

{#if settings.showTopSites}
  <div
    class="relative select-none"
    onmouseenter={() => (hovering = true)}
    onmouseleave={() => (hovering = false)}
    role="region"
    aria-label="Top Sites"
  >
    {#if hovering}
      <!-- Panel sits above the button. pb-3 keeps the panel's box
           contiguous with the button so the cursor traversal between
           them doesn't fire mouseleave. -->
      <div
        class="absolute right-0 bottom-full pb-3"
        transition:fly={{ x: 30, opacity: 0, duration: 240 }}
      >
        <div
          class="w-[300px] rounded-[10px] border border-white/[0.14] bg-black/40 p-3 text-white shadow-[0_8px_32px_rgba(0,0,0,0.25)]"
          role="tooltip"
        >
          {#if isWebTopSites() && editing}
            <div class="mb-2 flex gap-1.5">
              <input
                type="text"
                placeholder={t('topsites_add_placeholder')}
                bind:value={newUrl}
                onkeydown={onInputKeydown}
                class="min-w-0 flex-1 rounded-md border border-white/20 bg-black/40 px-2 py-1 text-xs text-white outline-none placeholder:text-white/40 focus:border-white/40"
                aria-label={t('topsites_add_placeholder')}
              />
              <button
                type="button"
                onclick={handleAdd}
                class="flex h-6.5 w-6.5 shrink-0 cursor-pointer items-center justify-center rounded-md bg-white/15 text-white transition hover:bg-white/25"
                title={t('topsites_add')}
                aria-label={t('topsites_add')}
              >
                <IconPlus class="h-3.5 w-3.5" />
              </button>
            </div>
          {/if}

          {#if sites.length === 0}
            <p class="px-1 py-1 text-xs opacity-70">
              {editing ? t('topsites_edit_empty') : t('topsites_empty')}
            </p>
          {:else}
            <ul class="flex flex-col gap-0.5">
              {#each sites as site}
                <li>
                  <div class="group flex items-center gap-1.5">
                    <button
                      type="button"
                      onclick={open(site.url)}
                      class="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-white/10"
                      title={site.title + ' — ' + site.url}
                    >
                      <img
                        src={faviconUrlFor(site.url)}
                        alt=""
                        class="h-4 w-4 shrink-0 rounded-sm"
                      />
                      <span class="min-w-0 flex-1 truncate">{site.title}</span>
                    </button>
                    {#if isWebTopSites() && editing}
                      <button
                        type="button"
                        onclick={() => handleRemove(site.url)}
                        class="flex h-5.5 w-5.5 shrink-0 cursor-pointer items-center justify-center rounded-md text-white/50 transition hover:bg-white/15 hover:text-white"
                        title={t('topsites_remove')}
                        aria-label={t('topsites_remove') + ': ' + site.title}
                      >
                        <IconClose class="h-3 w-3" />
                      </button>
                    {/if}
                  </div>
                </li>
              {/each}
            </ul>
          {/if}

          {#if isWebTopSites()}
            <div class="mt-2 flex justify-end border-t border-white/10 pt-2">
              <button
                type="button"
                onclick={toggleEditing}
                class="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <IconEdit class="h-3 w-3" />
                {editing ? t('topsites_done') : t('topsites_edit')}
              </button>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <button
      type="button"
      class="flex h-9.5 w-9.5 cursor-pointer items-center justify-center rounded-full bg-white/15 text-white shadow-md backdrop-blur-md transition hover:bg-white/25"
      title={t('topsites_label')}
      aria-label={t('topsites_label')}
    >
      <IconGrid class="h-4.5 w-4.5" />
    </button>
  </div>
{/if}
