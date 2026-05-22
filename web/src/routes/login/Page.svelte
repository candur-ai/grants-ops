<script>
  import { supabase } from '../../lib/supabase.js';

  let email = $state('');
  let password = $state('');
  let isSignUp = $state(false);
  let loading = $state(false);
  let error = $state('');

  async function handleSubmit(e) {
    e.preventDefault();
    loading = true;
    error = '';

    try {
      if (isSignUp) {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        error = 'Check your email for a confirmation link.';
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
      }
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  }
</script>

<div class="login-page">
  <div class="login-card">
    <div class="login-header">
      <div class="login-logo">G</div>
      <h1>Grants-Ops</h1>
      <p>AI-powered grant search & application pipeline</p>
    </div>

    <form onsubmit={handleSubmit}>
      <div class="form-group">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          bind:value={email}
          placeholder="you@organization.org"
          required
        />
      </div>

      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          placeholder="Min 6 characters"
          minlength="6"
          required
        />
      </div>

      {#if error}
        <div class="form-error">{error}</div>
      {/if}

      <button type="submit" class="btn btn-primary login-btn" disabled={loading}>
        {#if loading}
          <span class="spinner"></span>
        {:else}
          {isSignUp ? 'Create Account' : 'Sign In'}
        {/if}
      </button>
    </form>

    <div class="divider">
      <span>or</span>
    </div>

    <button class="btn btn-secondary login-btn" onclick={signInWithGoogle}>
      Continue with Google
    </button>

    <div class="toggle-mode">
      {#if isSignUp}
        Already have an account?
        <button class="link-btn" onclick={() => isSignUp = false}>Sign in</button>
      {:else}
        New here?
        <button class="link-btn" onclick={() => isSignUp = true}>Create an account</button>
      {/if}
    </div>
  </div>
</div>

<style>
  .login-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: var(--bg);
  }

  .login-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-xl);
    padding: 2.5rem;
    width: 100%;
    max-width: 400px;
    box-shadow: var(--shadow-lg);
  }

  .login-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .login-logo {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-lg);
    background: var(--primary);
    color: white;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 1.25rem;
    margin-bottom: 0.75rem;
  }

  .login-header h1 {
    font-size: 1.375rem;
    margin-bottom: 0.25rem;
  }

  .login-header p {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    font-size: 0.8125rem;
    font-weight: 500;
    margin-bottom: 0.375rem;
  }

  .form-group input {
    width: 100%;
  }

  .form-error {
    padding: 0.5rem 0.75rem;
    background: var(--danger-light);
    color: var(--danger);
    border-radius: var(--radius-sm);
    font-size: 0.8125rem;
    margin-bottom: 1rem;
  }

  .login-btn {
    width: 100%;
    justify-content: center;
    padding: 0.625rem;
  }

  .divider {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin: 1.25rem 0;
    color: var(--text-secondary);
    font-size: 0.8125rem;
  }

  .divider::before,
  .divider::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  .toggle-mode {
    text-align: center;
    margin-top: 1.25rem;
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }

  .link-btn {
    color: var(--primary);
    font-weight: 500;
    font-size: 0.8125rem;
  }

  .link-btn:hover {
    text-decoration: underline;
  }
</style>
