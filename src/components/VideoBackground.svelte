<script>
  import { settings } from '../lib/settings.svelte.js';
  import { t } from '../lib/i18n.svelte.js';
  import {
    getPlaylist,
    refreshLocalPlaylist,
    reportAppleProxyFailure,
    isAppleProxyFailed,
    reportAppleDirectFailure,
    isAppleDirectFailed,
    getPreviewCandidates,
  } from '../lib/video-source.js';
  import { nowPlaying, registerVideoNext } from '../lib/now-playing.svelte.js';
  import {
    normalizeShuffleScopes,
    pickInitialVideoIndex,
    pickNextVideoIndex,
  } from '../lib/shuffle-scope.js';

  let items = $state([]);
  let currentIndex = $state(-1);
  let opacity = $state(0);
  let errorMessage = $state('');
  let consecutiveErrors = 0;
  let usingProxyRoute = false;
  let routeSwitches = 0;
  let fallbackActive = $state(false);
  let previewCandidates = $state([]);
  let previewAttempt = $state(0);
  let activeShuffleScopesKey = JSON.stringify(normalizeShuffleScopes(settings.shuffleScopes));
  let transitionTimer = null;

  const current = $derived(currentIndex >= 0 ? items[currentIndex] : null);
  const currentUrl = $derived(current?.url ?? '');
  const fallbackSrc = $derived(previewCandidates[previewAttempt] ?? '');

  async function loadPlaylist({ forceRefresh = false } = {}) {
    errorMessage = '';
    fallbackActive = false;
    previewCandidates = [];
    previewAttempt = 0;
    try {
      const result =
        forceRefresh && settings.videoSrc === 'local'
          ? await refreshLocalPlaylist(settings.videoSourceUrl)
          : await getPlaylist({
              videoSrc: settings.videoSrc,
              videoSourceUrl: settings.videoSourceUrl,
              reverseProxy: settings.reverseProxy,
            });
      items = result.items;
      usingProxyRoute = result.usingProxy ?? false;
      if (items.length === 0) {
        errorMessage =
          settings.videoSrc === 'local'
            ? t('error_video_local_empty')
            : t('error_video_apple');
        return;
      }
      currentIndex = pickInitialVideoIndex(items, settings.shuffleScopes);
      opacity = 0;
    } catch (e) {
      console.error('Playlist load failed:', e);
      errorMessage =
        settings.videoSrc === 'local'
          ? t('error_video_local')
          : t('error_video_apple');
    }
  }

  $effect(() => {
    settings.videoSrc;
    settings.videoSourceUrl;
    settings.reverseProxy;
    routeSwitches = 0;
    loadPlaylist();
  });

  $effect(() => {
    const scopes = normalizeShuffleScopes(settings.shuffleScopes);
    const scopeKey = JSON.stringify(scopes);
    if (scopeKey === activeShuffleScopesKey) return;
    activeShuffleScopesKey = scopeKey;
    if (items.length === 0) return;
    scheduleVideoChange(scopes);
  });

  $effect(() => {
    nowPlaying.item = current;
  });

  $effect(() => {
    registerVideoNext(nextVideo);
    return () => registerVideoNext(null);
  });

  $effect(() => {
    return () => clearTransitionTimer();
  });

  function clearTransitionTimer() {
    if (!transitionTimer) return;
    clearTimeout(transitionTimer);
    transitionTimer = null;
  }

  function scheduleVideoChange(scopes) {
    if (items.length === 0) return;
    clearTransitionTimer();
    opacity = 0;
    transitionTimer = setTimeout(() => {
      currentIndex = pickNextVideoIndex(items, currentIndex, scopes);
      transitionTimer = null;
    }, 650);
  }

  function nextVideo(options = {}) {
    const scopes = normalizeShuffleScopes(options.scopes ?? settings.shuffleScopes);
    if (options.setActiveScope) {
      activeShuffleScopesKey = JSON.stringify(scopes);
    }
    scheduleVideoChange(scopes);
  }

  function onCanPlay() {
    opacity = 1;
    consecutiveErrors = 0;
    routeSwitches = 0;
  }

  function onError() {
    console.warn('Video error on:', currentUrl);
    consecutiveErrors++;

    if (settings.videoSrc === 'apple') {
      // Silent failover between the two Apple routes. The report* calls
      // flip the session flags in video-source.js, so loadPlaylist()
      // rebuilds the playlist on the other route. Never switch to a route
      // that already failed.
      if (usingProxyRoute && !isAppleProxyFailed() && !isAppleDirectFailed()) {
        routeSwitches++;
        reportAppleProxyFailure();
        console.info('Apple proxy route failing, switching to direct sylvan.apple.com');
        loadPlaylist();
        return;
      }
      if (!usingProxyRoute && !isAppleDirectFailed() && !isAppleProxyFailed()) {
        routeSwitches++;
        reportAppleDirectFailure();
        console.info('Direct Apple route failing, switching to the proxy worker');
        loadPlaylist();
        return;
      }
      // A route switch already happened and playback still fails. The
      // outage is systemic, so retrying sibling videos cannot help.
      if (routeSwitches > 0) {
        showStillFallback();
        return;
      }
    }

    if (consecutiveErrors <= 3 && items.length > 1) {
      nextVideo();
      return;
    }

    showStillFallback();
  }

  // Last-resort UX: show the current video's still image instead of the
  // error banner. The banner appears only when no preview loads either.
  function showStillFallback() {
    fallbackActive = true;
    previewCandidates = getPreviewCandidates(current?.meta?.previewImage);
    previewAttempt = 0;
    if (!fallbackSrc) showErrorBanner();
  }

  function onFallbackImageError() {
    previewAttempt++;
    if (!fallbackSrc) showErrorBanner();
  }

  function showErrorBanner() {
    errorMessage =
      settings.videoSrc === 'local'
        ? t('error_video_local')
        : t('error_video_apple');
  }
</script>

{#if errorMessage}
  <div class="error-box">{errorMessage}</div>
{/if}

{#if fallbackActive && fallbackSrc}
  <img
    class="still-fallback"
    src={fallbackSrc}
    alt=""
    onerror={onFallbackImageError}
  />
{/if}

{#if currentUrl && !fallbackActive}
  {#key currentUrl}
    <video
      src={currentUrl}
      autoplay
      muted
      style:opacity={opacity}
      oncanplay={onCanPlay}
      onended={nextVideo}
      onerror={onError}
    ></video>
  {/key}
{/if}

<style>
  video,
  .still-fallback {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    object-fit: cover;
    transition: opacity 0.6s ease-in-out;
    z-index: -1;
    background: #000;
  }
  .error-box {
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.75rem 1.25rem;
    max-width: 80vw;
    background: rgba(180, 0, 0, 0.7);
    color: #fff;
    border-radius: 6px;
    font-size: 0.9rem;
    z-index: 100;
    backdrop-filter: blur(8px);
    text-align: center;
  }
</style>
