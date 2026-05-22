<script>
  let { deadline } = $props();

  let daysLeft = $derived(() => {
    if (!deadline) return null;
    const d = new Date(deadline);
    const now = new Date();
    return Math.ceil((d - now) / (24 * 60 * 60 * 1000));
  });

  let days = $derived(daysLeft());
  let urgency = $derived(
    days === null ? 'neutral' :
    days < 0 ? 'danger' :
    days <= 7 ? 'danger' :
    days <= 14 ? 'warning' :
    'neutral'
  );

  let label = $derived(
    days === null ? 'Rolling' :
    days < 0 ? `${Math.abs(days)}d overdue` :
    days === 0 ? 'Today' :
    days === 1 ? 'Tomorrow' :
    `${days}d left`
  );
</script>

<span class="badge badge-{urgency}">{label}</span>
