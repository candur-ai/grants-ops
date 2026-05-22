<script>
  import { user, profile } from '../lib/stores.js';
  import { supabase } from '../lib/supabase.js';

  let { route } = $props();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '§' },
    { id: 'search', label: 'Find grants', icon: '01' },
    { id: 'pipeline', label: 'Pipeline', icon: '02' },
    { id: 'tracker', label: 'Tracker', icon: '03' },
    { id: 'reports', label: 'Reports', icon: '04' },
    { id: 'apply', label: 'Apply', icon: '05' },
    { id: 'profile', label: 'Profile', icon: '06' },
  ];

  async function signOut() {
    await supabase.auth.signOut();
  }
</script>

<nav class="sidebar">
  <div class="sidebar-header">
    <div class="logo">
      <span class="logo-icon">G</span>
      <div>
        <div class="logo-title">Grants-Ops</div>
        <div class="logo-subtitle">DRAFT · v.01</div>
      </div>
    </div>
  </div>

  <div class="nav-items">
    {#each navItems as item}
      <a
        href="#/grants/{item.id}"
        class="nav-item"
        class:active={route === item.id}
      >
        <span class="nav-icon">{item.icon}</span>
        <span>{item.label}</span>
      </a>
    {/each}
  </div>

  <div class="sidebar-footer">
    <div class="user-info">
      <a class="home-link" href="#/home">Candor site</a>
      <div class="user-email">{$user?.email || ''}</div>
      {#if $profile}
        <div class="org-name">{$profile.legal_name}</div>
      {/if}
    </div>
    <button class="sign-out-btn" onclick={signOut}>Sign out</button>
  </div>
</nav>

<style>
  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: var(--sidebar-width);
    height: 100vh;
    background: var(--ink);
    border-right: 1px solid var(--rule-2);
    display: flex;
    flex-direction: column;
    z-index: 100;
  }

  .sidebar-header {
    padding: 1.25rem 1rem;
    border-bottom: 1px solid rgba(250, 247, 240, 0.16);
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .logo-icon {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--sage);
    position: relative;
    color: transparent;
  }

  .logo-icon::after {
    content: '';
    position: absolute;
    inset: 4px;
    background: var(--ink);
    border-radius: 50%;
  }

  .logo-title {
    font-weight: 500;
    color: var(--paper);
    font-size: 0.9375rem;
  }

  .logo-subtitle {
    font-family: var(--type);
    font-size: 0.6875rem;
    color: var(--sage-2);
    letter-spacing: 0.04em;
    font-weight: 700;
    text-transform: uppercase;
  }

  .nav-items {
    flex: 1;
    padding: 0.75rem 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    border-radius: var(--r-3);
    color: rgba(250, 247, 240, 0.68);
    text-decoration: none;
    font-size: 0.875rem;
    font-weight: 500;
    transition: color var(--t-fast), background var(--t-fast);
  }

  .nav-item:hover {
    background: rgba(250, 247, 240, 0.08);
    color: var(--paper);
    text-decoration: none;
  }

  .nav-item.active {
    background: var(--paper);
    color: var(--ink);
  }

  .nav-icon {
    width: 24px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--type);
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--sage-2);
    opacity: 1;
  }

  .nav-item.active .nav-icon {
    color: var(--sage);
  }

  .sidebar-footer {
    padding: 1rem;
    border-top: 1px solid rgba(250, 247, 240, 0.16);
  }

  .user-info {
    margin-bottom: 0.5rem;
  }

  .home-link {
    display: inline-flex;
    color: var(--paper);
    font-family: var(--type);
    font-size: 0.75rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    text-decoration: none;
  }

  .user-email {
    font-size: 0.75rem;
    color: rgba(250, 247, 240, 0.58);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .org-name {
    font-size: 0.8125rem;
    color: var(--paper);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sign-out-btn {
    width: 100%;
    padding: 0.375rem;
    border-radius: var(--r-2);
    color: rgba(250, 247, 240, 0.68);
    font-family: var(--type);
    font-size: 0.75rem;
    text-align: center;
    transition: all 0.15s;
  }

  .sign-out-btn:hover {
    background: rgba(250, 247, 240, 0.08);
    color: var(--paper);
  }

  @media (max-width: 768px) {
    .sidebar {
      display: none;
    }
  }
</style>
