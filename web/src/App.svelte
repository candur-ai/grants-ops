<script>
  import { onMount } from 'svelte';
  import { user, authLoading, profile, currentRoute } from './lib/stores.js';
  import { api } from './lib/api.js';
  import SiteNav from './components/SiteNav.svelte';
  import Nav from './components/Nav.svelte';
  import Login from './routes/login/Page.svelte';
  import Home from './routes/Home.svelte';
  import Dashboard from './routes/Dashboard.svelte';
  import GrantSearch from './routes/search/Page.svelte';
  import SearchProvider from './routes/search-provider/Page.svelte';
  import DebateStudio from './routes/debate/Page.svelte';
  import Pipeline from './routes/pipeline/Page.svelte';
  import Tracker from './routes/tracker/Page.svelte';
  import Profile from './routes/profile/Page.svelte';
  import Reports from './routes/reports/Page.svelte';
  import ReportDetail from './routes/reports/Detail.svelte';
  import Evaluate from './routes/evaluate/Page.svelte';
  import Apply from './routes/apply/Page.svelte';
  import Toast from './components/Toast.svelte';

  let route = $state('home');
  let routeParam = $state('');
  let grantRoute = $state('dashboard');
  let grantParam = $state('');
  let loadedProfileForUser = $state('');

  function handleHashChange() {
    const hash = window.location.hash.slice(2) || 'home';
    const parts = hash.split('/');
    route = parts[0] || 'home';
    routeParam = parts[1] || '';
    grantRoute = route === 'grants' ? (parts[1] || 'dashboard') : 'dashboard';
    grantParam = route === 'grants' ? (parts[2] || '') : '';
    currentRoute.set(route === 'grants' ? grantRoute : route);
  }

  onMount(() => {
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  });

  // Load profile when user is available
  $effect(() => {
    const userId = $user?.id || '';
    if (!userId) {
      loadedProfileForUser = '';
      profile.set(null);
      return;
    }

    if (loadedProfileForUser !== userId) {
      loadedProfileForUser = userId;
      api.getProfile().then(p => profile.set(p)).catch(() => profile.set(null));
    }
  });
</script>

{#if $authLoading}
  <div class="loading-screen">
    <div class="spinner"></div>
    <p>Loading...</p>
  </div>
{:else}
  {#if route === 'grants'}
    {#if !$user}
      <SiteNav {route} />
      <main class="public-main auth-shell">
        <Login />
      </main>
    {:else}
      <div class="app-layout">
        <Nav route={grantRoute} />
        <main class="app-main">
          {#if grantRoute === 'dashboard'}
            <Dashboard />
          {:else if grantRoute === 'search'}
            <GrantSearch />
          {:else if grantRoute === 'pipeline'}
            <Pipeline />
          {:else if grantRoute === 'tracker'}
            <Tracker />
          {:else if grantRoute === 'profile'}
            <Profile />
          {:else if grantRoute === 'reports' && grantParam}
            <ReportDetail id={grantParam} />
          {:else if grantRoute === 'reports'}
            <Reports />
          {:else if grantRoute === 'evaluate'}
            <Evaluate opportunityId={grantParam} />
          {:else if grantRoute === 'apply'}
            <Apply />
          {:else}
            <Dashboard />
          {/if}
        </main>
      </div>
    {/if}
  {:else}
    <SiteNav {route} />
    <main class="public-main">
      {#if route === 'home'}
        <Home />
      {:else if route === 'search-provider'}
        <SearchProvider />
      {:else if route === 'debate'}
        <DebateStudio />
      {:else}
        <Home />
      {/if}
    </main>
  {/if}
{/if}

<Toast />

<style>
  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    gap: 1rem;
    color: var(--text-secondary);
  }

  .app-layout {
    display: flex;
    min-height: 100vh;
    background: var(--paper);
  }

  .app-main {
    flex: 1;
    margin-left: var(--sidebar-width);
    padding: var(--s-7);
    max-width: 1240px;
    width: 100%;
  }

  .public-main {
    min-height: calc(100vh - 58px);
  }

  .auth-shell {
    min-height: calc(100vh - 58px);
    background: var(--paper);
  }

  @media (max-width: 768px) {
    .app-main {
      margin-left: 0;
      padding: 1rem;
    }
  }
</style>
