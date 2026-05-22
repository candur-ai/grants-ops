<script>
  import { toasts } from '../lib/stores.js';
</script>

{#if $toasts.length > 0}
  <div class="toast-container">
    {#each $toasts as t (t.id)}
      <div class="toast toast-{t.type}">{t.message}</div>
    {/each}
  </div>
{/if}
