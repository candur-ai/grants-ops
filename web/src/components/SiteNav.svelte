<script>
  let { route } = $props();

  const links = [
    { id: 'home', label: 'Thesis', href: '#/home' },
    { id: 'grants', label: 'Grant Ops', href: '#/grants' },
    { id: 'search-provider', label: 'Search Provider', href: '#/search-provider' },
    { id: 'debate', label: 'Agent Debate', href: '#/debate' },
  ];
</script>

<header class="site-nav">
  <a class="brand" href="#/home" aria-label="Candor home">
    <span class="mark"></span>
    <span>
      <strong>Candur</strong>
      <small>research operations</small>
    </span>
  </a>

  <nav aria-label="Main navigation">
    {#each links as link}
      <a class:active={route === link.id} href={link.href}>{link.label}</a>
    {/each}
  </nav>
</header>

<style>
  .site-nav {
    position: sticky;
    top: 0;
    z-index: 80;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--s-4);
    padding: 14px 24px;
    background: color-mix(in srgb, var(--paper) 92%, transparent);
    border-bottom: 1px solid var(--rule);
    backdrop-filter: blur(8px);
  }

  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--ink);
    text-decoration: none;
  }

  .brand:hover,
  .site-nav nav a:hover {
    text-decoration: none;
  }

  .mark {
    width: 14px;
    height: 14px;
    background: var(--sage);
    border-radius: 50%;
    position: relative;
  }

  .mark::after {
    content: '';
    position: absolute;
    inset: 3px;
    background: var(--paper);
    border-radius: 50%;
  }

  .brand strong,
  .brand small {
    display: block;
  }

  .brand strong {
    font-size: 0.9375rem;
    font-weight: 500;
    line-height: 1;
    letter-spacing: 0;
  }

  .brand small {
    margin-top: 0.2rem;
    color: var(--ink-3);
    font-family: var(--type);
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  nav {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-wrap: wrap;
    justify-content: center;
    background: var(--paper-2);
    border-radius: var(--r-3);
    padding: 3px;
  }

  nav a {
    color: var(--ink-2);
    text-decoration: none;
    font-size: 0.8125rem;
    font-weight: 500;
    padding: 0.4375rem 0.875rem;
    border-radius: var(--r-2);
    transition: color var(--t-fast), background var(--t-fast);
  }

  nav a.active {
    color: var(--ink);
    background: var(--card);
    box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.04);
  }

  @media (max-width: 760px) {
    .site-nav {
      position: relative;
      align-items: flex-start;
      grid-template-columns: 1fr;
      flex-direction: column;
    }

    nav {
      justify-content: flex-start;
    }
  }
</style>
