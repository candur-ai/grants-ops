<script>
  import { toast } from '../../lib/stores.js';

  let idea = $state('How should Candur bring practical AI to Main Street without increasing centralization or leaving local operators behind?');
  let agentA = $state({
    name: 'Builder',
    persona: 'Optimistic product strategist who wants a fast prototype and clear user value.',
    goals: 'Find the strongest practical case and identify a shippable next step.',
  });
  let agentB = $state({
    name: 'Auditor',
    persona: 'Skeptical evaluator who protects quality, compliance, and reviewer attention.',
    goals: 'Surface risks, missing evidence, and failure modes before the team commits.',
  });
  let context = $state([]);
  let loading = $state(false);
  let debate = $state(null);

  $effect(() => {
    try {
      context = JSON.parse(localStorage.getItem('candor_search_context') || '[]');
    } catch {
      context = [];
    }
  });

  async function runDebate() {
    loading = true;
    debate = null;
    try {
      const res = await fetch('/api/v1/debate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, agentA, agentB, context }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Debate failed');
      debate = data;
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      loading = false;
    }
  }
</script>

<section class="debate-page">
  <div class="debate-header">
    <p class="eyebrow">Agent Debate Studio</p>
    <h1>Make two agents test the better version of a Main Street AI idea.</h1>
    <p>Use search context as evidence, assign each persona a mandate, then debate ideas like AI tutors, YC for Main Street, independent-practice health care, or a profession-by-profession AI series.</p>
  </div>

  <div class="studio-grid">
    <form class="setup" onsubmit={(e) => { e.preventDefault(); runDebate(); }}>
      <label for="idea">Idea</label>
      <textarea id="idea" bind:value={idea} rows="4"></textarea>

      <div class="agents">
        <article>
          <label for="agent-a">Agent A</label>
          <input id="agent-a" bind:value={agentA.name} />
          <textarea bind:value={agentA.persona} rows="4"></textarea>
          <textarea bind:value={agentA.goals} rows="3"></textarea>
        </article>
        <article>
          <label for="agent-b">Agent B</label>
          <input id="agent-b" bind:value={agentB.name} />
          <textarea bind:value={agentB.persona} rows="4"></textarea>
          <textarea bind:value={agentB.goals} rows="3"></textarea>
        </article>
      </div>

      <div class="context-strip">
        <strong>{context.length} search items attached</strong>
        <a href="#/search-provider">Refresh search context</a>
      </div>

      <button class="run-button" disabled={loading}>{loading ? 'Debating' : 'Run debate'}</button>
    </form>

    <aside class="context-panel">
      <h2>Attached evidence</h2>
      {#if context.length}
        {#each context.slice(0, 8) as item}
          <div class="context-item">
            <strong>{item.title}</strong>
            <span>{item.snippet}</span>
          </div>
        {/each}
      {:else}
        <p>No search context yet. Run a search and send it here, or start with a blank debate.</p>
      {/if}
    </aside>
  </div>

  {#if debate}
    <section class="debate-output">
      <h2>{debate.title}</h2>
      <div class="rounds">
        {#each debate.rounds || [] as round, index}
          <article class:indexed={index % 2 === 1}>
            <span>{round.speaker} / {round.stance}</span>
            <p>{round.text}</p>
          </article>
        {/each}
      </div>
      {#if debate.synthesis}
        <div class="synthesis">
          <strong>Synthesis</strong>
          <p>{debate.synthesis}</p>
        </div>
      {/if}
    </section>
  {/if}
</section>

<style>
  .debate-page {
    padding: clamp(2rem, 5vw, 4rem);
    background:
      linear-gradient(180deg, #fffdf6, #f0eee4);
    min-height: calc(100vh - 72px);
  }

  .debate-header {
    max-width: 980px;
  }

  .eyebrow,
  label {
    color: var(--rust);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    text-transform: uppercase;
    font-weight: 900;
  }

  h1,
  h2 {
    font-family: var(--font-display);
    letter-spacing: 0;
  }

  h1 {
    font-size: clamp(2.7rem, 6vw, 5.8rem);
    line-height: 0.9;
    margin-top: 0.75rem;
  }

  .debate-header p:last-child {
    margin-top: 1rem;
    max-width: 680px;
    color: var(--muted);
    font-size: 1.05rem;
  }

  .studio-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 0.42fr);
    gap: 1rem;
    margin-top: 2rem;
  }

  .setup,
  .context-panel,
  .debate-output {
    border: 1px solid var(--line);
    background: #fffefa;
  }

  .setup {
    padding: 1rem;
    display: grid;
    gap: 1rem;
  }

  input,
  textarea {
    width: 100%;
    border-radius: 0;
    border-color: var(--line);
    background: white;
  }

  .agents {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .agents article {
    display: grid;
    gap: 0.65rem;
    padding: 1rem;
    background: var(--paper);
    border: 1px solid var(--line);
  }

  .context-strip {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 1rem;
    background: var(--signal);
    border: 1px solid var(--ink);
  }

  .context-strip a {
    color: var(--ink);
    font-weight: 900;
  }

  .run-button {
    min-height: 48px;
    background: var(--ink);
    color: var(--nav-text);
    font-weight: 900;
  }

  .context-panel {
    padding: 1rem;
  }

  .context-panel h2,
  .debate-output h2 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
  }

  .context-item {
    padding: 0.8rem 0;
    border-top: 1px solid var(--line);
  }

  .context-item strong,
  .context-item span {
    display: block;
  }

  .context-item span {
    color: var(--muted);
    font-size: 0.88rem;
    margin-top: 0.35rem;
  }

  .debate-output {
    margin-top: 1rem;
    padding: clamp(1rem, 3vw, 1.5rem);
  }

  .rounds {
    display: grid;
    gap: 0.75rem;
  }

  .rounds article {
    max-width: 860px;
    padding: 1rem;
    background: white;
    border: 1px solid var(--line);
  }

  .rounds article.indexed {
    margin-left: auto;
    background: #f5f0df;
  }

  .rounds span {
    color: var(--rust);
    font-family: var(--font-mono);
    font-size: 0.74rem;
    text-transform: uppercase;
    font-weight: 900;
  }

  .rounds p,
  .synthesis p {
    margin-top: 0.45rem;
    color: var(--muted);
  }

  .synthesis {
    margin-top: 1rem;
    padding: 1rem;
    background: var(--ink);
    color: var(--nav-text);
  }

  .synthesis p {
    color: rgba(255, 255, 255, 0.72);
  }

  @media (max-width: 900px) {
    .studio-grid,
    .agents {
      grid-template-columns: 1fr;
    }
  }
</style>
